/*
 * selector.js — robust CSS selector generation.
 * Loaded as a content script alongside picker.js. Exposes window.__bdSelector.
 *
 * Strategy (spec §2.3):
 *  1. Prefer stable attributes: id (non-generated), data-testid, aria-label,
 *     role, semantic tags, then non-hashed class combinations.
 *  2. Reject utility/atomic and hashed classes.
 *  3. Build the shortest unique path from the nearest stable ancestor, max depth 5.
 */
(() => {
  'use strict';
  if (window.__bdSelector) return;

  const MAX_DEPTH = 5;

  // ids that look auto-generated (numbers, uuid fragments, framework prefixes)
  const GENERATED_ID = /\d{3,}|^:|uuid|^radix|^ember|^react|^headlessui|^__|--/i;
  // hashed / build-generated classes: css-1abc2d, jsx-3810, sc-bdVaJa, x1a2b3c4…
  const HASHED_CLASS = /^(css|jss|jsx|sc|x|_)[-_]?[a-z0-9]{4,}$|[a-z0-9]{4,}__[a-z0-9]|^[a-f0-9]{6,}$|\d{4,}/i;
  // a tail of ≥5 alphanumerics after a hyphen usually means a hash suffix
  const HASH_TAIL = /-[a-z0-9]{6,}$/i;
  const SEMANTIC_TAGS = new Set(['nav', 'aside', 'main', 'header', 'footer', 'article', 'section', 'form']);
  const STABLE_ATTRS = ['data-testid', 'data-test-id', 'data-test', 'data-qa', 'data-cy', 'data-pagelet', 'aria-label', 'role', 'name'];

  const esc = (v) => (window.CSS && CSS.escape) ? CSS.escape(v) : String(v).replace(/[^a-zA-Z0-9_-]/g, '\\$&');

  function isStableId(id) {
    return id && id.length >= 2 && !GENERATED_ID.test(id);
  }

  function isStableClass(c) {
    if (!c || c.length < 3) return false;            // utility-short ("p2", "mt")
    if (HASHED_CLASS.test(c)) return false;
    if (HASH_TAIL.test(c) && c.split('-').length <= 2) return false; // "button-a8f3kz"
    return true;
  }

  function stableClasses(el) {
    // Atomic-CSS soup (many classes per element) → classes are unreliable, skip.
    if (el.classList.length > 6) return [];
    return [...el.classList].filter(isStableClass).slice(0, 3);
  }

  // A selector that identifies `el` on its own (no path needed), or null.
  function anchorSelector(el) {
    const tag = el.tagName.toLowerCase();
    if (isStableId(el.id)) return `#${esc(el.id)}`;
    for (const attr of STABLE_ATTRS) {
      const v = el.getAttribute(attr);
      if (v && v.length <= 80 && !/\d{4,}/.test(v)) {
        return `${tag}[${attr}="${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
      }
    }
    if (SEMANTIC_TAGS.has(tag)) return tag;
    return null;
  }

  // Path segment for one node: tag + stable classes, indexed if needed.
  function segmentFor(el, { indexed = true } = {}) {
    const tag = el.tagName.toLowerCase();
    let seg = tag;
    const classes = stableClasses(el);
    if (classes.length) seg += '.' + classes.map(esc).join('.');
    if (!indexed) return seg;
    // Add :nth-of-type only when siblings would otherwise be ambiguous.
    const parent = el.parentElement;
    if (parent) {
      const sameSeg = [...parent.children].filter((c) => c !== el && matchesSafe(c, seg));
      if (sameSeg.length > 0) {
        const ofType = [...parent.children].filter((c) => c.tagName === el.tagName);
        seg += `:nth-of-type(${ofType.indexOf(el) + 1})`;
      }
    }
    return seg;
  }

  function matchesSafe(el, sel) {
    try { return el.matches(sel); } catch { return false; }
  }

  function qsaSafe(sel, root = document) {
    try { return [...root.querySelectorAll(sel)]; } catch { return []; }
  }

  /**
   * Specific selector: uniquely identifies exactly this element and should
   * survive reloads. Walks up to the nearest stable anchor, max depth 5.
   */
  function getSpecific(el) {
    if (!el || el.nodeType !== 1) return null;

    // The element may be its own anchor.
    const own = anchorSelector(el);
    if (own && qsaSafe(own).length === 1) return own;

    const segments = [segmentFor(el)];
    let node = el.parentElement;
    let depth = 1;
    while (node && node !== document.documentElement && depth <= MAX_DEPTH) {
      const anchor = anchorSelector(node);
      const candidate = (anchor ? anchor + ' > ' : '') + segments.join(' > ');
      if (anchor) {
        const matches = qsaSafe(candidate);
        if (matches.length === 1 && matches[0] === el) return candidate;
      }
      segments.unshift(segmentFor(node));
      const unanchored = segments.join(' > ');
      const matches = qsaSafe(unanchored);
      if (matches.length === 1 && matches[0] === el) return unanchored;
      node = node.parentElement;
      depth++;
    }

    // Fallback: fully indexed path from body (ugly but correct).
    const path = [];
    node = el;
    while (node && node !== document.body && node !== document.documentElement) {
      const parent = node.parentElement;
      if (!parent) break;
      const ofType = [...parent.children].filter((c) => c.tagName === node.tagName);
      path.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${ofType.indexOf(node) + 1})`);
      node = parent;
    }
    const abs = 'body > ' + path.join(' > ');
    const matches = qsaSafe(abs);
    return matches.length && matches[0] === el ? abs : segments.join(' > ');
  }

  /**
   * Generalized selector: drops positional constraints so sibling cards/posts
   * match too ("Blur all similar"). Returns null when it wouldn't widen the match.
   */
  function getGeneralized(el, specific) {
    specific = specific || getSpecific(el);
    if (!specific) return null;
    const stripped = specific
      .replace(/:nth-of-type\(\d+\)/g, '')
      .replace(/:nth-child\(\d+\)/g, '');
    const candidates = [];
    if (stripped !== specific) candidates.push(stripped);
    // Also try just the element's own (unindexed) shape scoped to its parent's shape.
    const parent = el.parentElement;
    if (parent) {
      const parentAnchor = anchorSelector(parent) || segmentFor(parent, { indexed: false });
      candidates.push(`${parentAnchor} > ${segmentFor(el, { indexed: false })}`);
    }
    const specificCount = qsaSafe(specific).length || 1;
    for (const c of candidates) {
      const matches = qsaSafe(c);
      if (matches.length > specificCount && matches.includes(el) && matches.length < 500) {
        return c.trim();
      }
    }
    return null;
  }

  /** Human label for the rule list (spec §3): aria-label → heading → text → tag. */
  function makeLabel(el) {
    const clean = (s) => s && s.replace(/\s+/g, ' ').trim().slice(0, 40);
    const aria = el.getAttribute('aria-label');
    if (aria) return clean(aria);
    const heading = el.querySelector('h1, h2, h3, h4, [role="heading"]');
    if (heading && heading.textContent.trim()) return clean(heading.textContent);
    for (const attr of ['title', 'alt', 'data-testid']) {
      const v = el.getAttribute(attr);
      if (v) return clean(v);
    }
    const text = el.textContent && el.textContent.trim();
    if (text) return clean(text);
    const tag = el.tagName.toLowerCase();
    const names = { nav: 'Navigation', aside: 'Sidebar', img: 'Image', video: 'Video', section: 'Section' };
    return names[tag] || `<${tag}> element`;
  }

  /** Short technical description shown in the picker hover label. */
  function describe(el) {
    const tag = el.tagName.toLowerCase();
    const id = isStableId(el.id) ? `#${el.id}` : '';
    const cls = stableClasses(el).slice(0, 2).map((c) => '.' + c).join('');
    return (tag + id + cls).slice(0, 60);
  }

  window.__bdSelector = { getSpecific, getGeneralized, makeLabel, describe };
})();
