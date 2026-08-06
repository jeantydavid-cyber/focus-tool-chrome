# Blur Distractions — ADHD Focus
## v1 Product & Technical Specification

**Working name:** Blur Distractions – Hide Feeds & Focus (ADHD)
*Rationale: Chrome Web Store search is the primary traffic source. The name front-loads the highest-volume search terms ("blur", "distractions", "hide feeds", "focus", "ADHD") while staying honest. Final name must be ≤75 chars.*

**One-line pitch:** Point at anything on any website and blur it — permanently. Feeds, sidebars, comments, thumbnails. The content is still there if you truly need it, but it costs a deliberate click to see. A small pause between impulse and action.

**Positioning vs. incumbents:** Existing tools (SocialFocus, Unhook, News Feed Eradicator) *remove* elements via hardcoded per-site rules. This tool *blurs* — softer, works on ANY site via a universal element picker, and the click-to-peek friction is the feature, not a workaround. No shame, no hard blocks, no broken layouts.

---

## 1. Core user stories (v1 scope — nothing more)

1. As a user, I press a hotkey (default `Alt+B`) or click the toolbar icon → "Select element to blur". My cursor becomes a picker; hovering highlights elements with a colored outline; clicking blurs that element.
2. As a user, my blurs persist: same element stays blurred on reload and on other pages of the same site where the element appears.
3. As a user, I can hover a blurred element and click a small "peek" button (👁) to temporarily reveal it for N seconds (default 10s, configurable), after a short hold-to-confirm delay (default 1.5s — this delay IS the product).
4. As a user, I can open the popup to see my blur list for the current site, toggle individual rules, toggle the whole site, or pause the extension globally.
5. As a user, I can apply one-click presets for the top offender sites (see §4).
6. As a user, my rules sync across my Chrome profile devices.

**Explicitly OUT of v1:** AI/automatic detection of "what matters", scheduling/focus sessions, stats dashboards, mobile, Firefox port (Edge port IS in scope — same code).

---

## 2. Architecture (Manifest V3)

```
/src
  manifest.json
  background.js         (service worker: command handling, storage, licensing)
  content/
    picker.js           (element picker overlay + selector generation)
    blur.js             (applies blur rules on page load + MutationObserver)
    blur.css            (blur styles, peek button, picker outline)
  popup/
    popup.html/js/css   (rule list, toggles, presets, upgrade button)
  options/
    options.html/js     (peek delay, blur intensity, hotkey info, export/import)
  lib/
    ExtPay.js           (ExtensionPay client)
    selector.js         (robust CSS selector generator — shared)
    presets.js          (built-in site presets)
```

### 2.1 Blur mechanism
- Apply via injected stylesheet, not inline styles (survives some framework re-renders, cheaper):
  `filter: blur(12px) grayscale(40%); pointer-events: none;` on matched elements, wrapped so the peek button (a positioned sibling/overlay) remains clickable.
- Blur intensity configurable in options (6/12/20px). Add `transition: filter 200ms` for peek reveal.
- **Important:** set `pointer-events: none` on blurred content so users can't interact with what they can't read (prevents accidental clicks on blurred feeds), but the peek overlay must capture events.
- Use a `MutationObserver` (debounced ~250ms) to re-apply rules on SPA navigations and lazy-loaded content (YouTube, Twitter/X, LinkedIn are all SPAs — this is non-negotiable).
- Also listen for `history.pushState`/URL changes (via `navigation` API or observer on `document.title`) to re-evaluate rules on SPA route changes.

### 2.2 Element picker (`picker.js`)
- Activated by hotkey (`chrome.commands`) or popup button → message to content script.
- On mousemove: outline hovered element (`outline: 2px solid` + translucent overlay div, never modify the element itself).
- `Esc` cancels. Click selects. After click, show a tiny confirmation toast: "Blurred. [Undo] [Blur all similar]".
- **"Blur all similar"**: generalizes the selector (drop nth-child / IDs that look generated) so all sibling cards/posts in a feed get blurred, not just one post. This is the difference between a toy and a tool.

