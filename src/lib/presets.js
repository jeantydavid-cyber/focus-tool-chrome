/*
 * presets.js — built-in rule bundles for the six v1 sites (spec §4).
 * Hand-verified selectors; expect rot, keep the update cadence.
 *
 * Loaded in the popup, the onboarding page, and the background worker.
 * Each item becomes a normal rule with source:"preset" and a stable id
 * ("p_<itemId>") so re-applying a preset is idempotent.
 */
(() => {
  'use strict';

  const PRESETS = [
    {
      id: 'youtube',
      name: 'YouTube',
      hosts: ['www.youtube.com'],
      items: [
        { id: 'yt-related', label: 'Related videos sidebar', selector: '#related', generalized: null },
        { id: 'yt-shorts', label: 'Shorts shelves', selector: 'ytd-rich-shelf-renderer[is-shorts]', generalized: 'ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts]', mode: 'generalized' },
        { id: 'yt-comments', label: 'Comments', selector: 'ytd-comments#comments', generalized: '#comments' },
        { id: 'yt-home', label: 'Homepage video grid', selector: 'ytd-browse[page-subtype="home"] ytd-rich-grid-renderer', generalized: null }
      ]
    },
    {
      id: 'x',
      name: 'X / Twitter',
      hosts: ['x.com', 'twitter.com', 'www.x.com', 'www.twitter.com'],
      items: [
        { id: 'x-timeline', label: 'Home timeline (For You)', selector: 'div[data-testid="primaryColumn"] section[role="region"]', generalized: null },
        { id: 'x-sidebar', label: 'Trends & search sidebar', selector: 'div[data-testid="sidebarColumn"]', generalized: null },
        { id: 'x-follow', label: 'Who to follow', selector: 'aside[aria-label*="follow" i]', generalized: null }
      ]
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      hosts: ['www.linkedin.com'],
      items: [
        { id: 'li-feed', label: 'Main feed', selector: 'main div.scaffold-finite-scroll', generalized: 'main [data-finite-scroll-hotkey-context="FEED"]' },
        { id: 'li-news', label: 'LinkedIn News sidebar', selector: 'aside[aria-label*="News" i]', generalized: 'aside.scaffold-layout__aside' }
      ]
    },
    {
      id: 'facebook',
      name: 'Facebook',
      hosts: ['www.facebook.com', 'web.facebook.com'],
      items: [
        { id: 'fb-feed', label: 'News feed', selector: 'div[role="feed"]', generalized: null },
        { id: 'fb-stories', label: 'Stories', selector: 'div[aria-label="Stories"]', generalized: 'div[aria-label*="Stories" i]' },
        { id: 'fb-reels', label: 'Reels shelf', selector: 'div[aria-label*="Reels" i]', generalized: null }
      ]
    },
    {
      id: 'reddit',
      name: 'Reddit',
      hosts: ['www.reddit.com'],
      items: [
        { id: 'rd-feed', label: 'Home / Popular feed', selector: 'shreddit-feed', generalized: 'main shreddit-feed' },
        { id: 'rd-sidebar', label: 'Right sidebar', selector: '#right-sidebar-container', generalized: null }
      ]
    },
    {
      id: 'instagram',
      name: 'Instagram',
      hosts: ['www.instagram.com'],
      items: [
        { id: 'ig-feed', label: 'Feed posts', selector: 'main[role="main"] article', generalized: 'main article', mode: 'generalized' },
        { id: 'ig-explore', label: 'Explore grid', selector: 'main[role="main"] a[href^="/p/"]', generalized: 'main a[href^="/p/"]', mode: 'generalized' },
        { id: 'ig-reels', label: 'Reels & videos', selector: 'main[role="main"] video', generalized: 'main video', mode: 'generalized' }
      ]
    }
  ];

  function findPresetForHost(host) {
    if (!host) return null;
    return PRESETS.find((p) => p.hosts.includes(host)) || null;
  }

  /** Convert a preset item into a storable rule object. */
  function presetItemToRule(item, now) {
    return {
      id: 'p_' + item.id,
      selector: item.selector,
      generalized: item.generalized || null,
      mode: item.mode || 'specific',
      label: item.label,
      createdAt: now || Date.now(),
      enabled: true,
      staleCount: 0,
      source: 'preset'
    };
  }

  const api = { PRESETS, findPresetForHost, presetItemToRule };
  if (typeof window !== 'undefined') window.__bdPresets = api;
  else if (typeof self !== 'undefined') self.__bdPresets = api; // service worker
})();
