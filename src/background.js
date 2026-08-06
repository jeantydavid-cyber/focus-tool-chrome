/*
 * background.js: service worker.
 * Command handling, storage (chrome.storage.sync, one key per site),
 * free-tier enforcement, host-permission + dynamic content-script management,
 * and ExtensionPay licensing.
 */
'use strict';

importScripts('lib/ExtPay.js', 'lib/presets.js');

const extpay = ExtPay('blur-distractions'); // ExtensionPay extension id: must match extensionpay.com registration
extpay.startBackground();

const FREE_SITE_LIMIT = 2;
const MAX_RULES_TOTAL = 200; // storage.sync headroom (spec §2.4)
const STALE_THRESHOLD = 3;

const DEFAULT_SETTINGS = {
  peekHoldMs: 1500,
  peekDurationS: 10,
  blurPx: 12,
  paused: false,
  pausedUntil: null
};

// ---------- licensing ----------

async function isPaid() {
  try {
    // Never let a slow licensing round-trip delay blurring a page.
    const user = await Promise.race([
      extpay.getUser(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('extpay timeout')), 1500))
    ]);
    await chrome.storage.local.set({ paidCache: !!user.paid });
    return !!user.paid;
  } catch {
    // Offline / ExtensionPay unreachable: fall back to last known status.
    const { paidCache } = await chrome.storage.local.get('paidCache');
    return !!paidCache;
  }
}

extpay.onPaid.addListener(async () => {
  await chrome.storage.local.set({ paidCache: true });
  await notifyAllSites();
});

// ---------- storage helpers ----------

async function getSettings() {
  const { settings } = await chrome.storage.sync.get('settings');
  const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  // Lazily clear an expired "resume in 30 min" pause: no alarms needed.
  if (merged.paused && merged.pausedUntil && Date.now() >= merged.pausedUntil) {
    merged.paused = false;
    merged.pausedUntil = null;
    await chrome.storage.sync.set({ settings: merged });
  }
  return merged;
}

function siteKey(host) {
  return 'site:' + host;
}

async function getSite(host) {
  const key = siteKey(host);
  const data = await chrome.storage.sync.get(key);
  return data[key] || null;
}

async function setSite(host, site) {
  await chrome.storage.sync.set({ [siteKey(host)]: site });
}

async function listSites() {
  const all = await chrome.storage.sync.get(null);
  return Object.entries(all)
    .filter(([k]) => k.startsWith('site:'))
    .map(([, v]) => v)
    .filter((s) => s && s.host);
}

async function bumpMeta(patch) {
  const { meta } = await chrome.storage.sync.get('meta');
  const m = meta || { installDate: Date.now(), ruleCountEverCreated: 0 };
  Object.assign(m, patch);
  await chrome.storage.sync.set({ meta: m });
  return m;
}

// ---------- free tier (spec §2.4/§2.6) ----------

// A site consumes a slot when it has ≥1 enabled rule. The first
// FREE_SITE_LIMIT such sites (by creation time) stay active; later ones are
// locked until upgrade. Rules are never deleted.
function activeSiteHosts(sites) {
  return sites
    .filter((s) => s.rules && s.rules.some((r) => r.enabled))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .map((s) => s.host);
}

async function isLockedHost(host, sites, paid) {
  if (paid) return false;
  sites = sites || (await listSites());
  const active = activeSiteHosts(sites);
  const idx = active.indexOf(host);
  if (idx === -1) return active.length >= FREE_SITE_LIMIT; // would-be new site
  return idx >= FREE_SITE_LIMIT;
}

// ---------- host permissions & registered scripts ----------

function originPatterns(host) {
  return [`*://${host}/*`];
}

async function hasHostPermission(host) {
  try {
    return await chrome.permissions.contains({ origins: originPatterns(host) });
  } catch {
    return false;
  }
}

async function registerSiteScript(host) {
  const id = 'bd-' + host;
  const script = {
    id,
    matches: originPatterns(host),
    js: ['content/blur.js'],
    css: ['content/blur.css'],
    runAt: 'document_idle',
    persistAcrossSessions: true
  };
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
    if (existing.length) return;
    await chrome.scripting.registerContentScripts([script]);
  } catch (e) {
    console.warn('registerSiteScript failed for', host, e);
  }
}

async function unregisterSiteScript(host) {
  try {
    await chrome.scripting.unregisterContentScripts({ ids: ['bd-' + host] });
  } catch { /* not registered */ }
}