### 2.3 Selector generation (`selector.js`) — the hard 20%
Generated selectors must survive page reloads and dynamic class names:
1. Prefer stable attributes in priority order: `id` (only if not auto-generated — reject ids matching `/\d{3,}|^:|uuid/`), `data-testid`, `aria-label`, `role`, semantic tags (`nav`, `aside`), then class combinations.
2. Reject utility/atomic classes (Tailwind-like: short, many per element) and hashed classes (`/^[a-z]+-[a-z0-9]{5,}$/`, `css-xxxxx`).
3. Build shortest unique path from nearest stable ancestor, max depth 5.
4. Store BOTH the specific selector and the generalized one; `blur.js` tries specific first, falls back to generalized, and marks a rule "stale" (shown in popup with ⚠️) if it matches 0 elements for 3 consecutive page loads.

### 2.4 Storage schema (`chrome.storage.sync`)
```json
{
  "settings": { "peekHoldMs": 1500, "peekDurationS": 10, "blurPx": 12, "paused": false },
  "sites": {
    "www.youtube.com": {
      "enabled": true,
      "rules": [
        { "id": "r_8f3a", "selector": "#related", "generalized": null,
          "label": "Related videos", "createdAt": 1754400000, "enabled": true,
          "staleCount": 0, "source": "user" }
      ]
    }
  },
  "meta": { "installDate": 1754400000, "ruleCountEverCreated": 3 }
}
```
- `storage.sync` quota is 100KB total / 8KB per item → store each site under its own key (`site:www.youtube.com`) to stay under item limits. Cap ~200 rules total in v1; show a friendly limit message (free tier will hit its cap long before this).
- Free tier limit is enforced in `background.js`, counted as **number of sites with ≥1 active rule** (2 sites free). Presets count. Rules beyond the limit are stored but inactive until upgrade (never delete user data).

### 2.5 Permissions (keep review fast, users unafraid)
```json
"permissions": ["storage", "activeTab", "scripting"],
"optional_host_permissions": ["<all_urls>"],
"commands": { "toggle-picker": { "suggested_key": { "default": "Alt+B" } } }
```
- **Do NOT request `<all_urls>` at install.** Use `activeTab` + `scripting` for the picker session, then request the specific site's host permission (`chrome.permissions.request`) the first time the user creates a rule on it, so persistent blurring works there on future loads. This keeps the install prompt clean ("no warning" tier) and is a trust differentiator — say so in the listing.
- No remote code, no analytics in v1 (privacy is a selling point for this audience; also speeds review). If you must know usage later, add opt-in only.

