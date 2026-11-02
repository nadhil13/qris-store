# Admin Workspace & Local Realtime Design

## Intent

Replace the current oversized admin modal with a focused operational workspace for Atelier Nusantara. The admin should be able to see orders that need action, inspect recent order activity, manage the catalog, and confirm store configuration without losing the existing checkout and order flows.

The first delivery keeps the project backend-free. Realtime means same-origin tabs and windows stay synchronized through `BroadcastChannel` with a `storage` event fallback. It is not cross-device realtime and the UI will state that limitation honestly.

## Goals

- Make incoming and active orders the primary admin decision.
- Show real data from the existing order and product state, with loading, empty, and error states.
- Make changes in one tab refresh other open tabs without manual reload.
- Preserve existing order status actions, product CRUD, WhatsApp configuration, QRIS configuration, CSV export, notification permission, and logout.
- Keep the dashboard usable on desktop and mobile.
- Create a narrow realtime adapter boundary so a future backend can replace local synchronization.

## Non-goals

- No database, hosted service, API, WebSocket server, or cross-device synchronization in this phase.
- No invented sales metrics, activity feed entries, customer identities, or performance claims.
- No change to customer checkout or payment verification behavior.
- No new logo, avatar, or decorative asset.

## Anti-goals

- Do not keep the generic “four stat cards plus giant table” hierarchy.
- Do not label browser-local synchronization as full realtime.
- Do not add charts unless a real question and sufficient real data exist.
- Do not move admin authentication into a false security boundary. The current frontend credential remains a demo limitation and should be clearly treated as such.

## Direction

Use the existing Editorial Commerce system from `DESIGN.md`: warm parchment surfaces, matcha as the operational accent, terracotta only for attention states, Playfair Display for editorial headings, Plus Jakarta Sans for controls, and JetBrains Mono for invoice and numeric precision.

Dashboard dials remain ENERGY 2 / RHYTHM 2 / MOTION 2. The identity motif is the “operations rail”: a compact live-state rail appears beside the current work queue, while the rest of the interface stays matte and quiet.

## Approaches considered

1. **BroadcastChannel plus storage events, selected for this phase**
   - Works with the current static site and no dependency or server.
   - Provides same-origin multi-tab synchronization.
   - Honest limitation: it cannot synchronize separate devices or guarantee persistence beyond browser storage.

2. **Supabase Realtime**
   - Correct production direction for cross-device order updates, database persistence, and authenticated admin access.
   - Requires project credentials, schema, security policies, and a migration from local state.
   - Deferred until backend ownership and credentials are available.

3. **Custom API plus WebSocket/SSE**
   - Maximum control and integration flexibility.
   - Too much operational surface for the current static project and deferred backend decision.

## Workspace structure

- **Header:** store identity, explicit “Browser sync” status, last sync time, connection explanation, and logout.
- **Operations rail:** active order count, pending action count, and a short empty/error state when the local sync channel is unavailable.
- **Work queue:** orders grouped by “Needs action” and “Recently updated”, with the status transition as the primary row action.
- **Catalog workspace:** searchable product list, availability state, price, and existing CRUD form.
- **Store tools:** WhatsApp destination, QRIS configuration, notifications, and CSV export remain available as secondary tools.

The layout uses a real `<main>` region inside the modal, native buttons, visible focus states, and mobile sections that stack rather than overflow.

## Motion and interaction

GSAP is used for hierarchy, not decoration. The workspace enters with a short
header-to-queue sequence, tab changes crossfade the active work surface, and a
newly received order gets one restrained row highlight so the admin knows what
changed. Hover states expose row affordances and status actions without lifting
every surface. No infinite floating or pulsing loops are used. A
`prefers-reduced-motion: reduce` path removes transforms and reveal timing while
keeping state changes and focus behavior intact.

## Realtime contract

Create a small in-memory adapter around the existing state:

- `createAdminRealtimeChannel(onMessage)` returns `{ publish, close }`.
- Published messages include a version, source id, timestamp, and changed domain (`orders`, `products`, or `store`).
- Local state remains the source of truth for this phase.
- Incoming messages trigger a storage reload and a targeted dashboard render.
- `storage` remains the fallback for browsers without `BroadcastChannel`.
- All sync errors surface in the dashboard status region and retain the last known local data.

## States and verification

- Loading: dashboard status says the workspace is preparing local data.
- Empty: queue explains that no orders exist and points to the storefront for the next order.
- Error: sync status explains that live browser sync is unavailable while local data remains usable.
- Realtime verification: changing an order or product in one open tab updates another open tab without reload.
- Existing customer flows must still pass: login, logout, order advancement, product CRUD, QRIS settings, WhatsApp save, export, notifications, and responsive layout.