/**
 * Try to get persistent access to the site. Works when the triggering user
 * gesture propagated through messaging (Chrome ≥ 116); otherwise the popup
 * offers an explicit "enable on this site" button as fallback.
 */
async function ensureSiteAccess(host) {
  if (await hasHostPermission(host)) {
    await registerSiteScript(host);
    return true;
  }
  try {
    const granted = await chrome.permissions.request({ origins: originPatterns(host) });
    if (granted) {
      await registerSiteScript(host);
      return true;
    }
  } catch (e) {
    console.warn('permissions.request from worker failed (no gesture?):', e.message);
  }
  return false;
}

// Heal registrations after updates/profile sync: every stored site we still
// have permission for should have its content script registered.
async function reconcileRegistrations() {
  const sites = await listSites();
  for (const site of sites) {
    if (site.rules && site.rules.length && (await hasHostPermission(site.host))) {
      await registerSiteScript(site.host);
    }
  }
}

// ---------- tab notifications ----------

async function notifyHostTabs(host) {
  try {
    const tabs = await chrome.tabs.query({ url: `*://${host}/*` });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { type: 'rules:changed' }).catch(() => {});
    }
  } catch { /* no permission for that host: nothing is running there anyway */ }
}

async function notifyAllSites() {
  const sites = await listSites();
  await Promise.all(sites.map((s) => notifyHostTabs(s.host)));
}

// ---------- picker injection ----------

async function startPicker(tab) {
  if (!tab || !tab.id || !/^https?:/.test(tab.url || '')) return;
  try {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content/blur.css'] });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['lib/selector.js', 'content/blur.js', 'content/picker.js']
    });
    await chrome.tabs.sendMessage(tab.id, { type: 'picker:toggle' });
  } catch (e) {
    console.warn('Picker injection failed:', e.message);
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-picker') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await startPicker(tab); // hotkey invocation grants activeTab
});

// ---------- lifecycle ----------

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await bumpMeta({ installDate: Date.now(), ruleCountEverCreated: 0 });
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
  }
  await reconcileRegistrations();
});

chrome.runtime.onStartup.addListener(reconcileRegistrations);

// ---------- rule mutations ----------

async function createRules(host, rules) {
  const paid = await isPaid();
  let site = await getSite(host);
  if (!site) {
    site = { host, enabled: true, createdAt: Date.now(), rules: [] };
  }

  const { meta } = await chrome.storage.sync.get('meta');
  const total = (meta && meta.ruleCountEverCreated) || 0;
  const existingCount = (await listSites()).reduce((n, s) => n + s.rules.length, 0);
  if (existingCount + rules.length > MAX_RULES_TOTAL) {
    return { ok: false, reason: 'limit', message: `Rule limit reached (${MAX_RULES_TOTAL}). Remove some rules first.` };
  }

  for (const rule of rules) {
    if (!site.rules.some((r) => r.id === rule.id)) site.rules.push(rule);
  }
  await setSite(host, site);
  await bumpMeta({ ruleCountEverCreated: total + rules.length });

  const locked = await isLockedHost(host, null, paid);
  let needsPermission = false;
  if (!locked) {
    needsPermission = !(await ensureSiteAccess(host));
  }
  await notifyHostTabs(host);
  return { ok: true, locked, needsPermission };
}

