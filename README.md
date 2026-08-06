# Softspot: Blur Distractions, Hide Feeds & Focus

Point at anything on any website and blur it, permanently. Feeds, sidebars,
comments, thumbnails. The content is still there if you truly need it, but it
costs a deliberate hold-to-peek to see. A small pause between impulse and action.

**v1 implementation of the [product spec](docs/SPEC.md).** Manifest V3, works in
Chrome and Edge from the same package.

## Load it (dev)

1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select the `src/` directory
3. Press `Alt+B` on any http(s) page, click an element, done.

## How it works

```
src/
  manifest.json
  background.js         service worker: commands, storage, free tier, licensing,
                        host-permission + dynamic content-script management
  content/
    picker.js           element picker overlay (hover highlight, click to blur,
                        Esc cancels, Undo toast)
    blur.js             applies rules on load; MutationObserver (250ms debounce)
                        + SPA URL-change handling; peek overlay w/ hold-to-confirm
    blur.css            blur styles, peek button + progress ring, picker outline
  popup/                per-site rule list, toggles, presets, pause, upgrade
  options/              peek timing (Pro), blur intensity, backup (Pro)
  onboarding/           first-run page: 3 steps + one-click presets
  lib/
    ExtPay.js           ExtensionPay client (vendored)
    selector.js         robust CSS selector generation (specific + generalized)
    presets.js          hand-tuned bundles for the 6 launch sites
```

### Key design decisions

- **Permission model:** no `<all_urls>` at install. The picker session runs on
  `activeTab` + `scripting`; when the first rule is created on a site, the
  extension requests that site's host permission and registers a dynamic
  content script (`chrome.scripting.registerContentScripts`) so blurring
  persists on future loads. If the gesture doesn't survive the message hop,
  the popup shows an explicit "Enable on this site" fallback button.
- **Blur mechanism:** class-based rules in an injected stylesheet
  (`filter: blur(var(--bd-blur-px)) grayscale(40%)`, 200 ms transition).
  Interaction with blurred content is blocked by a transparent per-element
  overlay (document-absolute, so it scrolls with the page) which also hosts
  the peek button. This keeps hover working while making blurred content
  unclickable.
- **Peek friction:** hover → 👁 button → press-and-hold (default 1.5 s,
  progress ring) → content reveals for 10 s → re-blurs. Keyboard users can
  focus the button and press Enter (no hold) for accessibility.
- **Selectors:** prefer stable ids/`data-testid`/`aria-label`/semantic tags;
  reject generated ids and hashed/utility classes; shortest unique path from
  the nearest stable anchor (max depth 5). Both a specific and a generalized
  selector are stored; apply tries specific first and falls back. Rules that
  match nothing on 3 consecutive loads get a ⚠️ in the popup, never deleted.
- **Storage:** `chrome.storage.sync`, one key per site (`site:<host>`) to stay
  under the 8 KB/item limit; ~200 rules cap total.
- **Free tier:** unlimited rules on 2 sites (counted as sites with ≥1 enabled
  rule, oldest first). Rules created beyond that are stored but inactive until
  upgrade; user data is never deleted. Paywall appears exactly once: when the
  user tries to blur on a third site.

## Monetization setup (before shipping)

Licensing uses [ExtensionPay](https://extensionpay.com). Before release:

1. Register the extension at extensionpay.com with id **`blur-distractions`**
   (or change the id passed to `ExtPay(...)` in `background.js`, `popup/popup.js`,
   and `options/options.js`).
2. Set the one-time price (4.99 USD).
3. The `https://extensionpay.com/*` host permission and content script in the
   manifest are required by ExtPay, so leave them in place.

The product name is Softspot; the ExtPay id string stays `blur-distractions` because that is the id registered on extensionpay.com. Until the id is registered, licensing calls fail closed to the free tier
(cached last-known status, 1.5 s timeout), so development works offline.

## Testing

`test/` contains a Playwright smoke test that loads the extension into
Chromium, creates a rule through the real background pipeline, and verifies
blurring, mutation re-application, and the peek flow on a fixture page:

```bash
cd test && npm install && node smoke.test.js
# If Playwright's managed browser isn't installed, point at any Chromium:
#   BD_CHROMIUM=/path/to/chrome node smoke.test.js
```

Manual QA checklist lives in the spec (§5): SPA route changes, infinite
scroll, dark-mode picker outline, stale flags, keyboard-only peek,
CSP-strict sites, revoked permissions.

## Store listing

Draft copy, screenshots plan, and category choice are in the spec (§6).
Same package submits to Chrome Web Store and Edge Add-ons.
