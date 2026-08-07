# Softspot launch plan: from store submission to first customers

Work top to bottom. Each phase has a "done when" line so you always know
whether to move on.

---

## Phase 0: already done

- Extension built, tested (24 automated checks), renamed to Softspot
- ExtensionPay registered (id blur-distractions), Stripe connected
- Test purchase verified end to end at $4.99
- Website live on Netlify with privacy policy
- Store listing copy, privacy answers, and zip ready

## Phase 1: pre-submission (one evening)

1. Set the ExtensionPay plan to 4.99 USD one-time; delete any test-priced plan.
2. In Stripe settings, confirm: public business name "Softspot", statement
   descriptor SOFTSPOT, support email getsoftspot@gmail.com.
3. Take the 4 remaining screenshots at 1280x800 (see store-listing.md):
   YouTube before/after, picker in action, peek mid-hold, popup.
   The settings screenshot is already generated.
4. Optional: 440x280 promo tile (logo + "Put the noise out of focus.").

**Done when:** 5 screenshots exist and checkout shows $4.99.

## Phase 2: submission (about 1 hour)

1. chrome.google.com/webstore/devconsole, signed in as getsoftspot@gmail.com.
   Pay the one-time $5 registration.
2. New item, upload softspot.zip.
3. Store listing tab: paste from store-listing.md. Category Workflow &
   Planning. Upload screenshots in the listed order.
4. Privacy tab: paste the pre-written answers. Privacy policy URL:
   your-site.netlify.app/privacy.html.
5. Distribution: Public, all regions. Submit for review.
6. While waiting (1 to 5 days): create the Edge Add-ons account
   (partner.microsoft.com/dashboard/microsoftedge, free), draft the same
   listing there so it is one click to submit later.

**Done when:** status shows "Pending review".
If rejected: read the email, fix the one thing named, resubmit. No penalty.

## Phase 3: approval day (30 min, do these in order)

1. Install Softspot from the store link in your own Chrome. Remove the
   unpacked dev copy first (or use a separate profile) so ExtensionPay
   leaves test mode cleanly.
2. Make ONE real purchase at $4.99 with a real card. Verify Pro unlocks.
   This is the live-payment test; the money comes back as your own payout.
3. Update the site: point the "Add Softspot to Chrome" button at the store
   URL, redeploy to Netlify. (Send the URL to Claude and it is a 2-minute
   change.)
4. Submit the same zip to Edge Add-ons.
5. Ask 3 to 5 friends to install and leave an honest review. Five reviews
   beats 90% of the category on social proof.

**Done when:** store button on the site works, one live sale confirmed,
Edge submitted, first reviews in.

## Phase 4: launch week marketing (spread over 5 to 7 days, one move per day)

Do not do all of these on the same day; spread them so each gets attention
and you can respond to comments.

- **Day 1, Reddit r/ADHD:** read the sub rules first (self-promo is
  restricted; the weekly threads or a genuine story post work). Angle:
  personal story, not ad. "Blockers never worked for my brain, so I built
  something gentler: it blurs feeds instead of blocking them." Answer every
  comment.
- **Day 2, r/productivity and r/chrome_extensions:** shorter version of the
  same post. Different audiences, same honesty.
- **Day 3, Hacker News "Show HN":** title like "Show HN: Softspot, blur any
  part of any website instead of blocking it". First comment from you:
  what it is, why blur beats block, the tech (MV3, no tracking, per-site
  permissions). HN loves the privacy-first permission model; lead with it.
- **Day 4, X/Twitter and LinkedIn:** short demo clip (screen recording of
  Alt+B, click, blur, peek). Tag #buildinpublic.
- **Day 5, Product Hunt (optional):** works better with a small following;
  fine to postpone to month 2.
- **All week:** reply to every review, comment, and email within 24h.

**Done when:** each channel posted once and every comment answered.

## Phase 5: ongoing cadence (about 2 hours per week)

- **Dogfood daily.** You are user #1; annoyances you feel are bugs.
- **Watch preset rot:** the six preset sites redesign constantly. When a
  preset stops matching (⚠️ stale flags, or reviews say "stopped working"),
  fix selectors and ship an update within days. Fast fixes are visible
  proof of maintenance and the #1 review complaint avoided.
- **Respond to every review**, especially negative ones: fix, reply, ask
  them to retest.
- **Ship one small improvement per week** while momentum builds; each
  update refreshes the "last updated" date the store shows.
- **Check numbers weekly** (dashboard Stats + ExtensionPay): installs,
  weekly users, free-to-paid conversion.

## Phase 6: decision gates (from the original spec, keep yourself honest)

- **Week 4:** 200+ installs, 5+ reviews. Below that: marketing problem,
  not product problem; do another round of posts before touching code.
- **Month 3:** ~1,000 users at 2 to 4% conversion on $4.99 is roughly
  $100 to $200 cumulative; the price point needs volume, so the real
  question is growth slope, not revenue yet.
- **Kill criterion:** under 300 installs and under 2% of users ever
  reaching the paywall by month 3 means ship the next idea instead of
  polishing this one. Softspot keeps selling passively either way.

---

## FAQ for launch week

**How do paying customers keep Pro on another PC?**
Same Chrome profile: automatic (license syncs via chrome.storage.sync,
like their rules). Different browser or profile: payment page, "Already
paid? Log in", enter the checkout email, click the emailed link. The
paywall modal and settings page both have "Already paid? Restore your
purchase" links that lead there.

**A customer emails "it stopped working on site X."**
Almost always selector rot after a site redesign. Reproduce, re-pick the
element yourself, update the preset if it is a preset site, ship. Reply
with "fixed in version x.y, refresh the site."

**Someone asks for a refund despite the policy.**
Refunding via the Stripe dashboard takes ten seconds and costs less than
a chargeback ($15 fee) or a one-star review. All-sales-final is the
public stance, not a hill to die on for $4.99.
