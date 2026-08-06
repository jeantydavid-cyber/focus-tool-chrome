/*
 * picker.js — element picker overlay (spec §2.2).
 * Injected on demand (hotkey or popup button) together with selector.js and
 * blur.js. Hover highlights, click blurs, Esc cancels.
 */
(() => {
  'use strict';
  if (window.__bdPicker) {
    return; // already loaded; background sends picker:toggle separately
  }

  const S = window.__bdSelector;
  const VIEWPORT_FAILSAFE = 0.85; // spec §3: reject elements covering >85% of viewport

  const picker = {
    active: false,
    root: null,
    highlight: null,
    label: null,
    hint: null,
    hovered: null,
    toastTimer: null,
    lastRule: null
  };

  function ensureRoot() {
    if (picker.root && picker.root.isConnected) return picker.root;
    let root = document.getElementById('bd-picker-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'bd-picker-root';
      document.documentElement.appendChild(root);
    }
    picker.root = root;
    return root;
  }

  // ---------- activation ----------

  function activate() {
    if (picker.active) return;
    picker.active = true;
    const root = ensureRoot();

    picker.highlight = document.createElement('div');
    picker.highlight.className = 'bd-picker-highlight';
    picker.highlight.style.display = 'none';
    root.appendChild(picker.highlight);

    picker.label = document.createElement('div');
    picker.label.className = 'bd-picker-label';
    picker.label.style.display = 'none';
    root.appendChild(picker.label);

    picker.hint = document.createElement('div');
    picker.hint.className = 'bd-picker-hint';
    picker.hint.innerHTML = 'Click an element to blur it · <kbd>Esc</kbd> to cancel';
    root.appendChild(picker.hint);

    if (window.__bd) window.__bd.setPicking(true); // let clicks pass through blur overlays

    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('mousedown', swallow, true);
    window.addEventListener('mouseup', swallow, true);
    window.addEventListener('pointerdown', swallow, true);
    window.addEventListener('keydown', onKey, true);
    document.documentElement.style.cursor = 'crosshair';
  }

  function deactivate() {
    if (!picker.active) return;
    picker.active = false;
    for (const el of [picker.highlight, picker.label, picker.hint]) el && el.remove();
    picker.highlight = picker.label = picker.hint = null;
    picker.hovered = null;
    if (window.__bd) window.__bd.setPicking(false);
    window.removeEventListener('mousemove', onMove, true);
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('mousedown', swallow, true);
    window.removeEventListener('mouseup', swallow, true);
    window.removeEventListener('pointerdown', swallow, true);
    window.removeEventListener('keydown', onKey, true);
    document.documentElement.style.cursor = '';
  }

  // ---------- events ----------

  function swallow(e) {
    if (!picker.active) return;
    e.preventDefault();
    e.stopPropagation();
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      deactivate();
    }
  }

  function isOurNode(el) {
    return el && el.closest && (el.closest('#bd-picker-root') || el.closest('#bd-root') || el.closest('.bd-toast'));
  }

  function onMove(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || isOurNode(el) || el === document.documentElement || el === document.body) {
      picker.hovered = null;
      if (picker.highlight) picker.highlight.style.display = 'none';
      if (picker.label) picker.label.style.display = 'none';
      return;
    }
    if (el === picker.hovered) return;
    picker.hovered = el;

    const r = el.getBoundingClientRect();
    Object.assign(picker.highlight.style, {
      display: 'block',
      top: r.top + 'px',
      left: r.left + 'px',
      width: r.width + 'px',
      height: r.height + 'px'
    });
    picker.label.style.display = 'block';
    picker.label.textContent = S.describe(el);
    const labelTop = r.top > 34 ? r.top - 28 : Math.min(r.bottom + 6, window.innerHeight - 30);
    picker.label.style.top = labelTop + 'px';
    picker.label.style.left = Math.max(6, r.left) + 'px';
  }

  function tooBig(el) {
    if (el === document.body || el === document.documentElement) return true;
    const r = el.getBoundingClientRect();
    const cover = (Math.min(r.width, window.innerWidth) * Math.min(r.height, window.innerHeight)) /
      (window.innerWidth * window.innerHeight);
    return cover > VIEWPORT_FAILSAFE;
  }

  function onClick(e) {
    if (!picker.active) return;
    e.preventDefault();
    e.stopPropagation();
    const el = picker.hovered || document.elementFromPoint(e.clientX, e.clientY);
    if (!el || isOurNode(el)) return;

    // Failsafe (spec §3)
    if (tooBig(el)) {
      toast('That would blur the whole page — pick something smaller.', []);
      return;
    }

    const selector = S.getSpecific(el);
    if (!selector) {
      toast("Couldn't build a stable selector for that element.", []);
      return;
    }
    const generalized = S.getGeneralized(el, selector);
    const rule = {
      id: 'r_' + Math.random().toString(36).slice(2, 8),
      selector,
      generalized,
      mode: 'specific',
      label: S.makeLabel(el),
      createdAt: Date.now(),
      enabled: true,
      staleCount: 0,
      source: 'user'
    };
    picker.lastRule = rule;
    deactivate();

    chrome.runtime.sendMessage({ type: 'rule:create', host: location.hostname, rule }, (res) => {
      if (chrome.runtime.lastError || !res) {
        toast('Something went wrong saving that rule.', []);
        return;
      }
      if (res.locked) {
        // Paywall moment (spec §2.6) — the rule is saved, just inactive.
        toast("You've got focus working on 2 sites. Unlock every site — one-time payment, yours forever.", [
          { text: 'Unlock', onClick: () => chrome.runtime.sendMessage({ type: 'extpay:openPayment' }) }
        ], 12000);
        return;
      }
      if (window.__bd) window.__bd.refresh();
      const buttons = [
        { text: 'Undo', secondary: true, onClick: () => undoRule(rule) }
      ];
      if (generalized) {
        buttons.push({ text: 'Blur all similar', onClick: () => blurAllSimilar(rule) });
      }
      toast(`Blurred “${rule.label}”.`, buttons);
    });
  }

  // ---------- toast actions ----------

  function undoRule(rule) {
    chrome.runtime.sendMessage({ type: 'rule:delete', host: location.hostname, ruleId: rule.id }, () => {
      if (window.__bd) window.__bd.refresh();
      toast('Removed.', [], 2500);
    });
  }

  function blurAllSimilar(rule) {
    chrome.runtime.sendMessage(
      { type: 'rule:update', host: location.hostname, ruleId: rule.id, patch: { mode: 'generalized' } },
      () => {
        if (window.__bd) window.__bd.refresh();
        let count = 0;
        try { count = document.querySelectorAll(rule.generalized).length; } catch { /* ignore */ }
        toast(count > 1 ? `Blurred ${count} similar items.` : 'Blurred all similar items.', [
          { text: 'Undo', secondary: true, onClick: () => undoRule(rule) }
        ]);
      }
    );
  }

  function toast(text, buttons, ttl = 6000) {
    const root = ensureRoot();
    const old = root.querySelector('.bd-toast');
    if (old) old.remove();
    if (picker.toastTimer) clearTimeout(picker.toastTimer);

    const t = document.createElement('div');
    t.className = 'bd-toast';
    const span = document.createElement('span');
    span.textContent = text;
    t.appendChild(span);
    for (const b of buttons || []) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = b.text;
      if (b.secondary) btn.className = 'bd-secondary';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        t.remove();
        b.onClick();
      });
      t.appendChild(btn);
    }
    root.appendChild(t);
    picker.toastTimer = setTimeout(() => t.remove(), ttl);
  }

  // ---------- messages ----------

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'picker:toggle') {
      picker.active ? deactivate() : activate();
    }
  });

  // Activation happens via the picker:toggle message the background sends
  // right after injection (keeps hotkey toggling symmetrical).
  window.__bdPicker = { activate, deactivate };
})();
