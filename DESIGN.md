# Atelier Nusantara design reference

Warm paper surfaces, dark ink, forest-green actions, terracotta prices and
editorial serif headings define the storefront. The admin workspace shares
this palette with denser tables and a full-viewport shell.

**Dial:** ENERGY 2 / RHYTHM 3 / MOTION 3.

This reference records `styles/main.css` and `scripts/app.js`, not planned features.

## Tokens

Current `:root` values:
```css
:root {
  --bg-canvas: #f5efe7;
  --bg-canvas-subtle: #efe3d2;
  --bg-card: #fffcf7;
  --bg-card-muted: #f7f1e7;
  --border-hairline: rgba(29, 23, 19, 0.08);
  --border-strong: rgba(29, 23, 19, 0.14);
  --border-focus: #1D1713;

  --ink-primary: #1d1713;
  --ink-secondary: #4d4138;
  --ink-tertiary: #6E5B4F;
  --ink-inverted: #fffaf4;

  --accent-matcha: #2d4838;
  --accent-matcha-soft: #e8f0e6;
  --accent-matcha-hover: #1d3127;
  --brand-forest: var(--accent-matcha);
  --accent-terracotta: #A34825;
  --accent-terracotta-soft: #f8ecdf;
  --accent-terracotta-hover: #8A3718;
  --accent-ochre: #c99b52;
  --accent-qris: #c92a2a;
  --accent-gold: #d8b06a;

  --status-success: #2d6246;
  --status-success-bg: #edf5ef;
  --status-pending: #8a5a12;
  --status-pending-bg: #faf0dc;
  --status-danger: #991b1b;
  --status-danger-bg: #fde8e8;

  --font-serif: 'Playfair Display', Georgia, 'Times New Roman', serif;
  --font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', Consolas, monospace;

  --space-unit: 8px;
  --container-max: 1280px;
  --header-height: 80px;

  --shadow-subtle: 0 2px 10px rgba(29, 23, 19, 0.02);
  --shadow-card: 0 14px 32px rgba(29, 23, 19, 0.08);
  --shadow-float: 0 24px 54px rgba(29, 23, 19, 0.14);
  --shadow-overlay: 0 38px 80px rgba(29, 23, 19, 0.22);
  --shadow-modal: 0 28px 64px rgba(29, 23, 19, 0.22);

  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --radius-full: 9999px;

  --ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-natural: cubic-bezier(0.4, 0, 0.2, 1);
  --trans-fast: 160ms var(--ease-natural);
  --trans-normal: 280ms var(--ease-spring);
}
```

`--brand-forest` is an alias used by admin markup. Component values are not all
tokenized: catalog surfaces use `#fbf8f3`, product cards use white with a `12px`
radius, primary/secondary buttons use `10px`, and admin table containers use
`8px`. Modal declarations reference `--shadow-modal`.

## Typography

Playfair Display is used for editorial headings and product titles; Plus Jakarta
Sans for body text, controls and navigation; JetBrains Mono for prices and numeric
details. Google Fonts is loaded non-blockingly with `display=swap` and system fallbacks. Root size is `16px` and
body line height is `1.6`.

The hero heading uses `clamp(2.7rem, 5vw, 4.8rem)`, line height `0.98` and tracking
`-0.035em`; at `768px` and below its size becomes `clamp(2.6rem, 12vw, 4rem)`.

## Layout and responsive behavior

- Container width is capped at `1280px`, with fluid `16–32px` horizontal padding;
  at `1024px` and below padding becomes `20px`.
- Desktop hero columns are `minmax(0, 1fr) minmax(360px, 0.78fr)`, with a
  `clamp(48px, 9vw, 136px)` gap. At `768px` and below they become one column,
  with a `44px` gap and `40px` / `64px` top / bottom section padding.
- Catalog columns use `repeat(auto-fill, minmax(280px, 1fr))`, then two columns
  at `1024px` and below, and one at `640px` and below.
- At `768px` and below, `--header-height` becomes `56px`, desktop navigation is
  hidden, the fixed bottom bar is displayed, the cart fills the width, and
  category tabs scroll horizontally. Body and drawer spacing includes safe-area insets.
- At `640px` and below, payment, quick-view, receipt, order-tracker and merchant
  configuration dialogs use bottom-sheet rules. A `680px` quick-view grid rule
  exists, but the later `1024px` rule wins with `1fr 1.1fr` columns. This existing
  cascade is retained rather than silently redesigned.
- The admin shell is full viewport with a `232px` rail. At `768px` and below,
  the rail becomes horizontal navigation, settings and overview grids become
  single-column, and metrics use two columns.
- Receipt print rules isolate the slip on `80mm` paper, using a `76mm` wrapper
  and `2mm` padding. Print overrides remain separate from screen styles.

## Motion and interaction

`initGSAPAnimations()` leaves the page completely static if GSAP or ScrollTrigger is unavailable or `prefers-reduced-motion: reduce` is active (reverting cleanly on preference change). Otherwise a modular GSAP 3.12.5 + ScrollTrigger + `gsap.matchMedia()` bidirectional spatial choreography drives unmistakable scroll-coupled and interactive motion per section while preserving full readable contrast (`opacity: 1` across scroll transitions, no washed-out headings or ghosted hero text):

