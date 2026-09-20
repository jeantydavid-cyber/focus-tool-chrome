# Changelog

## 1.1.0

- Blur applies before the page paints. Saved rules are emitted as a stylesheet at document start, so feeds no longer flash unblurred on load (including late-rendering sites like YouTube).
- Element picker: press ↑ or ↓ to widen or narrow the selection to the parent or child element before clicking. Enter confirms. The hint shows a friendly name for what is selected.
- The "would blur the whole page" failsafe now asks for confirmation instead of refusing, so feeds that legitimately fill a small window can still be blurred. The page itself stays off limits.
- Stale rules (no match on the last few loads) show a Fix button in the popup that re-opens the picker and repairs the rule in place.
- After an update, the toolbar icon shows a NEW badge and the popup shows a short "what's new" card, once.

## 1.0.1

- Gentle review request in the popup, shown once someone has 3+ rules and 3+ days of use, or Pro after 1 day. Snoozes politely, never nags.

## 1.0.0

- Initial release.
