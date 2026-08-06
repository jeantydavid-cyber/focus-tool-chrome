/*
 * Smoke test: loads the extension into Chromium (new headless), creates rules
 * through the real background pipeline, and verifies:
 *   1. background registers a dynamic content script for a permitted site
 *   2. blur.js blurs matched elements on page load
 *   3. lazily-added content gets blurred (MutationObserver)
 *   4. the peek hold-to-reveal flow works and re-blurs
 *   5. the element picker creates a working rule end-to-end (+ Undo)
 *   6. popup and onboarding pages load without errors
 *
 * The test build adds "*://localhost/*" to host_permissions so no permission
 * prompt is needed (prompts can't be automated).
 */
'use strict';

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SRC = path.join(__dirname, '..', 'src');
const PORT = 8917;

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? '  ✓' : '  ✗ FAIL'} ${name}`);
  if (!cond) failures++;
}

function buildTestExtension() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-testbuild-'));
  fs.cpSync(SRC, dir, { recursive: true });
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.host_permissions = [...(manifest.host_permissions || []), `*://localhost/*`];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return dir;
}

function startServer() {
  const fixture = fs.readFileSync(path.join(__dirname, 'fixture.html'));
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(fixture);
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const ext = buildTestExtension();
  const server = await startServer();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-profile-'));

  const ctx = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    executablePath: process.env.BD_CHROMIUM || undefined,
    args: [
      `--disable-extensions-except=${ext}`,
      `--load-extension=${ext}`
    ]
  });

  try {
    // ---- service worker up ----
    let [sw] = ctx.serviceWorkers();
    if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
    check('service worker started', !!sw);

    // Fast peek settings for the test; write storage directly.
    await sw.evaluate(async () => {
      await chrome.storage.sync.set({
        settings: { peekHoldMs: 600, peekDurationS: 5, blurPx: 12, paused: false, pausedUntil: null }
      });
    });

    // ---- 1. create rules via the real pipeline ----
    const createRes = await sw.evaluate(async () => {
      return await createRules('localhost', [
        {
          id: 'r_sidebar', selector: '#sidebar', generalized: 'aside', mode: 'specific',
          label: 'Trending sidebar', createdAt: Date.now(), enabled: true, staleCount: 0, source: 'user'
        },
        {
          id: 'r_posts', selector: '#feed > div.post', generalized: '#feed > div.post', mode: 'generalized',
          label: 'Feed posts', createdAt: Date.now(), enabled: true, staleCount: 0, source: 'user'
        }
      ]);
    });
    check('createRules ok, unlocked, no permission prompt needed',
      createRes && createRes.ok && !createRes.locked && !createRes.needsPermission);

    const registered = await sw.evaluate(() => chrome.scripting.getRegisteredContentScripts());
    check('dynamic content script registered for localhost',
      registered.some((s) => s.id === 'bd-localhost'));

    // ---- 2. blur on page load ----
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('#sidebar.bd-blurred', { timeout: 10000 });
    check('sidebar blurred on load', true);
    const blurredPosts = await page.locator('.post.bd-blurred').count();
    check(`all 3 posts blurred (got ${blurredPosts})`, blurredPosts === 3);
    await sleep(300); // let the 200ms blur-in transition settle before sampling
    const filter = await page.$eval('#sidebar', (el) => getComputedStyle(el).filter);
    check(`computed filter applied (${filter})`, /blur\(12px\)/.test(filter) && /grayscale/.test(filter));
    check('peek overlays exist', (await page.locator('#bd-root .bd-overlay').count()) >= 4);

    // ---- 3. MutationObserver picks up new content ----
    await page.evaluate(() => {
      const d = document.createElement('div');
      d.className = 'post';
      d.id = 'post4';
      d.innerHTML = '<h3>Post four</h3><p>Lazy-loaded bait</p>';
      document.getElementById('feed').appendChild(d);
    });
    await page.waitForSelector('#post4.bd-blurred', { timeout: 3000 });
    check('lazily added post blurred by observer', true);

    // ---- 4. peek: hold to reveal, auto re-blur ----
    const sidebarBox = await page.locator('#sidebar').boundingBox();
    await page.mouse.move(sidebarBox.x + sidebarBox.width / 2, sidebarBox.y + 30);
    const peekBtn = page.locator('#bd-root .bd-overlay .bd-peek-btn').last(); // sidebar overlay attached last? locate by position instead
    // find the overlay covering the sidebar
    const overlayIndex = await page.evaluate(() => {
      const sb = document.getElementById('sidebar').getBoundingClientRect();
      const ovs = [...document.querySelectorAll('#bd-root .bd-overlay')];
      return ovs.findIndex((o) => {
        const r = o.getBoundingClientRect();
        return Math.abs(r.left - sb.left) < 2 && Math.abs(r.top - sb.top) < 2;
      });
    });
    check('found sidebar overlay', overlayIndex >= 0);
    const btn = page.locator('#bd-root .bd-overlay').nth(overlayIndex).locator('.bd-peek-btn');
    const btnBox = await btn.boundingBox();
    await page.mouse.move(btnBox.x + btnBox.width / 2, btnBox.y + btnBox.height / 2);
    await page.mouse.down();
    await sleep(250); // released before 600ms hold: must NOT reveal
    await page.mouse.up();
    let peeked = await page.$eval('#sidebar', (el) => el.classList.contains('bd-peek'));
    check('short press does not reveal (hold friction)', !peeked);

    await page.mouse.down();
    await sleep(900); // past the 600ms hold
    peeked = await page.$eval('#sidebar', (el) => el.classList.contains('bd-peek'));
    await page.mouse.up();
    check('hold-to-confirm reveals content', peeked);
    check('countdown chip shown', (await page.locator('.bd-countdown').count()) === 1);
    await sleep(5600); // peekDurationS = 5
    peeked = await page.$eval('#sidebar', (el) => el.classList.contains('bd-peek'));
    check('re-blurs after peek duration', !peeked);

    // ---- 5. element picker end-to-end ----
    await sw.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({ url });
      await startPicker(tabs[0]);
    }, `http://localhost:${PORT}/`);
    await page.waitForSelector('.bd-picker-hint', { timeout: 5000 });
    check('picker activated (hint visible)', true);

    const h3 = page.locator('#post1 h3');
    // post1 is blurred+overlaid; overlays get pointer-events:none while picking
    const h3box = await h3.boundingBox();
    await page.mouse.move(h3box.x + 10, h3box.y + 5);
    await page.waitForSelector('.bd-picker-highlight', { state: 'visible', timeout: 3000 });
    check('hover highlight visible', true);
    await page.mouse.click(h3box.x + 10, h3box.y + 5);
    await page.waitForSelector('.bd-toast', { timeout: 5000 });
    const toastText = await page.locator('.bd-toast span').first().textContent();
    check(`toast confirms blur ("${toastText.trim()}")`, /Blurred/.test(toastText));

    const stored = await sw.evaluate(async () => {
      const { ['site:localhost']: site } = await chrome.storage.sync.get('site:localhost');
      return site.rules.map((r) => ({ id: r.id, selector: r.selector, source: r.source }));
    });
    check(`picker rule persisted (${stored.length} rules)`, stored.length === 3);

    // Undo from the toast
    await page.click('.bd-toast button.bd-secondary');
    await sleep(600);
    const afterUndo = await sw.evaluate(async () => {
      const { ['site:localhost']: site } = await chrome.storage.sync.get('site:localhost');
      return site.rules.length;
    });
    check('undo removes the rule', afterUndo === 2);

    check('no page errors on fixture', pageErrors.length === 0);
    if (pageErrors.length) console.log('   page errors:', pageErrors);

    // ---- 6. extension pages load cleanly ----
    const extId = sw.url().split('/')[2];
    for (const p of ['popup/popup.html', 'options/options.html', 'onboarding/onboarding.html']) {
      const pg = await ctx.newPage();
      const errs = [];
      pg.on('pageerror', (e) => errs.push(String(e)));
      await pg.goto(`chrome-extension://${extId}/${p}`);
      await sleep(800);
      check(`${p} loads without errors`, errs.length === 0);
      if (errs.length) console.log('   errors:', errs);
      await pg.close();
    }

    // ---- free tier: 3rd site locks ----
    const lockRes = await sw.evaluate(async () => {
      const mk = (host) => createRules(host, [{
        id: 'r_' + host, selector: '#x', generalized: null, mode: 'specific', label: host,
        createdAt: Date.now(), enabled: true, staleCount: 0, source: 'user'
      }]);
      const a = await mk('site-two.example');
      const b = await mk('site-three.example');
      return { second: a, third: b };
    });
    check('2nd site allowed on free tier', lockRes.second.ok && !lockRes.second.locked);
    check('3rd site hits the paywall (stored but locked)', lockRes.third.ok && lockRes.third.locked);
  } finally {
    await ctx.close();
    server.close();
  }

  console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('Smoke test crashed:', e);
  process.exit(1);
});
