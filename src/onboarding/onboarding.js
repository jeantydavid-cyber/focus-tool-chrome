/* onboarding.js — one-click presets on the first-run page. */
'use strict';

const { PRESETS, presetItemToRule } = window.__bdPresets;
const send = (msg) => new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));

document.querySelectorAll('.presets button').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const preset = PRESETS.find((p) => p.id === btn.dataset.preset);
    const host = btn.dataset.host;
    if (!preset) return;

    // Ask for the site's host permission while we still have the click gesture.
    let granted = false;
    try {
      granted = await chrome.permissions.request({ origins: [`*://${host}/*`] });
    } catch { /* declined */ }

    const rules = preset.items.map((item) => presetItemToRule(item));
    const res = await send({ type: 'preset:apply', host, rules });

    if (res && res.ok) {
      if (granted) await send({ type: 'permission:granted', host });
      btn.classList.add('done');
      btn.textContent = res.locked
        ? '✓ Saved (unlock Pro to activate)'
        : `✓ ${preset.name} calmed`;
      btn.disabled = true;
    }
  });
});
