import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../scripts/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles/main.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('editorial motion respects reduced motion and keeps catalog controls visible', () => {
  assert.ok(app.includes("matchMedia?.('(prefers-reduced-motion: reduce)')"));
  assert.match(app, /scrollTrigger:\s*\{[^}]*trigger:\s*['"]\.hero-section['"]/s);
  assert.doesNotMatch(app, /gsap\.from\(sec,\s*\{[\s\S]*?scrollTrigger:/);
  assert.match(html, /class="catalog-section reveal-section"/);
  assert.doesNotMatch(app, /gsap\.from\(['"]\.catalog-section/);
  assert.doesNotMatch(app, /heroScroll\.to\(['"]\.hero-editorial['"],\s*\{[^}]*opacity\s*:/);
  const wordRevealBody = app.match(/function animateWordReveal\([^)]*\)\s*\{[\s\S]*?\n\}/)?.[0] || '';
  assert.ok(wordRevealBody.length > 0, 'animateWordReveal helper must exist');
  assert.doesNotMatch(wordRevealBody, /opacity:\s*0\./);
  assert.match(html, /id="hero-field-canvas"/);
  assert.match(html, /id="tab-active-slider"/);
  assert.match(html, /class="story-timeline-rail"/);
  assert.match(html, /class="ritual-preset-row"/);
  assert.match(html, /class="ritual-faq"/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('expanded GSAP & ScrollTrigger choreography: bidirectional scrub, kinetic words, filter safety, and no double-split', async () => {
  const design = readFileSync(new URL('../DESIGN.md', import.meta.url), 'utf8');

  // Documented motion upgrade & visual safety styles
  assert.match(design, /\*\*Dial:\*\* ENERGY 2 \/ RHYTHM 3 \/ MOTION 3\./);
  assert.match(html, /id="scroll-progress-bar"/);
  assert.match(html, /data-count-to="6"/);
  assert.match(html, /data-count-to="10"/);
  assert.match(css, /\.scroll-progress-track\s*\{/);
  assert.match(css, /\.scroll-progress-fill\s*\{/);
  assert.match(css, /\.kt-clip\s*\{[\s\S]*?overflow:\s*hidden;/);
  assert.match(css, /\.site-header\.is-scrolled\s*\{/);
  assert.match(css, /body\.gsap-motion-active\s+\.hero-section/);
  assert.doesNotMatch(css, /\.luxury-story[^{]*\{[^}]*perspective:/);
  assert.match(app, /ScrollTrigger\.batch\([\s\S]*onEnterBack:/);
  assert.match(app, /window\.innerHeight\s*>=\s*540/);
  assert.match(app, /fitsPinnedViewport/);
  assert.match(app, /anticipatePin:\s*1/);

  const prevGlobals = {
    window: globalThis.window,
    document: globalThis.document,
    localStorage: globalThis.localStorage,
    Node: globalThis.Node,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    setInterval: globalThis.setInterval
  };
  const nativeSetInterval = globalThis.setInterval;
  globalThis.setInterval = (...args) => {
    const t = nativeSetInterval(...args);
    t.unref?.();
    return t;
  };

  function makeNode(type, tagName = '', text = '') {
    const classes = new Set();
    const attrs = {};
    const node = {
      nodeType: type,
      tagName: tagName.toUpperCase(),
      childNodes: [],
      parentElement: null,
      style: {},
      dataset: {},
      value: '',
      _text: text,
      attrs,
      classList: {
        add: (...names) => names.forEach((n) => classes.add(n)),
        remove: (...names) => names.forEach((n) => classes.delete(n)),
        contains: (n) => classes.has(n),
        toggle: (n, force) => (force === undefined ? (classes.has(n) ? classes.delete(n) : classes.add(n)) : (force ? classes.add(n) : classes.delete(n)))
      },
      get className() {
        return Array.from(classes).join(' ');
      },
      set className(v) {
        classes.clear();
        String(v || '').split(/\s+/).filter(Boolean).forEach((c) => classes.add(c));
      },
      setAttribute(k, v) { attrs[k] = String(v); },
      getAttribute(k) { return attrs[k] ?? null; },
      removeAttribute(k) { delete attrs[k]; },
      appendChild(child) {
        child.parentElement = node;
        node.childNodes.push(child);
        return child;
      },
      replaceChildren(...nodes) {
        node.childNodes = [];
        nodes.forEach((n) => node.appendChild(n));
      },
      cloneNode(deep) {
        const copy = makeNode(type, tagName, node._text);
        if (deep) node.childNodes.forEach((c) => copy.appendChild(c.cloneNode(true)));
        return copy;
      },
      addEventListener() { },
      removeEventListener() { },
      matches: () => false,
      contains: () => false,
      querySelector(sel) { return node.querySelectorAll(sel)[0] || null; },
      querySelectorAll(sel) {
        const hits = [];
        const walk = (curr) => {
          for (const child of curr.childNodes) {
            if (child.nodeType === 1) {
              if (sel === '.kt-word' && child.classList.contains('kt-word')) hits.push(child);
              if (sel === '.kt-clip' && child.classList.contains('kt-clip')) hits.push(child);
              walk(child);
            }
          }
        };
        walk(node);
        return hits;
      },
      get textContent() {
        if (type === 3) return node._text;
        return node.childNodes.map((c) => c.textContent).join('');
      },
      set textContent(v) {
        node._text = String(v);
        if (type === 1) node.childNodes = [makeNode(3, '', String(v))];
      },
      get innerHTML() {
        if (type === 3) return node._text;
        return node.childNodes.map((c) => (c.nodeType === 3 ? c._text : `<${c.tagName.toLowerCase()}>${c.innerHTML}</${c.tagName.toLowerCase()}>`)).join('');
      },
      set innerHTML(v) {
        node._innerHtmlRaw = String(v);
        node.childNodes = [makeNode(3, '', String(v))];
      }
    };
    return node;
  }

  try {
    globalThis.Node = { TEXT_NODE: 3, ELEMENT_NODE: 1 };
    const headline = makeNode(1, 'h1');
    headline.classList.add('hero-headline');
    headline.appendChild(makeNode(3, '', 'Kopi dan kriya '));
    const em = makeNode(1, 'em');
    em.appendChild(makeNode(3, '', 'dalam keranjang.'));
    headline.appendChild(em);

    const productGrid = makeNode(1, 'div');
    productGrid.id = 'product-grid';
    const cardA = makeNode(1, 'article'); cardA.classList.add('product-card');
    const cardB = makeNode(1, 'article'); cardB.classList.add('product-card');

    const tabSemua = makeNode(1, 'button'); tabSemua.dataset.category = 'semua'; tabSemua.classList.add('active');
    const tabMakanan = makeNode(1, 'button'); tabMakanan.dataset.category = 'makanan';
    tabMakanan._handlers = {};
    tabMakanan.addEventListener = (ev, fn) => { tabMakanan._handlers[ev] = fn; };
    tabSemua.addEventListener = () => { };

    const bySelector = {
      '.category-tabs .tab-btn': [tabSemua, tabMakanan],
      '.hero-headline': [headline],
      '.hero-description': [Object.assign(makeNode(1, 'p', 'Pilih menu dan bayar QRIS.'), {})],
      '.hero-actions': [makeNode(1, 'div')],
      '.hero-visual': [makeNode(1, 'div')],
      '.hero-section': [makeNode(1, 'section')],
      '.showcase-card': [makeNode(1, 'div')],
      '.showcase-tag': [makeNode(1, 'div')],
      '.showcase-img-wrap img': [makeNode(1, 'img')],
      '.catalog-title': [Object.assign(makeNode(1, 'h2', 'Menu Pilihan'), {})],
      '.product-grid': [productGrid],
      '.product-card': [cardA, cardB],
      '.luxury-story': [makeNode(1, 'section')],
      '.story-copy': [makeNode(1, 'div')],
      '.story-copy h2': [Object.assign(makeNode(1, 'h2', 'Dari keranjang ke bayar.'), {})],
      '.story-copy p': [Object.assign(makeNode(1, 'p', 'Proses ringkas.'), {})],
      '.story-copy .section-kicker': [makeNode(1, 'span', 'Cara pesan')],
      '.story-visual': [makeNode(1, 'div')],
      '.story-metrics > div': [makeNode(1, 'div'), makeNode(1, 'div')],
      '.final-cta': [makeNode(1, 'section')],
      '.cta-shell': [makeNode(1, 'div')],
      '.cta-copy h2': [Object.assign(makeNode(1, 'h2', 'Siap pesan sekarang.'), {})],
      '.cta-actions': [makeNode(1, 'div')],
      '.luxury-ritual': [makeNode(1, 'section')],
      '.ritual-copy h2': [Object.assign(makeNode(1, 'h2', 'QRIS dinamis.'), {})],
      '.ritual-copy p': [makeNode(1, 'p', 'Pindai langsung.')],
      '.ritual-badge': [makeNode(1, 'div'), makeNode(1, 'div'), makeNode(1, 'div')],
      '.site-footer': [makeNode(1, 'footer')],
      '.footer-brand': [Object.assign(makeNode(1, 'div', 'Atelier Nusantara'), {})],
      '.footer-brand-col': [makeNode(1, 'div')],
      '.footer-nav-col': [makeNode(1, 'div'), makeNode(1, 'div')],
      '.footer-bottom': [makeNode(1, 'div')],
      '#scroll-progress-bar': [Object.assign(makeNode(1, 'div'), { id: 'scroll-progress-bar' })],
      '#site-header': [Object.assign(makeNode(1, 'header'), { id: 'site-header' })],
      '[data-count-to]': [Object.assign(makeNode(1, 'span', '6'), { dataset: { countTo: '6' } })],
      '.hero-actions .btn-primary, .cta-actions .btn-primary, .showcase-btn': []
    };

    const byId = {
      'product-grid': productGrid,
      'results-count': makeNode(1, 'span'),
      'scroll-progress-bar': bySelector['#scroll-progress-bar'][0],
      'site-header': bySelector['#site-header'][0]
    };

    globalThis.document = {
      documentElement: makeNode(1, 'html'),
      body: makeNode(1, 'body'),
      createElement: (tag) => makeNode(1, tag),
      createTextNode: (txt) => makeNode(3, '', txt),
      getElementById: (id) => byId[id] || null,
      querySelector: (sel) => (bySelector[sel] && bySelector[sel][0]) || null,
      querySelectorAll: (sel) => bySelector[sel] || [],
      addEventListener() { },
      removeEventListener() { }
    };
    const storage = new Map();
    globalThis.localStorage = {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k)
    };

    const stats = { contextCalls: 0, revertCalls: 0, timelines: 0, scrollTriggers: 0, refreshes: 0, fromToCalls: 0, toCalls: 0 };
    const scrollTriggerConfigs = [];
    const timelineToCalls = [];
    const makeTimeline = () => {
      stats.timelines += 1;
      const tl = {
        from() { return tl; },
        fromTo(_t, _f, vars) { if (vars?.scrollTrigger) scrollTriggerConfigs.push(vars.scrollTrigger); return tl; },
        to(target, vars) {
          timelineToCalls.push({ target, vars });
          if (vars?.scrollTrigger) scrollTriggerConfigs.push(vars.scrollTrigger);
          return tl;
        }
      };
      return tl;
    };
    let reducedFlag = true;
    const mockScrollTrigger = {
      create(cfg) { stats.scrollTriggers += 1; scrollTriggerConfigs.push(cfg); return { kill() { } }; },
      batch(_targets, cfg) { stats.scrollTriggers += 1; scrollTriggerConfigs.push(cfg); return []; },
      getAll() { return []; },
      refresh() { stats.refreshes += 1; }
    };
    const mockGsap = {
      registerPlugin() { },
      context(fn) {
        stats.contextCalls += 1;
        fn();
        return {
          revert() { stats.revertCalls += 1; }
        };
      },
      matchMedia() {
        return {
          add(query, handler) {
            if (globalThis.window.matchMedia(query).matches) handler();
          }
        };
      },
      timeline(cfg) {
        if (cfg?.scrollTrigger) scrollTriggerConfigs.push(cfg.scrollTrigger);
        return makeTimeline();
      },
      from() { },
      to(_t, vars) { stats.toCalls += 1; if (vars?.scrollTrigger) scrollTriggerConfigs.push(vars.scrollTrigger); },
      fromTo(_t, _f, vars) { stats.fromToCalls += 1; if (vars?.scrollTrigger) scrollTriggerConfigs.push(vars.scrollTrigger); },
      quickTo() { return () => { }; }
    };

    globalThis.requestAnimationFrame = (cb) => { if (typeof cb === 'function') cb(); };
    globalThis.window = {
      gsap: mockGsap,
      ScrollTrigger: mockScrollTrigger,
      document: globalThis.document,
      localStorage: globalThis.localStorage,
      location: { protocol: 'https:', search: '', hash: '' },
      matchMedia: (q) => ({
        matches: q.includes('prefers-reduced-motion') ? reducedFlag : q.includes('min-width: 769px'),
        addEventListener() { }
      }),
      addEventListener() { },
      removeEventListener() { }
    };

    const appMod = await import(`../scripts/app.js?gsap=${Date.now()}`);

    // 1. Reduced motion leaves page completely static and leaves headline intact
    reducedFlag = true;
    const callsBeforeReduced = stats.timelines + stats.scrollTriggers + stats.toCalls;
    appMod.initGSAPAnimations();
    assert.equal(stats.timelines + stats.scrollTriggers + stats.toCalls, callsBeforeReduced);
    assert.equal(headline.querySelectorAll('.kt-clip').length, 0);

    // 2. Full GSAP choreography splits words once (preserving <em> and aria-label) and registers bidirectional ScrollTriggers
    reducedFlag = false;
    appMod.initGSAPAnimations();
    assert.ok(stats.scrollTriggers >= 3, 'Expected multiple ScrollTrigger definitions');
    assert.ok(scrollTriggerConfigs.some((c) => c.trigger === '.hero-section' && c.scrub));
    assert.ok(scrollTriggerConfigs.some((c) => c.trigger === '.luxury-story' && c.scrub));
    assert.ok(scrollTriggerConfigs.some((c) => c.trigger === '.cta-shell' && c.scrub));
    assert.ok(scrollTriggerConfigs.some((c) => c.trigger === '.ritual-shell' && c.scrub));
    assert.ok(scrollTriggerConfigs.some((c) => c.trigger === '.site-footer' && c.scrub));
    assert.ok(scrollTriggerConfigs.some((c) => typeof c.onEnterBack === 'function'));
    assert.equal(
      timelineToCalls.some((c) => c.target === '.hero-editorial' && typeof c.vars?.opacity === 'number' && c.vars.opacity < 1),
      false,
      '.hero-editorial must never fade below full opacity on scroll'
    );
    assert.equal(headline.getAttribute('aria-label'), 'Kopi dan kriya dalam keranjang.');
    const initialClips = headline.querySelectorAll('.kt-clip').length;
    assert.equal(initialClips, 5);
    assert.ok(globalThis.document.body.classList.contains('gsap-motion-active'));

    // Re-running initGSAPAnimations reverts prior context cleanly and never double-wraps .kt-clip
    appMod.initGSAPAnimations();
    assert.ok(stats.revertCalls >= 1);
    assert.equal(headline.querySelectorAll('.kt-clip').length, initialClips);

    // 3. renderCatalog with unchanged filter signature does not replay entrance flash; changing filter triggers stagger + refresh
    const fromToBefore = stats.fromToCalls;
    const refreshBefore = stats.refreshes;
    appMod.renderCatalog();
    assert.equal(stats.fromToCalls, fromToBefore, 'Unchanged filter signature must not replay card entrance animation');
    // Switching category triggers fresh staggered entrance + ScrollTrigger refresh
    appMod.initEventBindings?.();
    tabMakanan._handlers.click?.();
    assert.ok(stats.fromToCalls > fromToBefore, 'Filter change must trigger card stagger entrance');
    assert.ok(stats.refreshes > refreshBefore, 'Filter change must refresh ScrollTrigger layout bounds');
  } finally {
    globalThis.setInterval = nativeSetInterval;
    Object.entries(prevGlobals).forEach(([k, v]) => {
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
    });
  }
});