### 2.6 Monetization (ExtensionPay)
- Integrate `ExtPay('blur-distractions')` in background + popup per ExtensionPay docs.
- **Free:** unlimited rules on up to 2 sites, all presets browsable but activable on those 2 sites only.
- **Pro — €19 one-time** (test €1.99/mo later as an A/B; one-time converts better for utilities and matches Glen Chiacchieri's proven model): unlimited sites, adjustable peek delay/duration (free tier locked to defaults), export/import rules.
- Paywall moment: the instant a user tries to blur on a 3rd site — highest-intent moment. Modal copy: "You've got focus working on 2 sites. Unlock every site — one-time payment, yours forever." One button. No nag anywhere else.

---

## 3. UX details that matter

- **Peek interaction:** hover blurred element → 👁 button fades in → user must press-and-hold 1.5s (progress ring animates) → content unblurs for 10s → re-blurs with the 200ms transition. The hold delay is the "one sec"-style friction: long enough to interrupt autopilot, short enough to not feel punished. Both values in options (Pro).
- **First-run:** on install, open a 1-page onboarding tab: one looping GIF/video of the picker in action + the hotkey + preset buttons for YouTube/LinkedIn/X. Nothing else. The activation metric for this product is "created first rule within 2 minutes".
- **Undo everywhere.** Blurring the wrong container (e.g., the whole page body) must be trivially reversible: toast Undo, `Alt+B` `Alt+B` re-pick, popup rule list with per-rule delete.
- **Failsafe:** if a rule matches `body`, `html`, or an element covering >85% of viewport, auto-reject with toast "That would blur the whole page — pick something smaller."
- Popup shows: current-site toggle, rule list with human labels (auto-generate from aria-label/heading text near element, editable), global pause (with optional "resume in 30 min"), Upgrade button (free tier only).

## 4. Built-in presets (v1: exactly these 6 sites)
Ship hand-verified selectors for: **YouTube** (related sidebar, shorts shelf, comments, homepage grid), **X/Twitter** (For You timeline, Trends, Who to follow), **LinkedIn** (feed, news sidebar), **Facebook** (feed, reels, stories), **Reddit** (popular/home feed, sidebar), **Instagram web** (feed, reels, explore).
Each preset = named rule bundle; user toggles per-item. Presets are `source: "preset"` rules using the same schema. Expect these selectors to rot — plan a small update cadence (also signals "actively maintained" in the store).

## 5. Edge cases & QA checklist
- [ ] SPA route change re-applies rules (test: YouTube home → video → home)
- [ ] Infinite-scroll feeds: new items get blurred as they load (MutationObserver)
- [ ] Iframes: v1 = top frame only; note in FAQ (embedded feeds out of scope)
- [ ] Dark mode sites: picker outline uses mix-blend-mode or dual-color outline
- [ ] Rule that matches 0 elements → stale flag after 3 loads, ⚠️ in popup, never silent-delete
- [ ] Sync conflict: last-write-wins is fine at this scale
- [ ] Uninstall of host permission mid-session handled gracefully
- [ ] Peek works with keyboard only (accessibility: focusable peek button, Enter-hold or Enter-toggle alternative)
- [ ] CSP-strict sites (GitHub etc.): injected stylesheet approach works where inline may not
- [ ] Performance: rule application <16ms on a 5k-node page; observer debounced

## 6. Store listing (draft copy)

**Title:** Blur Distractions – Hide Feeds & Focus (ADHD)

**Short description (132 chars max):**
Blur any part of any website — feeds, sidebars, comments. Still there if you need it, but behind a deliberate pause. Gentle focus.

**Description (key blocks):**
- Opening: "Blockers are all-or-nothing. ADHD brains need something gentler. Blur Distractions lets you point at anything on any website and blur it — the content stays exactly where it was, just out of your attention's reach. Want to see it anyway? Hold the peek button for a moment. That tiny pause is usually all it takes to remember what you actually came for."
- How it works: 3 steps (Alt+B → click → done), presets list.
- Privacy block: "Runs entirely in your browser. No account. No tracking. We only get access to a site when YOU choose to blur something on it." *(true because of the optional host permission design — genuinely rare and worth shouting about)*
- Honest ADHD framing: built for distractible brains; no medical claims, no cure language, no shame language anywhere in copy.
- FAQ: peek timing, free vs Pro, "why blur instead of block".

**Category:** Workflow & Planning (or Well-being — test which ranks better; Workflow has better median reach).
**Screenshots (5):** picker in action on YouTube · before/after LinkedIn feed · peek hold with progress ring · popup rule list · options page. First screenshot is 90% of conversion — make it the before/after.

## 7. Launch & iteration plan
1. **Weekend 1:** build core (picker, selector gen, blur, storage, popup). Presets for YouTube + X only.
2. **Weekend 2:** ExtensionPay, onboarding page, options, remaining presets, QA checklist. Submit to Chrome Web Store ($5 dev account) — expect a few days' review; `activeTab`-first permission model keeps this smooth.
3. Same package → **Edge Add-ons** (free account) with store copy tweaked. Near-zero extra work, much less competition.
4. Post-launch: personal use daily (dogfood), answer every review, fix preset rot fast. Reviews are the ranking lever.
5. **v2 candidates, strictly demand-driven:** focus schedules (blur only during work hours), "blur all images on this site", AI-suggested blur targets (now trained on real rule data), Firefox port, team/parent profiles.

## 8. Success criteria (be honest with yourself)
- Week 4: 200+ installs, ≥5 reviews, activation (first rule <2 min) >50%
- Month 3: 1,000 users → at 2–4% conversion on €19 ≈ €400–750 cumulative; decide continue vs. next extension
- Kill criterion: <300 installs and <2% activation-to-paywall reach by month 3 → ship the next idea instead of polishing this one
