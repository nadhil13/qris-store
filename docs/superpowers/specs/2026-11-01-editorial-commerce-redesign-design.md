# Editorial Commerce Redesign

## Intent

Make Atelier Nusantara feel human-designed, professional, clean, and
comfortable to browse. The redesign keeps the warm Nusantara identity, but
removes generic AI decoration, repeated marketing patterns, and motion that
competes with shopping.

## User and success

The primary user is a shopper scanning products, choosing a variant, adding to
cart, and paying with QRIS or WhatsApp. Success means the product catalog is
the visual focal point, the page is easy to scan on mobile and desktop, and
every existing purchase/admin flow remains usable.

## Goals

- Keep all existing product, cart, checkout, QRIS, receipt, WhatsApp, order
  tracking, PWA, and admin behaviors.
- Recompose the page around one clear hero focal point and the product catalog.
- Reduce the active visual palette to paper, ink, matcha, and terracotta as a
  restrained action accent.
- Use typography and spacing for hierarchy rather than badges, glows, grids,
  and excessive rounded containers.
- Replace continuous floating/parallax motion with short entrance transitions,
  intentional hover feedback, and reduced-motion-safe behavior.
- Preserve real content and remove or label any claim that is not backed by
  actual data.
- Verify desktop, mobile, keyboard navigation, scroll down/up behavior, and
  console output.

## Non-goals

- No backend, payment gateway, authentication, or database implementation.
- No replacement of the user's QRIS, WhatsApp, or product data.
- No new decorative assets, avatars, testimonials, or fabricated statistics.
- No framework migration or dependency installation.

## Anti-goals

- No blue-purple gradients, AI-style glow stacks, background dot/grid texture,
  endless floating cards, fake terminal patterns, or generic feature-card
  sections.
- No animation that hides content when scrolling back upward.
- No dead navigation or controls.

## Existing constraints

- The project is a static HTML/CSS/ES-module application.
- `index.html` owns the document structure, `styles/main.css` owns the visual
  system, and `scripts/app.js` owns state, interactions, and GSAP motion.
- State is stored in browser `localStorage`; this remains unchanged.
- `DESIGN.md` defines the warm paper, matcha, terracotta, Playfair Display, and
  Plus Jakarta Sans direction.

## Approaches considered

1. **Editorial Commerce, selected.** Keep the warm identity, simplify the hero,
   make the catalog the main visual anchor, and use restrained motion. This
   best preserves the current brand and all functionality.
2. **Quiet Luxury Boutique.** Use larger imagery, more whitespace, and fewer
   sections. It would be premium, but would hide too much utility for the
   current catalog and admin-heavy scope.
3. **Modern Market Utility.** Prioritize filters, scanability, and conversion
   above editorial expression. It would be efficient, but would weaken the
   existing artisanal identity.

## Proposed visual and interaction changes

- Header: reduce competing controls, maintain clear navigation and cart access,
  and keep the open-status indicator as a real operational state.
- Hero: one editorial headline, one primary catalog action, and a real product
  showcase. Remove redundant feature pills and decorative claims from the
  first viewport.
- Catalog: stronger title, search, category, sort, and product-card hierarchy.
  Cards stay useful but become flatter and less uniformly decorated.
- Story and payment sections: shorten copy, improve reading width, and use
  visual variation based on content rather than repeated cards.
- Motion: one-time hero entrance, one-time viewport reveals, and subtle hover
  states. No infinite floating loops or scroll-up reversals.
- Responsive behavior: maintain a comfortable mobile layout, horizontal
  category scrolling where already used, 44px controls, and no horizontal
  overflow.
- Content: retain product facts supplied by the project; remove unsupported
  performance, quality, or customer claims rather than invent replacements.

## Builder decisions left

- Exact spacing and type scale will follow the current `DESIGN.md` tokens.
- Existing product imagery will be reused; no new assets will be generated.
- The implementation will be split into small CSS/markup/motion edits so each
  behavior can be verified without changing the state model.
