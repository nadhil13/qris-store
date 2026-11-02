# Admin Full Workspace Design

## Intent

Replace the current centered admin modal with a spacious, desktop-first
operations workspace that feels like an actual store back office. The admin
should be able to operate orders, catalog, storefront presentation, store
contact settings, QRIS configuration, and browser notifications without
leaving the workspace.

This phase remains frontend-only. Realtime means same-origin tabs and windows
using `BroadcastChannel` with a `storage` event fallback. It does not provide
cross-device synchronization, server persistence, authentication security, or
payment settlement verification.

## Goals

- Make the admin surface occupy the available viewport instead of behaving
  like a small modal.
- Provide a persistent workspace shell with navigation, a wide content area,
  and clear active context.
- Keep order operations as the primary work queue, with status changes visible
  immediately in other open tabs.
- Add admin controls for the frontend-visible store configuration:
  products, availability, pricing, categories, storefront copy/content where
  existing state supports it, WhatsApp destination, notifications, and QRIS.
- Keep all values sourced from real application state. Do not invent charts,
  activity feeds, trends, or customer data.
- Preserve existing checkout, order tracking, product CRUD, CSV export,
  notification, QRIS, login, and logout behavior.
- Keep desktop spacious and make the workspace stack cleanly on mobile.
- Keep the state and realtime boundary replaceable by a future backend.

## Non-goals

- No backend, database, cross-device realtime, server authentication, or
  multi-admin permissions in this phase.
- No claim that browser-local synchronization is production realtime.
- No claim that an uploaded QRIS image proves settlement or can always be
  converted to a valid dynamic QRIS payload.
- No fabricated analytics, customer activity, testimonials, or performance
  metrics.
- No redesign of the customer storefront beyond wiring supported admin
  settings to its existing rendering surfaces.

## Approaches

### 1. Frontend-only full workspace, selected

Expand the existing admin feature into a route-like full-viewport workspace
inside the static application. Keep localStorage as the source of truth and
use the existing BroadcastChannel/storage adapter for same-origin updates.
This delivers the requested visual and operational improvement immediately
without adding infrastructure.

Trade-off: changes do not reach another device and browser credentials remain
demo-only.

### 2. Supabase Realtime

Move products, orders, store settings, uploaded assets, and admin sessions to
Supabase with row-level security and realtime subscriptions.

Trade-off: this is the correct production direction, but requires project
credentials, schema decisions, migrations, storage policies, and a backend
ownership decision before implementation.

### 3. Custom API and WebSocket

Build a bespoke API, authentication boundary, asset storage, and WebSocket or
SSE layer.

Trade-off: maximum control, but disproportionate operational scope for the
current static project.

## Workspace structure

### Shell

- Full-viewport admin surface rather than a small centered dialog.
- Left navigation on desktop with sections:
  - Overview
  - Orders
  - Catalog
  - Storefront
  - Payments
  - Tools
- Compact top bar with store identity, browser sync status, last sync time,
  logout, and close-to-storefront action.
- Mobile navigation becomes a horizontal or collapsible section switcher
  without horizontal overflow.

### Overview

- Real operational counts only:
  - orders needing action
  - active orders
  - catalog item count
  - recorded order total
- A prominent action queue with the next order decision first.
- No chart unless the existing data can answer a specific operational
  question without inventing a time series.

### Orders

- Wide table on desktop with invoice, customer, items, amount, payment
  record, status, and the next valid action.
- Search/filter controls only when they have real behavior.
- Explicit empty, loading, and error states.
- Status changes publish the order domain and refresh every open same-origin
  workspace.

### Catalog

- Searchable product management surface.
- Edit product name, category, price, tag, image URL, description, and stock
  availability using the existing product model.
- Add and delete actions remain real and visible.
- Product edits publish the product domain and update the storefront in other
  same-origin tabs.

### Storefront

- Expose only frontend content that has an existing state model or can be
  added without fabricating a second content system.
- Supported initial controls: merchant WhatsApp, product catalog content,
  availability, and payment configuration.
- Any unsupported copy section must be marked as not configurable yet rather
  than rendered as a dead control.
- Preview reflects the actual storefront state in the current browser.

### Payments / QRIS

- Upload a static QRIS image as a local browser asset and show a preview.
- Accept the merchant's QRIS payload string as the source for dynamic
  amount/invoice generation.
- Validate and preview the payload before saving.
- At checkout, use the existing `convertStaticToDynamicQRIS` path when a valid
  static payload is available.
- If only an image exists and no payload can be read, keep the image as a
  static display asset and state that dynamic generation is unavailable until
  the payload is supplied.
- Store the configuration locally and publish the store domain to other tabs.
- Clearly label that payment confirmation is an application record, not
  provider settlement verification.

### Tools

- WhatsApp destination.
- Browser notifications and sound testing.
- CSV export.
- Reset/demo state controls only where an explicit confirmation is present.

## Data and realtime contract

Keep localStorage as source of truth for this phase. Extend the existing
adapter domains as needed:

- `orders`
- `products`
- `store`
- `content` only if a real content state model is introduced

Every mutation publishes a source id, timestamp, domain, and relevant entity
identifier. Remote messages reload the affected storage domains and refresh
the visible workspace without closing the active section.

## Visual direction

Use the existing Editorial Commerce system from `DESIGN.md`:

- Warm parchment and paper surfaces keep the admin connected to the storefront.
- Matcha is reserved for active operations and primary actions.
- Terracotta marks attention or destructive actions only.
- Playfair Display carries section hierarchy; Plus Jakarta Sans carries
  controls; JetBrains Mono carries invoices and monetary precision.
- Elevation is used only for the workspace shell and focused dialogs, not
  every row or card.
- Dials: ENERGY 2 / RHYTHM 2 / MOTION 2.
- The identity motif is the operations rail and queue: the interface always
  makes the next store decision visible first.

## Motion and accessibility

- GSAP animates the workspace entrance, section transitions, and one restrained
  highlight for a remote change.
- No perpetual floating, pulsing, or decorative motion.
- `prefers-reduced-motion` removes transforms and timing while preserving
  state changes.
- Native controls, visible focus, Escape handling, and responsive stacking
  remain required.

## Verification

- Test the workspace at desktop and mobile widths with no horizontal overflow.
- Confirm every navigation item changes to a real section.
- Confirm order, product, store, QRIS, notification, CSV, login, logout, and
  close actions work.
- Open two same-origin tabs and verify order, product, store, and QRIS changes.
- Test empty, loading, malformed-storage, invalid-payload, and error states.
- Run JavaScript syntax checks, file problems checks, and the Impeccable
  detector after the UI edit.