- Global shell: top `#scroll-progress-bar` scrubs `scaleX(0 -> 1)` across the full document, `#site-header` toggles `.is-scrolled`, desktop `.nav-links` sync active state across `#katalog`, `#filosofi`, and `#pembayaran-info`, cart updates pop `#cart-badge` / `#mob-cart-badge` on count changes, and `window.load` + `document.fonts.ready` recalibrate ScrollTrigger positions with `ignoreMobileResize: true`.
- Kinetic typography: display headings split into clipped `.kt-clip > .kt-word` masks (`aria-label` preserved on parent, nested inline tags such as `<em>` retained without double-wrapping) and scrub/toggle transform-only (`yPercent`/`rotateZ`, settling before upper-mid viewport) so headlines stay crisp at `opacity: 1` in both scroll directions.
- Hero (`#hero`): initial timeline reveals `.hero-headline` and `.showcase-card`; orbital capsule & spark canvas (`#hero-field-canvas`) rotates along elliptical concentric orbits around Hero center, expands radially and accelerates swirl velocity proportionally with scroll progress & speed, parts dynamically around the pointer (`175px` force radius), and pauses via `IntersectionObserver` outside the viewport; bidirectional scroll `scrub` separates `.hero-editorial`, `.hero-kicker`, `.hero-actions`, `.hero-visual`, `.showcase-card`, `.showcase-tag`, and `.showcase-img-wrap img` across 6 opposing 3D depth planes without reducing `.hero-editorial` opacity; fine pointers add micro 3D tilt on `.showcase-card`, `.story-dossier`, and `.ritual-ticket` plus magnetic pull on primary CTAs.
- Catalog (`#katalog`): container `.catalog-section` and `.toolbar-wrapper` remain static and interactive at all times while `#tab-active-slider` glides beneath the active category button; `bindCatalogCardBatch` applies bidirectional `ScrollTrigger.batch` waves (`onEnter` and `onEnterBack` with 3D `rotateX`/`scale` and `opacity: 1`) alongside filter/category/search transitions and reversible scroll-velocity skew (`skewY` clamped to `±2.4deg`) across `#product-grid`, skipping unchanged background inventory polls while refreshing ScrollTrigger bounds on count changes.
- Story (`#filosofi`), Payment (`#pembayaran-info`), Closing CTA (`.final-cta`), and Footer (`footer.site-footer`): desktop viewports only pin `.story-stage-pin` (`start: top ${pinTop}px` clear of `#site-header`, `end: '+=680'`, `anticipatePin: 1`) when `width >= 960px`, `height >= 540px`, and measured `stageHeight <= innerHeight - pinTop - 18` so tall stages never clip beneath `#site-header`; shorter laptop viewports automatically run a pinless `.luxury-story` scrub (`top 74% -> bottom 32%`) driving the same `#story-rail-fill`, bidirectional Steps 1–3, and 3D `.story-dossier` motion alongside clickable `.story-timeline-rail` buttons and `#story-panel-1` `.story-variant-chip` previews. `[data-count-to]` replays in both directions; `#pembayaran-info` drives scrubbed 3D spatial arrivals on `.ritual-shell`, `.ritual-ticket`, and staggered `.ritual-badge` pills alongside viewport-gated QR laser scanline and live cart-synced `.ritual-preset-btn` / `.ritual-faq-item` controls; Matte Forest `.cta-shell` zooms from `scale: 0.89` + `rotateX` arrival to `top 58%`; and `.site-footer` columns scrub cleanly to bottom rest. Section containers stay free of CSS `perspective` (so pinned fixed layers never break into empty pin spacers), GSAP passes per-element `transformPerspective: 1100`, and `body.gsap-motion-active` disables `scroll-behavior: smooth` and conflicting `transition: transform` rules while keeping off-axis horizontal travel off narrow mobile viewports (`<= 768px`).

Reduced-motion CSS sets animation and transition durations to `0.01ms`, limits
animation iterations to one and disables smooth scrolling. Admin row/link
transition overrides remain scoped to their components. These rules do not remove
every hover transform and are not a WCAG AAA certification. Keyboard focus uses
a `2px` terracotta outline with a `3px` offset. Important declarations for focus,
hidden views, print and bottom sheets remain cascade safeguards, including
overrides of existing inline styles.

## Maintenance boundaries

Admin navigation uses `.admin-section-nav` and `.admin-section-view`; the Tools
section uses the shared settings-card layout, not a separate `.admin-view-tools`
component. Workspace header and rail declarations are grouped with their owning
selectors. Breakpoint, print and reduced-motion rules remain separate because
they apply under different conditions.

`tests/design-contract.test.mjs` compares the documented root tokens with the
stylesheet and checks for obsolete branding and decorative HTML comment banners.
It does not validate visual rendering; responsive changes still need browser checks.
