/* popup.js: rule list for the current site, toggles, presets, pause, upgrade. */
'use strict';

const extpay = ExtPay('blur-distractions');
const { findPresetForHost, presetItemToRule } = window.__bdPresets;

const $ = (id) => document.getElementById(id);
const send = (msg) => new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));

const ui = {
  tab: null,
  host: null,
  site: null,
  locked: false,
  paid: false,
  settings: null
};

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  ui.tab = tab;
  try {
    const url = new URL(tab.url);
    if (!/^https?:$/.test(url.protocol)) throw new Error('unsupported');
    ui.host = url.hostname;
  } catch {
    $('unsupported').classList.remove('hidden');
    await refreshGlobal();
    return;
  }
  $('siteSection').classList.remove('hidden');
  $('siteHost').textContent = ui.host;
  await refresh();
}

async function refresh() {
  const res = await send({ type: 'rules:get', host: ui.host });
  if (!res) return;
  ui.site = res.site;
  ui.locked = res.locked;
  ui.paid = res.paid;
  ui.settings = res.settings;
  await refreshGlobal();
  renderSite();
  renderRules();
  await renderPermissionBanner();
  renderPresets();
}

async function refreshGlobal() {
  const res = await send({ type: 'sites:list' });
  if (!res || !res.ok) return;
  ui.paid = res.paid;
  $('upgradeBtn').classList.toggle('hidden', ui.paid);
  const s = await send({ type: 'rules:get', host: ui.host || 'none.invalid' });
  const paused = s && s.settings && s.settings.pausedNow;
  $('pauseBanner').classList.toggle('hidden', !paused);
  $('pauseBtn').classList.toggle('hidden', !!paused);
}

function renderSite() {
  $('siteToggle').checked = ui.site ? ui.site.enabled : true;
  $('lockedBanner').classList.toggle('hidden', !ui.locked);
}

function renderRules() {
  const list = $('ruleList');
  list.innerHTML = '';
  const rules = (ui.site && ui.site.rules) || [];
  $('noRules').classList.toggle('hidden', rules.length > 0);

  for (const rule of rules) {
    const li = document.createElement('li');
    li.classList.toggle('disabled', !rule.enabled);

    const toggle = document.createElement('label');
    toggle.className = 'switch';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = rule.enabled;
    cb.addEventListener('change', async () => {
      await send({ type: 'rule:update', host: ui.host, ruleId: rule.id, patch: { enabled: cb.checked } });
      refresh();
    });
    const slider = document.createElement('span');
    slider.className = 'slider';
    toggle.append(cb, slider);

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = rule.label || rule.selector;
    label.title = rule.selector;

    const edit = document.createElement('button');
    edit.className = 'icon-btn';
    edit.textContent = '✎';
    edit.title = 'Rename';
    edit.addEventListener('click', () => {
      const input = document.createElement('input');
      input.value = rule.label || '';
      label.textContent = '';
      label.appendChild(input);
      input.focus();
      input.select();
      const commit = async () => {
        const v = input.value.trim();
        if (v && v !== rule.label) {
          await send({ type: 'rule:update', host: ui.host, ruleId: rule.id, patch: { label: v } });
        }
        refresh();
      };
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') { input.value = rule.label; input.blur(); }
      });
    });

    const del = document.createElement('button');
    del.className = 'icon-btn';
    del.textContent = '✕';
    del.title = 'Delete rule';
    del.addEventListener('click', async () => {
      await send({ type: 'rule:delete', host: ui.host, ruleId: rule.id });
      refresh();
    });

    li.append(toggle, label);
    if ((rule.staleCount || 0) >= 3) {
      const stale = document.createElement('span');
      stale.className = 'stale';
      stale.textContent = '⚠️';
      stale.title = "This rule hasn't matched anything on the last few page loads. The site may have changed.";
      li.appendChild(stale);
    }
    li.append(edit, del);
    list.appendChild(li);
  }
}

async function renderPermissionBanner() {
  const hasRules = ui.site && ui.site.rules.length > 0;
  let show = false;
  if (hasRules && !ui.locked) {
    const granted = await chrome.permissions.contains({ origins: [`*://${ui.host}/*`] });
    show = !granted;
  }
  $('permissionBanner').classList.toggle('hidden', !show);
}

function renderPresets() {
  const preset = findPresetForHost(ui.host);
  $('presetBlock').classList.toggle('hidden', !preset);
  if (!preset) return;
  $('presetTitle').textContent = `${preset.name} presets`;
  const list = $('presetList');
  list.innerHTML = '';
  const existing = new Set(((ui.site && ui.site.rules) || []).map((r) => r.id));

  for (const item of preset.items) {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = item.label;
    li.appendChild(label);

    if (existing.has('p_' + item.id)) {
      const added = document.createElement('span');
      added.className = 'added';
      added.textContent = 'Added ✓';
      li.appendChild(added);
    } else {
      const btn = document.createElement('button');
      btn.className = 'chip';
      btn.textContent = '+ Blur';
      btn.addEventListener('click', async () => {
        // Permission request must ride the click gesture in this page.
        try { await chrome.permissions.request({ origins: [`*://${ui.host}/*`] }); } catch { /* declined */ }
        const res = await send({ type: 'preset:apply', host: ui.host, rules: [presetItemToRule(item)] });
        if (res && res.ok && !res.locked) await send({ type: 'permission:granted', host: ui.host });
        refresh();
      });
      li.appendChild(btn);
    }
    list.appendChild(li);
  }
}

// ---------- static handlers ----------

$('pickBtn').addEventListener('click', async () => {
  await send({ type: 'picker:start', tabId: ui.tab.id });
  window.close();
});

$('siteToggle').addEventListener('change', async (e) => {
  if (!ui.site) return;
  await send({ type: 'site:toggle', host: ui.host, enabled: e.target.checked });
  refresh();
});

$('grantBtn').addEventListener('click', async () => {
  const granted = await chrome.permissions.request({ origins: [`*://${ui.host}/*`] });
  if (granted) await send({ type: 'permission:granted', host: ui.host });
  refresh();
});

$('pauseBtn').addEventListener('click', () => $('pauseMenu').classList.toggle('hidden'));
document.querySelectorAll('#pauseMenu button').forEach((b) =>
  b.addEventListener('click', async () => {
    $('pauseMenu').classList.add('hidden');
    const minutes = Number(b.dataset.minutes) || 0;
    await send({ type: 'pause:set', paused: true, minutes });
    $('pauseText').textContent = minutes ? `Paused. Resumes in ${minutes} min.` : 'Paused everywhere.';
    refresh();
  })
);
$('resumeBtn').addEventListener('click', async () => {
  await send({ type: 'pause:set', paused: false });
  refresh();
});

$('unlockBtn').addEventListener('click', () => extpay.openPaymentPage());
$('upgradeBtn').addEventListener('click', () => extpay.openPaymentPage());
$('optionsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('shortcutBtn').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));

init();
