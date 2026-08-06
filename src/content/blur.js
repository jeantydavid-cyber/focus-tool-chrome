/*
 * blur.js: applies blur rules on page load, keeps them applied through SPA
 * navigations and lazy loading, and hosts the peek (👁) interaction.
 *
 * Runs either as a registered content script (sites the user granted) or
 * injected on demand during a picker session (activeTab).
 */
(() => {
  'use strict';
  if (window.__bd) return;

  const HOST = location.hostname;
  const DEBOUNCE_MS = 250;
  const STALE_REPORT_DELAY_MS = 4000;
  const MAX_OVERLAYS = 60; // beyond this, elements still blur but get no peek button

  const state = {
    settings: { peekHoldMs: 1500, peekDurationS: 10, blurPx: 12, pausedNow: false },
    site: null,
    locked: false,
    overlays: new Map(),   // element -> overlay div
    blurred: new Set(),    // elements currently carrying .bd-blurred
    peekTimers: new Map(), // element -> {timeout, interval}
    root: null,
    staleReported: false,
    lastUrl: location.href,
    applyQueued: false
  };

  // ---------- data ----------

  function fetchAndApply() {
    try {
      chrome.runtime.sendMessage({ type: 'rules:get', host: HOST }, (res) => {
        if (chrome.runtime.lastError || !res) return;
        state.settings = res.settings;
        state.site = res.site;
        state.locked = res.locked;
        applyRules();
        scheduleStaleReport();
      });
    } catch {
      /* extension reloaded / context invalidated: nothing to do */
    }
  }

  function activeRules() {
    if (!state.site || !state.site.enabled) return [];
    if (state.locked || state.settings.pausedNow) return [];
    return state.site.rules.filter((r) => r.enabled);
  }

  // ---------- applying ----------

  function qsaSafe(sel) {
    try { return [...document.querySelectorAll(sel)]; } catch { return []; }
  }

  function matchRule(rule) {
    let els;
    if (rule.mode === 'generalized' && rule.generalized) {
      els = qsaSafe(rule.generalized);
    } else {
      els = qsaSafe(rule.selector);
      if (els.length === 0 && rule.generalized) els = qsaSafe(rule.generalized); // fallback (spec §2.3.4)
    }
    // Failsafe at apply time: never blur the page itself.
    return els.filter((el) => el !== document.documentElement && el !== document.body && !isOurNode(el));
  }

  function isOurNode(el) {
    return el.id === 'bd-root' || el.id === 'bd-picker-root' ||
      (el.closest && (el.closest('#bd-root') || el.closest('#bd-picker-root')));
  }

  function applyRules() {
    document.documentElement.style.setProperty('--bd-blur-px', (state.settings.blurPx || 12) + 'px');

    const desired = new Set();
    state.lastMatchCounts = {};
    for (const rule of activeRules()) {
      const els = matchRule(rule);
      state.lastMatchCounts[rule.id] = els.length;
      for (const el of els) desired.add(el);
    }
    // Drop nested matches: blurring an ancestor already covers the child.
    for (const el of [...desired]) {
      for (let p = el.parentElement; p; p = p.parentElement) {
        if (desired.has(p)) { desired.delete(el); break; }
      }
    }

    for (const el of [...state.blurred]) {
      if (!desired.has(el) || !el.isConnected) unblurElement(el);
    }
    for (const el of desired) {
      if (!state.blurred.has(el)) blurElement(el);
    }
    repositionOverlays();
  }

  function blurElement(el) {
    el.classList.add('bd-blurred');
    state.blurred.add(el);
    if (state.overlays.size < MAX_OVERLAYS) attachOverlay(el);
  }

  function unblurElement(el) {
    el.classList.remove('bd-blurred', 'bd-peek');
    state.blurred.delete(el);
    clearPeek(el);
    const ov = state.overlays.get(el);
    if (ov) { ov.remove(); state.overlays.delete(el); }
  }

  // ---------- overlays & peek ----------

  function ensureRoot() {
    if (state.root && state.root.isConnected) return state.root;
    let root = document.getElementById('bd-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'bd-root';
      document.documentElement.appendChild(root);
    }
    state.root = root;
    return root;
  }

  function attachOverlay(el) {
    const root = ensureRoot();
    const ov = document.createElement('div');
    ov.className = 'bd-overlay';

    const btn = document.createElement('button');
    btn.className = 'bd-peek-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Reveal blurred content. Hold to confirm, or press Enter.');
    btn.innerHTML =
      '<svg class="bd-peek-ring" viewBox="0 0 18 18" aria-hidden="true">' +
      '<circle class="bd-ring-track" cx="9" cy="9" r="7"></circle>' +
      '<circle class="bd-ring-fill" cx="9" cy="9" r="7"></circle>' +
      '</svg><span>👁 Peek</span>';
    ov.appendChild(btn);

    // Hold-to-confirm: the pause between impulse and action IS the product.
    let holdTimer = null;
    const startHold = (e) => {
      e.preventDefault();
      if (holdTimer) return;
      const ms = state.settings.peekHoldMs;
      btn.querySelector('.bd-ring-fill').style.transition = `stroke-dashoffset ${ms}ms linear`;
      btn.classList.add('bd-holding');
      holdTimer = setTimeout(() => { holdTimer = null; startPeek(el, ov); }, ms);
    };
    const cancelHold = () => {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      btn.classList.remove('bd-holding');
      btn.querySelector('.bd-ring-fill').style.transition = 'none';
    };
    // Layout may have shifted since the last sync; fix alignment the moment
    // the pointer arrives so the peek button never shows over the wrong spot.
    ov.addEventListener('pointerenter', () => positionOverlay(el, ov));
    btn.addEventListener('pointerdown', startHold);
    btn.addEventListener('pointerup', cancelHold);
    btn.addEventListener('pointerleave', cancelHold);
    btn.addEventListener('pointercancel', cancelHold);
    // Keyboard alternative (QA §5): Enter/Space toggles without holding.
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startPeek(el, ov); }
    });
    // Swallow clicks so the page never sees interactions with blurred content.
    ov.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });

    root.appendChild(ov);
    state.overlays.set(el, ov);
    positionOverlay(el, ov);
  }

  function startPeek(el, ov) {
    clearPeek(el);
    el.classList.add('bd-peek');
    ov.classList.add('bd-peeking');
    ov.querySelector('.bd-peek-btn').classList.remove('bd-holding');

    let remaining = state.settings.peekDurationS;
    const chip = document.createElement('button');
    chip.className = 'bd-countdown';
    chip.type = 'button';
    chip.setAttribute('aria-label', 'Re-blur now');
    const renderChip = () => { chip.textContent = `re-blurs in ${remaining}s · click to re-blur`; };
    renderChip();
    chip.addEventListener('click', (e) => { e.stopPropagation(); endPeek(el, ov); });
    ov.appendChild(chip);

    const interval = setInterval(() => { remaining -= 1; if (remaining > 0) renderChip(); }, 1000);
    const timeout = setTimeout(() => endPeek(el, ov), state.settings.peekDurationS * 1000);
    state.peekTimers.set(el, { timeout, interval, chip });
  }

  function endPeek(el, ov) {
    clearPeek(el);
    el.classList.remove('bd-peek'); // 200ms transition re-blurs it gently
    ov.classList.remove('bd-peeking');
  }

  function clearPeek(el) {
    const t = state.peekTimers.get(el);
    if (t) {
      clearTimeout(t.timeout);
      clearInterval(t.interval);
      t.chip.remove();
      state.peekTimers.delete(el);
    }
  }

  function positionOverlay(el, ov) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) { ov.style.display = 'none'; return; }
    ov.style.display = '';
    ov.style.top = r.top + window.scrollY + 'px';
    ov.style.left = r.left + window.scrollX + 'px';
    ov.style.width = r.width + 'px';
    ov.style.height = r.height + 'px';
  }

  let repositionScheduled = false;
  function repositionOverlays() {
    if (repositionScheduled) return;
    repositionScheduled = true;
    requestAnimationFrame(() => {
      repositionScheduled = false;
      for (const [el, ov] of state.overlays) {
        if (!el.isConnected) { unblurElement(el); continue; }
        positionOverlay(el, ov);
      }
    });
  }

  // ---------- observers (SPA + lazy content, spec §2.1) ----------

  function scheduleApply() {
    if (state.applyQueued) return;
    state.applyQueued = true;
    setTimeout(() => {
      state.applyQueued = false;
      if (location.href !== state.lastUrl) {
        // SPA route change: re-evaluate everything.
        state.lastUrl = location.href;
        state.staleReported = true; // don't stale-count mid-navigation
      }
      applyRules();
    }, DEBOUNCE_MS);
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.target && isOurNode(m.target)) continue;
      scheduleApply();
      return;
    }
  });

  function startObserving() {
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('resize', repositionOverlays, { passive: true });
    // Inner scroll containers (feeds in scrollable divs) shift layout under
    // document-absolute overlays; document scrolling doesn't.
    window.addEventListener('scroll', (e) => {
      if (e.target !== document) repositionOverlays();
    }, { passive: true, capture: true });
    window.addEventListener('popstate', scheduleApply);
    if (window.navigation && window.navigation.addEventListener) {
      window.navigation.addEventListener('navigatesuccess', scheduleApply);
    }
    // Sites like YouTube move content without mutating near the blurred
    // element (player resizes, lazy images settle). A cheap heartbeat plus a
    // page-level ResizeObserver keeps the peek zones glued to their elements.
    if (window.ResizeObserver) {
      new ResizeObserver(repositionOverlays).observe(document.documentElement);
    }
    setInterval(() => { if (state.overlays.size) repositionOverlays(); }, 700);
  }

  // ---------- stale tracking (spec §2.3.4) ----------

  function scheduleStaleReport() {
    if (state.staleReported) return;
    state.staleReported = true;
    setTimeout(() => {
      if (!state.site || state.locked || state.settings.pausedNow || !state.site.enabled) return;
      const results = activeRules().map((r) => ({
        id: r.id,
        matched: (state.lastMatchCounts && state.lastMatchCounts[r.id] > 0) || matchRule(r).length > 0
      }));
      if (results.length) {
        try { chrome.runtime.sendMessage({ type: 'rule:staleReport', host: HOST, results }); } catch { /* ignore */ }
      }
    }, STALE_REPORT_DELAY_MS);
  }

  // ---------- messages ----------

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && (msg.type === 'rules:changed' || msg.type === 'settings:changed')) {
      fetchAndApply();
    }
  });

  window.__bd = {
    refresh: fetchAndApply,
    setPicking(on) { ensureRoot().classList.toggle('bd-picking', !!on); }
  };

  // ---------- boot ----------

  function boot() {
    startObserving();
    fetchAndApply();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
