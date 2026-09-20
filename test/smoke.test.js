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

// The fixture is streamed in two chunks with a pause between them, so the
// document_start script has a real window before DOMContentLoaded, like on a
// real network. That is what makes the pre-paint blur check meaningful.
function startServer() {
  const fixture = fs.readFileSync(path.join(__dirname, 'fixture.html'), 'utf8');
  const cut = fixture.indexOf('<aside');
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.write(fixture.slice(0, cut));
    setTimeout(() => res.end(fixture.slice(cut)), 250);
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
    // Record what the sidebar looked like at DOMContentLoaded, before any
    // class-based apply could have run: the early stylesheet must own that.
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const sb = document.getElementById('sidebar');
        window.__bdEarly = {
          filter: sb ? getComputedStyle(sb).filter : 'no-sidebar',
          sheet: !!document.getElementById('bd-early'),
          classed: !!(sb && sb.classList.contains('bd-blurred'))
        };
      });
    });
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('#sidebar.bd-blurred', { timeout: 10000 });
    check('sidebar blurred on load', true);
    const early = await page.evaluate(() => window.__bdEarly);
    check(`pre-paint: early sheet present at DOMContentLoaded (${JSON.stringify(early)})`,
      early && early.sheet && /blur\(12px\)/.test(early.filter) && !early.classed);
    await sleep(700); // window load + debounce: the early sheet hands over to the class pass
    check('early sheet removed once every rule matched', (await page.locator('#bd-early').count()) === 0);
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

    // ---- 5b. picker: arrow keys widen / narrow the selection ----
    const togglePicker = () => sw.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({ url });
      await startPicker(tabs[0]);
    }, `http://localhost:${PORT}/`);
    const boxOf = (sel) => page.locator(sel).boundingBox();
    const highlightBox = () => page.locator('.bd-picker-highlight').boundingBox();
    const sameBox = (a, b) => a && b && Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2 &&
      Math.abs(a.width - b.width) < 2 && Math.abs(a.height - b.height) < 2;

    await togglePicker();
    await page.waitForSelector('.bd-picker-hint', { timeout: 5000 });
    const h3b = await boxOf('#post2 h3');
    await page.mouse.move(h3b.x + 10, h3b.y + 5);
    await page.waitForSelector('.bd-picker-highlight', { state: 'visible', timeout: 3000 });
    await page.keyboard.press('ArrowUp');
    await sleep(120);
    check('ArrowUp widens the highlight to the parent post', sameBox(await highlightBox(), await boxOf('#post2')));
    const hintText = await page.locator('.bd-picker-hint').textContent();
    check(`hint names the selection ("${hintText.trim().slice(0, 30)}")`, /Post two/.test(hintText));
    await page.mouse.move(h3b.x + 14, h3b.y + 6); // small jitter must not cancel the arrow selection
    await sleep(120);
    check('small mouse jitter keeps the arrow selection', sameBox(await highlightBox(), await boxOf('#post2')));
    await page.keyboard.press('ArrowDown');
    await sleep(120);
    check('ArrowDown narrows back to the child', sameBox(await highlightBox(), await boxOf('#post2 h3')));
    await page.keyboard.press('Escape');
    await sleep(150);
    check('Escape closes the picker', (await page.locator('.bd-picker-hint').count()) === 0);

    // ---- 5c. failsafe: huge element asks for confirmation instead of refusing ----
    await page.evaluate(() => {
      document.body.style.gridTemplateColumns = '1fr';
      document.getElementById('feed').style.minHeight = '3000px';
    });
    await togglePicker();
    await page.waitForSelector('.bd-picker-hint', { timeout: 5000 });
    const h3c = await boxOf('#post1 h3');
    await page.mouse.move(h3c.x + 10, h3c.y + 5);
    await page.waitForSelector('.bd-picker-highlight', { state: 'visible', timeout: 3000 });
    await page.keyboard.press('ArrowUp'); // post1
    await page.keyboard.press('ArrowUp'); // #feed, which now covers most of the viewport
    await page.keyboard.press('Enter');
    await page.waitForSelector('.bd-toast', { timeout: 5000 });
    const confirmText = await page.locator('.bd-toast span').first().textContent();
    check(`huge element prompts confirmation ("${confirmText.trim()}")`, /Blur it anyway/.test(confirmText));
    await page.click('.bd-toast button:not(.bd-secondary)'); // Blur anyway
    await page.waitForSelector('#feed.bd-blurred', { timeout: 5000 });
    check('confirmed huge element gets blurred', true);
    const afterConfirm = await sw.evaluate(async () => {
      const { ['site:localhost']: site } = await chrome.storage.sync.get('site:localhost');
      return site.rules.length;
    });
    check('confirmed rule persisted', afterConfirm === 3);
    await page.click('.bd-toast button.bd-secondary'); // Undo
    await sleep(600);
    await page.evaluate(() => {
      document.body.style.gridTemplateColumns = '';
      document.getElementById('feed').style.minHeight = '';
    });

    // ---- 5d. stale rule repair keeps identity, swaps selectors ----
    const replaced = await sw.evaluate(async () => {
      const res = await replaceRule('localhost', 'r_sidebar', {
        selector: 'aside#sidebar', generalized: 'aside', label: 'Something else'
      });
      const { ['site:localhost']: site } = await chrome.storage.sync.get('site:localhost');
      const r = site.rules.find((x) => x.id === 'r_sidebar');
      return { ok: res.ok, selector: r.selector, label: r.label, stale: r.staleCount };
    });
    check('replaceRule swaps the selector and keeps the label',
      replaced.ok && replaced.selector === 'aside#sidebar' && replaced.label === 'Trending sidebar' && replaced.stale === 0);
    await page.waitForSelector('#sidebar.bd-blurred', { timeout: 5000 });
    check('repaired rule still blurs the sidebar', true);

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

    // ---- 7. what's new card shows once after an update ----
    await sw.evaluate(() => chrome.storage.local.set({ whatsNew: { version: '1.1.0', seen: false } }));
    {
      const pg = await ctx.newPage();
      await pg.goto(`chrome-extension://${extId}/popup/popup.html`);
      await sleep(600);
      const shown = await pg.$eval('#whatsNew', (el) => !el.classList.contains('hidden'));
      const items = await pg.locator('#whatsNewList li').count();
      check(`what's new card shown after update (${items} notes)`, shown && items === 3);
      await pg.click('#whatsNewOk');
      await sleep(300);
      const seen = await sw.evaluate(async () => (await chrome.storage.local.get('whatsNew')).whatsNew.seen);
      check('"Got it" marks the notes as seen', seen === true);
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
