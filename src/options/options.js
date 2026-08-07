/* options.js: peek timing (Pro), blur intensity, shortcut info, export/import. */
'use strict';

const extpay = ExtPay('blur-distractions');
const $ = (id) => document.getElementById(id);
const send = (msg) => new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));

let paid = false;

async function init() {
  const res = await send({ type: 'rules:get', host: 'none.invalid' });
  const user = await send({ type: 'extpay:getUser' });
  paid = !!(user && user.paid);
  const s = res.settings;

  $('planLine').textContent = paid
    ? 'Pro: every site unlocked. Thank you for supporting an indie tool. ✨'
    : 'Free plan: blur on up to 2 sites.';
  $('upgradeSection').classList.toggle('hidden', paid);
  $('manageBtn').classList.toggle('hidden', !paid);
  $('proTag').classList.toggle('hidden', paid);
  $('proNote').classList.toggle('hidden', paid);

  $('peekHold').value = s.peekHoldMs;
  $('peekDuration').value = s.peekDurationS;
  renderOutputs();
  const peekSection = $('peekHold').closest('section');
  if (!paid) {
    peekSection.classList.add('locked');
    $('peekHold').disabled = true;
    $('peekDuration').disabled = true;
  }

  const radio = document.querySelector(`input[name="blurPx"][value="${s.blurPx}"]`);
  if (radio) radio.checked = true;

  if (!paid) {
    $('exportBtn').disabled = true;
    $('importBtn').disabled = true;
    $('backupStatus').textContent = 'Backup is a Pro feature.';
  }

  await renderSites();
}

async function renderSites() {
  const res = await send({ type: 'sites:list' });
  const list = $('siteList');
  list.innerHTML = '';
  const sites = (res && res.ok && res.sites) || [];
  sites.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  $('noSites').classList.toggle('hidden', sites.length > 0);

  for (const site of sites) {
    const pos = res.activeHosts.indexOf(site.host);
    const locked = !res.paid && pos >= res.freeLimit;

    const li = document.createElement('li');

    const toggle = document.createElement('label');
    toggle.className = 'switch';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = site.enabled;
    cb.addEventListener('change', async () => {
      await send({ type: 'site:toggle', host: site.host, enabled: cb.checked });
      renderSites();
    });
    const slider = document.createElement('span');
    slider.className = 'slider';
    toggle.append(cb, slider);

    const name = document.createElement('span');
    name.className = 'site-name';
    name.textContent = site.host;

    const count = document.createElement('span');
    count.className = 'site-count';
    const n = site.rules.length;
    count.textContent = `${n} blur${n === 1 ? '' : 's'}`;

    li.append(toggle, name, count);

    if (locked) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'Locked (free plan)';
      badge.title = 'The free plan covers 2 sites. Upgrade to activate this one.';
      li.appendChild(badge);
    }

    const del = document.createElement('button');
    del.className = 'icon-btn';
    del.textContent = '✕';
    del.title = `Remove all blurs on ${site.host}`;
    del.addEventListener('click', async () => {
      if (!confirm(`Remove all ${n} blur${n === 1 ? '' : 's'} on ${site.host}?`)) return;
      await send({ type: 'site:delete', host: site.host });
      renderSites();
    });
    li.appendChild(del);

    list.appendChild(li);
  }
}

function renderOutputs() {
  $('peekHoldOut').textContent = (Number($('peekHold').value) / 1000).toFixed(1) + ' s';
  $('peekDurationOut').textContent = $('peekDuration').value + ' s';
}

async function saveSetting(patch) {
  await send({ type: 'settings:update', patch });
}

$('peekHold').addEventListener('input', renderOutputs);
$('peekDuration').addEventListener('input', renderOutputs);
$('peekHold').addEventListener('change', () => saveSetting({ peekHoldMs: Number($('peekHold').value) }));
$('peekDuration').addEventListener('change', () => saveSetting({ peekDurationS: Number($('peekDuration').value) }));

document.querySelectorAll('input[name="blurPx"]').forEach((r) =>
  r.addEventListener('change', () => saveSetting({ blurPx: Number(r.value) }))
);

$('shortcutBtn').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));
$('upgradeBtn').addEventListener('click', () => extpay.openPaymentPage());
$('manageBtn').addEventListener('click', () => extpay.openPaymentPage());
$('restoreBtn').addEventListener('click', () => extpay.openPaymentPage());
$('upgradeInline').addEventListener('click', () => extpay.openPaymentPage());

$('exportBtn').addEventListener('click', async () => {
  const res = await send({ type: 'export:get' });
  if (!res || !res.ok) return;
  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'softspot-rules.json';
  a.click();
  URL.revokeObjectURL(a.href);
  $('backupStatus').textContent = 'Exported.';
});

$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const res = await send({ type: 'import:set', data });
    $('backupStatus').textContent = res && res.ok
      ? `Imported ${res.imported} entries. Sites you blur will re-ask for access on first visit.`
      : 'Import failed' + (res && res.reason === 'paywall' ? ' (Pro feature).' : '.');
  } catch {
    $('backupStatus').textContent = "That file doesn't look like a Softspot export.";
  }
  e.target.value = '';
});

init();