// ---------- message router ----------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg && msg.type) {
      case 'picker:start': {
        let tab = sender.tab;
        if (!tab && msg.tabId) tab = await chrome.tabs.get(msg.tabId);
        if (!tab) [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await startPicker(tab);
        return { ok: true };
      }

      case 'rules:get': {
        const settings = await getSettings();
        const paid = await isPaid();
        const site = await getSite(msg.host);
        const locked = site ? await isLockedHost(msg.host, null, paid) : false;
        return {
          settings: {
            peekHoldMs: settings.peekHoldMs,
            peekDurationS: settings.peekDurationS,
            blurPx: settings.blurPx,
            pausedNow: settings.paused
          },
          site,
          locked,
          paid
        };
      }

      case 'rule:create':
        return await createRules(msg.host, [msg.rule]);

      case 'preset:apply':
        return await createRules(msg.host, msg.rules);

      case 'rule:update': {
        const site = await getSite(msg.host);
        if (!site) return { ok: false };
        const rule = site.rules.find((r) => r.id === msg.ruleId);
        if (!rule) return { ok: false };
        Object.assign(rule, msg.patch);
        await setSite(msg.host, site);
        await notifyHostTabs(msg.host);
        return { ok: true, site };
      }

      case 'rule:delete': {
        const site = await getSite(msg.host);
        if (!site) return { ok: false };
        site.rules = site.rules.filter((r) => r.id !== msg.ruleId);
        if (site.rules.length === 0) {
          await chrome.storage.sync.remove(siteKey(msg.host));
          await unregisterSiteScript(msg.host);
        } else {
          await setSite(msg.host, site);
        }
        await notifyHostTabs(msg.host);
        return { ok: true, site: site.rules.length ? site : null };
      }

      case 'rule:staleReport': {
        const site = await getSite(msg.host);
        if (!site) return { ok: false };
        let changed = false;
        for (const { id, matched } of msg.results || []) {
          const rule = site.rules.find((r) => r.id === id);
          if (!rule) continue;
          const next = matched ? 0 : Math.min((rule.staleCount || 0) + 1, STALE_THRESHOLD + 1);
          if (next !== rule.staleCount) { rule.staleCount = next; changed = true; }
        }
        if (changed) await setSite(msg.host, site);
        return { ok: true };
      }

      case 'site:toggle': {
        const site = await getSite(msg.host);
        if (!site) return { ok: false };
        site.enabled = !!msg.enabled;
        await setSite(msg.host, site);
        await notifyHostTabs(msg.host);
        return { ok: true, site };
      }

      case 'pause:set': {
        const settings = await getSettings();
        settings.paused = !!msg.paused;
        settings.pausedUntil = msg.paused && msg.minutes ? Date.now() + msg.minutes * 60000 : null;
        await chrome.storage.sync.set({ settings });
        await notifyAllSites();
        return { ok: true, settings };
      }

      case 'settings:update': {
        const settings = await getSettings();
        const paid = await isPaid();
        const patch = { ...msg.patch };
        if (!paid) {
          // Peek timing is Pro (spec §2.6); free tier stays on defaults.
          delete patch.peekHoldMs;
          delete patch.peekDurationS;
        }
        Object.assign(settings, patch);
        await chrome.storage.sync.set({ settings });
        await notifyAllSites();
        return { ok: true, settings };
      }

      case 'permission:request': {
        // A click in the page (toast button) rides its user gesture through
        // messaging, which lets the worker show the permission prompt.
        const granted = await ensureSiteAccess(msg.host);
        if (granted) await notifyHostTabs(msg.host);
        return { ok: true, granted };
      }

      case 'permission:granted': {
        // Popup/onboarding already ran chrome.permissions.request successfully.
        await registerSiteScript(msg.host);
        await notifyHostTabs(msg.host);
        return { ok: true };
      }

      case 'sites:list': {
        const paid = await isPaid();
        const sites = await listSites();
        const active = activeSiteHosts(sites);
        return { ok: true, sites, activeHosts: active, paid, freeLimit: FREE_SITE_LIMIT };
      }

      case 'extpay:getUser': {
        return { paid: await isPaid() };
      }

      case 'extpay:openPayment': {
        try { await extpay.openPaymentPage(); } catch (e) { console.warn(e); }
        return { ok: true };
      }

      case 'export:get': {
        const all = await chrome.storage.sync.get(null);
        return { ok: true, data: all };
      }

      case 'import:set': {
        const paid = await isPaid();
        if (!paid) return { ok: false, reason: 'paywall' };
        const data = msg.data || {};
        const clean = {};
        if (data.settings && typeof data.settings === 'object') {
          clean.settings = { ...DEFAULT_SETTINGS, ...data.settings };
        }
        for (const [k, v] of Object.entries(data)) {
          if (k.startsWith('site:') && v && Array.isArray(v.rules) && typeof v.host === 'string') {
            clean[k] = v;
          }
        }
        if (data.meta) clean.meta = data.meta;
        await chrome.storage.sync.set(clean);
        await reconcileRegistrations();
        await notifyAllSites();
        return { ok: true, imported: Object.keys(clean).length };
      }

      default:
        return { ok: false, reason: 'unknown-message' };
    }
  })()
    .then(sendResponse)
    .catch((e) => sendResponse({ ok: false, error: e.message }));
  return true; // async response
});

// Clean up registration if the user revokes a host permission mid-session (QA §5).
chrome.permissions.onRemoved.addListener(async (perms) => {
  for (const origin of perms.origins || []) {
    const m = origin.match(/^[^:]+:\/\/([^/]+)\//);
    if (m) await unregisterSiteScript(m[1].replace(/^\*\./, ''));
  }
});
