# Editorial Commerce Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework Atelier Nusantara into a clean, human-feeling Editorial Commerce storefront while preserving every existing shopping, QRIS, WhatsApp, tracking, PWA, and admin behavior.

**Architecture:** Keep the existing static HTML/CSS/ES-module architecture. Reshape the page with targeted markup/CSS changes, then centralize GSAP setup so hero choreography, one-time ScrollTrigger reveals, hover motion, and reduced-motion behavior do not fight each other or hide content on scroll return.

**Tech Stack:** HTML, CSS, ES modules, GSAP, ScrollTrigger, existing local vendor assets, Playwright browser verification, Node syntax checks.

**Spec:** `docs/superpowers/specs/2026-11-01-editorial-commerce-redesign-design.md`

## Global Constraints

- Keep all existing product, cart, checkout, QRIS, receipt, WhatsApp, order tracking, PWA, and admin behaviors.
- No backend, payment gateway, authentication, or database implementation.
- No new decorative assets, avatars, testimonials, or fabricated statistics.
- No blue-purple gradients, AI-style glow stacks, background dot/grid texture, endless floating cards, fake terminal patterns, or generic feature-card sections.
- No animation that hides content when scrolling back upward.
- `DESIGN.md` defines the warm paper, matcha, terracotta, Playfair Display, and Plus Jakarta Sans direction.
- Every changed interaction must remain keyboard-operable, responsive, and reduced-motion safe.

## Review Focus

- Scroll down then back up: all previously revealed content remains visible and readable. Test in Task 3.
- Empty search/filter result: the catalog keeps an honest empty state and remains recoverable. Test in Task 2.
- Mobile width around 375px: no horizontal overflow and controls remain tappable. Test in Task 2.
- Reduced motion preference: entrance and scroll motion are disabled without hiding content. Test in Task 3.
- Existing checkout/admin flows after visual changes: buttons still invoke the same window hooks. Test in Task 4.

---

### Task 1: Simplify Editorial Page Structure

**Files:**
- Modify: `index.html:90-340`
- Modify: `styles/main.css:380-900`

**Interfaces:**
- Consumes: Existing `window.addToCart`, catalog anchors, product grid, QRIS section, and admin markup.
- Produces: Same IDs/classes used by `app.js`, with a calmer hero, shorter first viewport, and content-led story/payment sections.

- [ ] **Step 1: Write a browser regression check for preserved page anchors and controls**

Use a Playwright page evaluation to assert that `#katalog`, `#filosofi`,
`#pembayaran-info`, `#product-grid`, `#header-cart-btn`, and the checkout/admin
modal roots still exist before changing markup.

- [ ] **Step 2: Run the regression check and record the baseline**

Run the existing local server and browser check. Expected: all required anchors
and controls exist, with the current product grid populated after DOM ready.

- [ ] **Step 3: Refine `index.html` without changing behavior**

Remove redundant hero feature pills and decorative claims from the first
viewport, keep the real chef showcase and its `addToCart` action, retain the
catalog toolbar and all modal/admin markup, and replace unsupported marketing
claims with direct product-oriented copy only where the current text makes an
unsupported guarantee. Keep real destinations and existing IDs.

- [ ] **Step 4: Refine the visual system in `main.css`**

Replace page-wide radial/grid decoration, excessive blur, gradient buttons,
uniform pills, and large floating-card treatment with flat warm surfaces,
intentional 12-16px radii, one matcha action surface, and terracotta as a
small accent. Preserve existing component selectors used by checkout/admin.
Add explicit mobile overflow protection and visible focus styling where needed.

- [ ] **Step 5: Run the browser regression check**

Expected: all original anchors and controls still exist, the catalog still
renders, and no horizontal overflow is present at 375px and desktop widths.

- [ ] **Step 6: Commit**

```cmd
git add index.html styles/main.css
git commit -m "refactor: establish editorial commerce visual system"
```

### Task 2: Make Catalog the Primary Shopping Surface

**Files:**
- Modify: `styles/main.css:1057-1320`
- Modify: `scripts/app.js:716-814`

**Interfaces:**
- Consumes: `renderCatalog()`, `state.activeCategory`, `state.searchQuery`, and existing product-card hooks.
- Produces: A visually prioritized catalog with stable empty state, loading-safe DOM replacement, and preserved product actions.

- [ ] **Step 1: Write the catalog behavior regression check**

Assert that initial render creates product cards, a search with no match creates
`.empty-state`, clearing search restores product cards, and each card still
contains its existing quick-view/add action.

