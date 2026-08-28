# Softspot launch campaign: every post, written

Paste-ready copy for launch week. Nothing here needs editing except the
bracketed bits and the honesty check below.

## Honesty check before you post anything

Two of these posts are written in first person about ADHD. Only use those
versions if they are true for you.

- **If you have ADHD or are diagnosed/self-identifying:** use the posts as
  written.
- **If you do not:** use the "built it for someone else" variants marked
  ALTERNATE. They work nearly as well and they are true. Claiming a
  diagnosis you do not have in an ADHD community is the one mistake that
  cannot be walked back.

Never claim to be a user you are not. Never post the same text to two subs
on the same day. Never argue with a downvoted comment.

---

## Channel note

r/ADHD and r/productivity ban all self-promotion, so they are out for
posts. The plan below uses only channels where launching your own product
is explicitly welcome. The one legitimate way back into strict subs is in
the "Answering questions" section at the bottom: honest, disclosed,
genuinely helpful comments where someone already asked for exactly this.

---

## Day 1: Show HN (moved up, now the lead channel)

See the Hacker News section below. Post between 8 and 10am US Eastern
(14:00 to 16:00 in central Europe) on a weekday, then stay available for
two hours. This is now your strongest channel: an audience that likes
indie tools, no self-promo taboo, and the privacy-first permission model
is exactly the kind of detail HN upvotes.

---

## Day 2: r/SideProject and r/chrome_extensions

Both subreddits exist for sharing your own work. Post the same day is
fine since the audiences barely overlap.

**r/SideProject title:**
```
I built a Chrome extension that blurs distractions instead of blocking them. Made my first sale this week.
```

**r/SideProject body:**
```
The idea: website blockers are all or nothing, and the block page just
made me disable them. So I built the opposite. You press Alt+B, click the
thing that distracts you (a feed, a sidebar, comments) and it blurs. The
page keeps working. If you really need the content, you hold a peek
button for 1.5 seconds and it reveals for 10.

Tech: Manifest V3, no host permissions at install (activeTab plus
per-site grants when you blur something), no analytics, no server.
Payments via ExtensionPay, one time $4.99 to unlock unlimited sites,
first two sites free.

https://chromewebstore.google.com/detail/ldheigmdmfcafdmieipgclpnineaejad

Happy to answer anything about the build or the Chrome review process
(got rejected once for keyword spam in the description, fixed it, second
review passed).
```

**r/chrome_extensions:** same body, title:
```
Softspot: blur any element on any site, with a hold-to-peek to reveal it
```

---
## Hacker News (Show HN) post and first comment

Post between 8 and 10am US Eastern on a weekday. Then stay at your desk
for two hours to answer comments; HN rewards fast, technical replies.

**Title:**
```
Show HN: Softspot – blur any element on any site instead of blocking it
```

**URL:** your Netlify site (not the store link; HN prefers a real page)

**Your first comment, post it immediately after submitting:**
```
Author here. This started as a personal itch: every content blocker I tried was all-or-nothing, and the block page just made me route around it. Blurring turned out to work much better for me, so I made it general.

A few implementation notes that might interest people here:

Permissions: it requests zero host permissions at install. The element picker runs on activeTab, and the first time you create a rule on a site it calls chrome.permissions.request for that single origin. That per-site grant is what lets the blur reapply on later visits. Most extensions in this space ask for <all_urls> up front; I wanted the install prompt to be clean and the trust story to be real rather than a claim in the listing.

Selector generation was the hard part. Generated selectors have to survive reloads and dynamic class names, so it prefers stable attributes (non-generated ids, data-testid, aria-label, semantic tags) and rejects hashed and utility classes. It stores both a specific and a generalized selector, tries specific first, falls back, and flags a rule as stale if it matches nothing for three consecutive loads rather than silently doing nothing.

SPAs needed a MutationObserver plus URL-change detection, since YouTube and friends never actually navigate. Blurred elements get a transparent overlay that both blocks interaction and hosts the peek button.

The peek interaction is the actual product: hold about 1.5s, content reveals for 10s, then re-blurs. Short enough not to feel punitive, long enough to interrupt autopilot.

No analytics, no server, no account. Free on two sites, one-time $4.99 for unlimited, via ExtensionPay.

Happy to go deeper on any of it.
```

---

## Day 3: X / Twitter

Post the demo clip with this. Thread, not a single tweet.

```
1/ Website blockers never worked for me. Block page appears, I feel told off, I disable it.

So I built the opposite: an extension that blurs distractions instead of blocking them.

2/ Point at anything on any site. The YouTube sidebar, the LinkedIn feed, comments. Press Alt+B, click it, done. It stays blurred every visit.

The page still works. Nothing is deleted.

3/ The trick is the peek button.

Want to see it anyway? Hold for 1.5 seconds. It reveals for 10, then fades back.

That tiny pause is the whole product. Long enough to interrupt autopilot, short enough that it never feels like punishment.

4/ It asks for zero site permissions at install. It only gets access to a site when you choose to blur something there.

No account. No tracking. No server.

5/ Free on two sites. $4.99 one time for unlimited.

https://chromewebstore.google.com/detail/ldheigmdmfcafdmieipgclpnineaejad
```

## Day 3: LinkedIn (same day, different audience)

