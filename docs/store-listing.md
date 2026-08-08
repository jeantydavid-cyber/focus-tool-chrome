# Softspot store listing (copy-paste kit)

Everything needed for the Chrome Web Store dashboard, in the order the form
asks for it. Edge Add-ons uses the same content.

---

## Title (max 75 chars; this one is 47)

```
Softspot: Blur Distractions, Hide Feeds & Focus
```

## Short description (max 132 chars; this one is 129)

```
Blur any part of any website: feeds, sidebars, comments. Still there if you need it, but behind a deliberate pause. Gentle focus.
```

## Full description

```
Blockers are all-or-nothing. Distractible brains need something gentler.

Softspot lets you point at anything on any website and blur it. The content stays exactly where it was, just out of your attention's reach. Want to see it anyway? Hold the peek button for a moment. That tiny pause is usually all it takes to remember what you actually came for.

HOW IT WORKS
1. Press Alt+B on any website (or click the Softspot icon)
2. Click the thing that distracts you: a feed, a sidebar, comments
3. Done. It stays blurred, on every visit, until you say otherwise

Need the content after all? Hover the blur and hold the peek button. It reveals for a few seconds, then gently fades back. The pause is the point: long enough to interrupt autopilot, short enough to never feel punished.

ONE-CLICK PRESETS
Hand-tuned blur rules, ready to apply:
• YouTube: related videos, Shorts, comments, homepage grid
• X / Twitter: timeline, trends, who to follow
• LinkedIn: feed, news sidebar
• Facebook: feed, stories, reels
• Reddit: home feed, sidebar
• Instagram: feed, explore, reels

PRIVACY, FOR REAL
Softspot runs entirely in your browser. No account. No tracking. No analytics. It only gets access to a site when YOU choose to blur something on it. Most extensions ask for access to every website at install; Softspot never does.

BUILT FOR DISTRACTIBLE BRAINS
Made with ADHD in mind, without shame or lockouts. Nothing is forbidden, nothing is deleted. The feed is still there if you truly need it. It just costs a deliberate moment, and that moment belongs to you.

FREE AND PRO
Free: unlimited blurs on up to 2 sites, all presets included.
Pro ($4.99, one time): every site, adjustable peek timing, rule backup. Yours forever. No subscription.

WHY BLUR INSTEAD OF BLOCK?
Blocking breaks pages and invites workarounds; you just open another browser. A blur keeps the page intact and working. It removes the pull of the content without pretending it doesn't exist. Softer, and for many of us, far more effective.
```

## Category

**Workflow & Planning** (fallback: Well-being; Workflow has better median reach)

## Language

English

---

## Screenshots (1280x800 PNG, up to 5; order matters)

1. **Before/after split of YouTube** with the homepage grid and sidebar
   blurred. This is the conversion shot; make it first.
2. **The picker in action**: purple highlight over a feed, hint pill visible
   ("Click an element to blur it").
3. **The peek button mid-hold** with the progress ring visible on a blurred
   sidebar.
4. **The popup** showing a few rules with toggles on youtube.com.
5. **Settings page** showing peek timing and blur intensity.

Tips: use a clean browser profile (no other extensions in the toolbar),
light theme, 100% zoom. Crop to exactly 1280x800.

## Promo tile (optional but recommended, 440x280)

Softspot wordmark + the three-bars logo on the purple gradient, tagline:
"Put the noise out of focus."

---

## Privacy tab answers (Chrome Web Store dashboard)

- **Single purpose description:** "Softspot lets users selectively blur
  distracting parts of websites they choose, with a hold-to-peek option to
  temporarily reveal blurred content."
- **Data usage:** does NOT collect or transmit any user data. Check "no data
  collected."
- **Permission justifications:**
  - `storage`: saves the user's blur rules and settings in browser sync storage.
  - `activeTab`: runs the element picker on the page where the user invokes it.
  - `scripting`: injects the picker and applies the user's saved blur rules.
  - `optional_host_permissions (<all_urls>)`: requested per-site, only when
    the user creates a blur rule on that site, so their rules persist there.
  - `host_permissions (extensionpay.com)`: required by the ExtensionPay
    payments library to process the optional Pro upgrade.
- **Remote code:** none. All code ships in the package.
- **Privacy policy URL:** your live Netlify page, ending in /privacy.html
  (for example https://softspot.netlify.app/privacy.html). It must load
  publicly before you submit; reviewers check it.

---

## Publishing checklist

- [ ] ExtensionPay: price set to 4.99 USD one-time, test plan removed
- [ ] ExtensionPay: Stripe connected (live charges enabled)
- [ ] Fresh test: reset to unpaid, full free-tier walkthrough, test purchase
- [ ] `cd src && zip -r ../softspot.zip .` (manifest.json at zip root)
- [ ] Chrome Web Store: $5 developer registration paid
- [ ] Listing filled from this file, screenshots uploaded
- [ ] Privacy tab filled from this file, policy URL live
- [ ] Submit for review (expect 1 to 5 days)
- [ ] After approval: same zip to Edge Add-ons (free account)
