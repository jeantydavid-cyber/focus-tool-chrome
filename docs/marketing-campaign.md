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

## Day 1: r/ADHD

**Read the rules first.** r/ADHD restricts self-promotion heavily. Check
whether there is a weekly "what tools work for you" thread and post there
instead of as a top-level post. If a mod removes it, do not repost; message
the mods and ask where it belongs.

**Title:**
```
Blockers never worked for my ADHD brain, so I made something that just blurs the distracting stuff instead
```

**Body:**
```
Every website blocker I tried failed the same way. I would hit the block page, feel told off, then spend two minutes disabling it or opening a different browser. The all-or-nothing thing just does not fit how my attention works.

What I actually wanted was for the noise to stop grabbing me, without being locked out of anything.

So I built a small browser extension that blurs it. You press a hotkey, click the thing that keeps pulling your eyes (the YouTube sidebar, the LinkedIn feed, comments, whatever) and it stays blurred on every visit. The page still works. Nothing is deleted or blocked.

The part that surprised me is the peek button. If you want to see a blurred thing, you hover it and hold a button for about a second and a half before it reveals. That pause is stupidly short but it is enough time for the "wait, what did I come here for" thought to arrive. Maybe half the time I let go without looking.

No shame screens, no streaks, no lecture. It just makes the pull quieter.

It is free on two sites. I put it on the Chrome store as a one time $4.99 unlock for unlimited sites because I would rather charge once than run a subscription for something this small. Not tracking anything, no account, and it only gets access to a site when you blur something there.

https://chromewebstore.google.com/detail/ldheigmdmfcafdmieipgclpnineaejad

Happy to answer anything. Genuinely curious whether the peek delay works for other people or whether 1.5 seconds is too short.
```

**ALTERNATE opening if you do not have ADHD:**
```
I kept watching people around me fight with website blockers, and the failure mode was always the same: hit the block page, feel told off, disable it two minutes later.

So I tried building the opposite. Instead of blocking a distraction, it blurs it.
```

---

## Day 2: r/productivity

**Title:**
```
I built a browser extension that blurs distractions instead of blocking them. Three months of using it daily, here is what I learned.
```

**Body:**
```
Short version: blocking creates a fight, blurring creates a pause. The pause wins more often.

I spent years cycling through blockers. The pattern was always the same: install with good intentions, hit a block page during a moment of genuine need, disable it, never re-enable.

The thing I built works differently. You point at anything on any page and it blurs. The page keeps working, the layout does not break, and the content is still there. To see it, you hover and hold a peek button for about 1.5 seconds, then it reveals for 10 seconds and fades back.

What I did not expect: the friction does not need to be large. A second and a half is nothing, but it is long enough for the intention behind the click to become conscious. Often that is all it takes.

The other thing that mattered was making it universal. Every blocker I tried had a hardcoded list of "bad" sites. But my distractions are specific: the related videos sidebar, not YouTube itself. This lets you pick the exact element.

Free on two sites, $4.99 one time for unlimited. No account, no tracking, and it only gets permission for a site when you blur something on it.

https://chromewebstore.google.com/detail/ldheigmdmfcafdmieipgclpnineaejad
```

---

## Day 3: Hacker News (Show HN)

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

## Day 4: X / Twitter

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

## Day 4: LinkedIn (same day, different audience)

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