- [ ] **Step 2: Run the check and verify the baseline**

Expected: the existing catalog passes the behavior assertions before visual
changes.

- [ ] **Step 3: Implement catalog hierarchy changes**

Update catalog spacing, toolbar grouping, category tab treatment, search/sort
controls, card media ratios, typography, and action placement. Keep
`renderCatalog()`'s data and window hook behavior intact; only add stable
classes or attributes if CSS needs them. Preserve the honest empty state and
ensure rendering does not trigger a full motion context rebuild for every
keystroke.

- [ ] **Step 4: Run catalog behavior and responsive checks**

Expected: product count, filtering, empty state recovery, quick view, and
mobile layout remain functional; no horizontal overflow at 375px.

- [ ] **Step 5: Commit**

```cmd
git add styles/main.css scripts/app.js
git commit -m "refactor: prioritize catalog browsing hierarchy"
```

### Task 3: Consolidate Smooth GSAP Motion

**Files:**
- Modify: `scripts/app.js:2254-2558`
- Modify: `styles/main.css:2500-2525`

**Interfaces:**
- Consumes: Existing GSAP and ScrollTrigger vendor globals, `.reveal-section`,
  `.product-card`, `.hero-*`, `.showcase-card`, and reduced-motion media query.
- Produces: `initGSAPAnimations()` with one idempotent context, one-time
  viewport reveals, purposeful hover/magnetic motion, and content-visible
  reduced-motion fallback.

- [ ] **Step 1: Write the scroll and reduced-motion regression check**

Assert that after loading, scrolling through the full page, returning to the
top, and revisiting the bottom:

1. the hero headline has opacity at least `0.9`;
2. all visible product cards have opacity at least `0.9`;
3. `#pembayaran-info` has non-empty text;
4. product count remains unchanged.

Also emulate `prefers-reduced-motion: reduce` and assert that content is
visible without waiting for animation.

- [ ] **Step 2: Run the check before the motion refactor**

Expected: capture the current failure or timing-sensitive behavior so the
regression test proves the motion change, not just static markup.

- [ ] **Step 3: Implement the GSAP motion model**

Remove continuous floating loops and duplicate hero/reveal ownership. Keep a
single hero timeline with transform-only entrance values that never leave
content at opacity zero, use `ScrollTrigger` reveals with
`toggleActions: 'play none none none'` or `once: true`, and guard repeated
initialization with the existing context. Keep subtle button hover/magnetic
feedback and the showcase tilt only where it improves orientation. Return
early for reduced motion after clearing any inline hidden state.

- [ ] **Step 4: Run the regression check after the refactor**

Expected: the test passes for scroll down/up, reduced motion, and a fresh page
load. No content is hidden by reverse scrolling.

- [ ] **Step 5: Commit**

```cmd
git add scripts/app.js styles/main.css
git commit -m "fix: make GSAP motion smooth and scroll-safe"
```

### Task 4: Verify Existing Commerce Flows and Visual Quality

**Files:**
- Modify: `index.html`, `styles/main.css`, `scripts/app.js` only if verification exposes a regression.
- Test: Browser verification scenarios, no new test framework required.

**Interfaces:**
- Consumes: Completed visual and motion changes.
- Produces: Verified storefront behavior and a detector/quality report.

- [ ] **Step 1: Run syntax checks**

Run:

```cmd
node --check .\scripts\app.js
node --check .\scripts\qris.js
```

Expected: both commands exit with code 0.

- [ ] **Step 2: Run browser interaction checks**

Verify catalog navigation, category filter, search empty/recovery, quick view,
add to cart, cart drawer, checkout modal, QRIS mode switch, receipt close,
order tracker, WhatsApp links, admin login modal, and Escape-key modal closing.
Expected: each control performs its existing action and no console errors occur.

- [ ] **Step 3: Run responsive and motion checks**

Capture desktop and 375px renders, check `scrollWidth <= clientWidth`, run the
full scroll-down/up regression, and emulate reduced motion. Expected: no
overflow, no hidden content, no console errors.

- [ ] **Step 4: Run the Impeccable detector once over changed targets**

Run:

```cmd
.\.agents\skills\impeccable\scripts\impeccable.cmd detect --json index.html styles/main.css scripts/app.js
```

Expected: address any actionable hard-gate or accessibility finding before
delivery; do not treat stylistic warnings as permission to reintroduce
generic decoration.

- [ ] **Step 5: Commit any verification-only fixes**

```cmd
git add index.html styles/main.css scripts/app.js sw.js
git commit -m "test: verify editorial storefront interactions"
```
