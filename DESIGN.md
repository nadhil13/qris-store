# Atelier Nusantara design reference

Warm paper surfaces, dark ink, forest-green actions, terracotta prices and
editorial serif headings define the storefront. The admin workspace shares
this palette with denser tables and a full-viewport shell.

**Dial:** ENERGY 2 / RHYTHM 2 / MOTION 2.

This reference records `styles/main.css` and `scripts/app.js`, not planned features.

## Tokens

Current `:root` values:
```css
:root {
  --bg-canvas: #f5efe7;
  --bg-canvas-subtle: #efe3d2;
  --bg-card: rgba(255, 252, 247, 0.76);
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
  --status-pending: #c08a38;
  --status-pending-bg: #faf0dc;

  --font-serif: 'Playfair Display', Georgia, 'Times New Roman', serif;
  --font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  --space-unit: 8px;
  --container-max: 1280px;
  --header-height: 80px;

  --shadow-subtle: 0 2px 10px rgba(29, 23, 19, 0.02);
  --shadow-card: 0 14px 32px rgba(29, 23, 19, 0.08);
  --shadow-float: 0 24px 54px rgba(29, 23, 19, 0.14);
  --shadow-overlay: 0 38px 80px rgba(29, 23, 19, 0.22);

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
`8px`. Existing modal declarations reference `--shadow-modal`, which is not
defined in `:root`; it is not a supported token.

## Typography

Playfair Display is used for editorial headings and product titles; Plus Jakarta
Sans for body text, controls and navigation; JetBrains Mono for prices and numeric
details. Google Fonts is imported with `display=swap`. Root size is `16px` and
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

`initGSAPAnimations()` returns if GSAP is unavailable or reduced motion is
requested. Otherwise it animates opacity and vertical position with `power2.out`:

| Target | Initial Y | Duration | Delay |
| --- | --- | --- | --- |
| `.site-header` | `-16px` | `0.6s` | `0s` |
| `.hero-headline` | `24px` | `0.8s` | `0.1s` |
| `.hero-description` | `16px` | `0.7s` | `0.2s` |
| `.hero-actions` | `12px` | `0.6s` | `0.3s` |
| `.showcase-card` | `28px` | `0.9s` | `0.25s` |

ScrollTrigger is registered when available. Each `.reveal-section` gets a one-time
`30px` / opacity entrance lasting `0.75s`, starting at `top 85%`. The initializer
does not implement pointer-following tilt or magnetic buttons. CSS still provides
hover transforms, including the showcase card's fixed `rotateX(0.5deg)` and
product-image zoom.

Reduced-motion CSS sets animation and transition durations to `0.01ms`, limits
animation iterations to one and disables smooth scrolling. Admin row/link
transition overrides remain scoped to their components. These rules do not remove
every hover transform and are not a WCAG AAA certification. Keyboard focus uses
a `2px` terracotta outline with a `3px` offset. Important declarations for focus,
hidden views, print and bottom sheets remain cascade safeguards, including
overrides of existing inline styles.