```
I shipped a small thing.

Every website blocker I tried had the same failure mode: an all-or-nothing block page that I would disable within two minutes.

So I built the gentler version. Softspot blurs the distracting parts of any website instead of blocking them. You point at a feed, a sidebar, a comment section, and it goes soft. The page still works. If you genuinely need the content, you hold a peek button for a second and a half and it reveals.

That pause is the entire product. It is short enough not to feel like punishment and long enough for you to remember what you actually opened the tab for.

Built with a privacy model I am proud of: it requests no site access at install and only gets permission for a site when you choose to blur something there. No account, no tracking.

Free on two sites, one-time $4.99 for unlimited.

https://chromewebstore.google.com/detail/ldheigmdmfcafdmieipgclpnineaejad
```

---

## Day 4: Product Hunt

Launches at 00:01 US Pacific time. Create the listing the evening before.

**Name:** Softspot
**Tagline:** Blur distractions instead of blocking them
**Description:**
```
Softspot blurs the distracting parts of any website: feeds, sidebars,
comments, thumbnails. Everything stays where it was, just out of your
attention's reach. Hold the peek button for 1.5 seconds to reveal
anything for 10 seconds. That tiny pause is the product: long enough to
interrupt autopilot, short enough to never feel like punishment. No
account, no tracking, and no site access until you blur something there.
Free on 2 sites, $4.99 once for unlimited.
```

**First comment (as maker):** reuse the Show HN first comment, minus the
deepest technical parts.

---

## Answering questions (the legitimate way into strict communities)

People constantly ask things like "how do I hide YouTube recommendations"
or "how do I stop looking at LinkedIn's feed" on Reddit and elsewhere.
Answering those with a disclosed, helpful comment is not advertising, it
is answering. Rules for doing it right:

1. Only reply where the question is genuinely what Softspot solves.
2. Give a full answer first (mention the free options too, like uBlock
   element hiding or Unhook for YouTube).
3. Then one line: "I also built an extension for exactly this (I am the
   dev): it blurs instead of removing, link if useful."
4. Never do this more than a couple of times a week, never with copy
   pasted text, and stop in any community where a mod objects.

To find the questions: search Reddit for "hide youtube recommendations",
"hide linkedin feed", "block twitter trending" sorted by new, and set a
free F5Bot alert (f5bot.com) for those phrases so they come to your inbox.

---

## Comment reply bank

Pre-written answers to the questions you will definitely get. Adapt tone
to the platform.

**"How is this different from [uBlock / Unhook / News Feed Eradicator]?"**
```
Those remove elements using per-site rules someone else wrote. Two differences: this works on any site because you pick the element yourself, and it blurs rather than removes, so the layout never breaks and the content is still reachable when you actually need it. Different philosophy: friction instead of prohibition.
```

**"Why not just use willpower / uninstall the app?"**
```
Fair, and for some people that genuinely works. For me the problem was never a decision I made deliberately, it was the two seconds of autopilot before any decision happened. This puts something in that gap. If willpower alone works for you, you do not need this.
```

**"Why is it paid?"**
```
Free on two sites, which covers most people. The $4.99 is one time, not a subscription, because a tool this small should not be a recurring bill. It pays for the ongoing work of fixing selectors when sites redesign, which happens constantly.
```

**"Can I see the code / is it open source?"**
```
Not currently open source, though the permission model is verifiable: install it and check chrome://extensions, it holds no site access until you grant a specific site. Happy to answer anything about how it works internally.
```

**"Does it work on Firefox?"**
```
Chrome and Edge today. Firefox needs a separate build; if enough people ask I will do it.
```

**"It stopped working on [site]."**
```
That is almost always the site changing its layout, which breaks the saved selector. Two options: re-pick the element with Alt+B, or tell me the site and I will ship a fix. Preset rot is the ongoing maintenance job of this kind of extension and I would rather hear about it than not.
```

---

## Review responses (Chrome Web Store)

Reply to every single one, positive or negative, within 24 hours.

**5 star:**
```
Thank you, genuinely. If you hit anything that stops working after a site redesign, email getsoftspot@gmail.com and I will fix it fast.
```

**3 star with a specific complaint:**
```
Thanks for the honest rating and for saying what was wrong. [Restate their issue.] I am working on this now and will reply here when it ships.
```
Then actually ship it and reply.

**1 star "does not work":**
```
Sorry it broke for you, and thanks for flagging it. Could you email getsoftspot@gmail.com with the site you were trying it on? Almost always this is a selector that stopped matching after a site update and I can fix it within a day.
```

Never argue. Never explain why they are wrong. Fix, reply, move on.

---

## Outreach list (week 2, after the launch posts)

Send short personal emails, one at a time, not a blast. Template:

```
Subject: A gentler alternative to website blockers

Hi [name],

I read your piece on [specific thing they wrote]. The bit about [detail] matched my experience exactly.

I built a small extension called Softspot that takes the opposite approach to blockers: instead of blocking distracting parts of a site, it blurs them, and you can hold a button for a second and a half to peek if you genuinely need to look. The pause turns out to matter more than the barrier.

Free on two sites if you want to try it: https://chromewebstore.google.com/detail/ldheigmdmfcafdmieipgclpnineaejad

No ask attached, I just thought it might be relevant to what you write about.

[your name or "the Softspot dev"]
```

Targets to research and contact:
- ADHD newsletter writers on Substack
- YouTubers covering ADHD tools and productivity software
- Bloggers who have reviewed Freedom, Cold Turkey, or Opal
- r/ADHD_Programmers, r/getdisciplined (as a comment, not a post)

---

## Cadence rules

- One channel per day. Never cross-post the same day.
- Two hours of comment availability after each post. This matters more
  than the post itself.
- Reply to every review within 24 hours.
- If a post flops, do not delete it. Move on to the next channel.
- Track installs daily in the dashboard for the first two weeks so you
  can see which channel actually moved the number.
