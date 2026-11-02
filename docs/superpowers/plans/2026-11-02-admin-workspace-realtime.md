# Admin Workspace & Local Realtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current admin modal with a polished operational workspace and synchronize admin-visible state across same-origin tabs without claiming cross-device realtime.

**Architecture:** Keep `localStorage` as the current source of truth, add a small browser realtime adapter using `BroadcastChannel` with a `storage` fallback, and render the admin workspace from explicit sections for queue, catalog, and store tools. Keep existing public functions and customer flows intact while routing admin mutations through one refresh and publish path.

**Tech Stack:** Static HTML, CSS, ES modules, existing local GSAP and ScrollTrigger vendors, `BroadcastChannel`, `localStorage`, browser automation, Node syntax checks.

**Spec:** `docs/superpowers/specs/2026-11-02-admin-workspace-realtime-design.md`

## Global Constraints

- “Realtime” in this phase means same-origin tabs and windows only; no database, hosted service, API, WebSocket server, or cross-device synchronization.
- Use the existing Editorial Commerce system from `DESIGN.md`: warm parchment, matcha operational accent, terracotta attention states, Playfair Display, Plus Jakarta Sans, and JetBrains Mono for precision values.
- Keep dials at ENERGY 2 / RHYTHM 2 / MOTION 2.
- Do not add invented metrics, activity feed entries, customer identities, testimonials, or performance claims.
- Preserve existing checkout, QRIS, WhatsApp, order tracking, notification, CSV export, product CRUD, login, and logout behavior.
- Every admin data view has loading, empty, and error states.
- No infinite motion loops; reduced motion removes transforms and reveal timing.

## Review Focus

- A second tab receives an order status change and rerenders without a reload; verify in the realtime adapter task.
- A browser without `BroadcastChannel` still synchronizes through `storage`; verify in the realtime adapter task.
- Empty, malformed, or unavailable local state keeps the dashboard usable and explains the next action; verify in the render task.
- Mobile workspace sections stack without horizontal overflow and controls remain keyboard reachable; verify in the styling task.
- A newly received order is highlighted once, not continuously; verify in the motion task.

---

### Task 1: Add the browser-local realtime adapter and centralized admin refresh

**Files:**
- Modify: `scripts/app.js` around state constants, persistence helpers, admin dashboard functions, product CRUD mutations, and DOM initialization.
- Test: Browser verification with two open tabs; no test framework exists in this static project.

**Interfaces:**
- Produces `createAdminRealtimeChannel(onMessage) -> { publish(change), close() }`.
- Produces `publishAdminChange(domain) -> void`.
- Produces `refreshAdminWorkspace(options = {}) -> void`.
- Existing functions `openAdminDashboardModal`, `adminAdvanceOrderStatus`, `submitNewProduct`, `updateProduct`, `deleteProduct`, `saveAdminMerchantPhone`, and relevant store configuration actions continue to be callable through `window`.

- [ ] **Step 1: Add a failing browser check for same-origin synchronization**

Open two copies of `index.html?admin=1`, authenticate both, change an order status in one, and assert the second tab updates its queue/status without reload. Record the current failure because no channel exists.

- [ ] **Step 2: Implement `createAdminRealtimeChannel(onMessage)`**

Use a unique source id, `BroadcastChannel('atelier-nusantara-admin')` when available, and a `window.storage` listener fallback. Ignore messages from the same source, validate the small message shape `{ sourceId, domain, timestamp }`, and expose `publish` and `close`. Surface channel errors through the admin status region instead of silently swallowing them.

- [ ] **Step 3: Centralize admin rendering in `refreshAdminWorkspace(options = {})`**

Move metric, queue, product, sync status, and notification status updates behind one function. `options` supports `highlightInvoice` and `reason`, so local and remote changes use the same render path.

- [ ] **Step 4: Publish from every existing admin mutation**

After successful order status changes, product create/update/delete, merchant WhatsApp save, QRIS/store configuration changes, and notification preference changes, persist state, publish the relevant domain, and refresh the current workspace. Do not publish during initial load.

- [ ] **Step 5: Add honest loading, empty, and error state data hooks**

Expose status elements for “menyiapkan data”, “belum ada pesanan”, and “sinkronisasi browser tidak tersedia”. Keep the last local data rendered when synchronization fails.

- [ ] **Step 6: Run syntax verification**

Run `node --check .\scripts\app.js` and `node --check .\scripts\qris.js`.

Expected: both commands exit with code 0.

### Task 2: Rebuild the admin workspace markup around operational decisions

**Files:**
- Modify: `index.html:886-1130` admin dashboard modal and product workspace markup.
- Modify: `index.html` cache-busting query for the changed app entry if required.

**Interfaces:**
- Consumes the render ids and actions from Task 1.
- Produces stable regions: `admin-sync-status`, `admin-ops-summary`, `admin-needs-action`, `admin-recent-orders`, `admin-view-products`, and `admin-view-tools`.

- [ ] **Step 1: Replace the equal-stat-first layout**

Create a workspace header with store context, browser-sync status, last sync time, connection explanation, and logout. Use a real `<main>` region inside the dialog.

- [ ] **Step 2: Add the operations rail**

Show only real derived counts already present in state: active orders and orders needing action. Do not add deltas or unsupported performance numbers. Include a clear empty state when no orders exist.

- [ ] **Step 3: Split order work into “Needs action” and “Recently updated”**

Use compact order rows with invoice, customer, item summary, amount, current status, and the one valid next action. Keep the existing status progression and archive behavior.

- [ ] **Step 4: Move catalog management into a focused workspace**

Keep the existing product form and CRUD behavior, but present searchable products with availability, category, price, and explicit edit/delete controls. Preserve visible labels and keyboard operation.

- [ ] **Step 5: Group secondary store tools**

Place WhatsApp, QRIS, CSV export, notification permission, and sound test under a clearly labeled tools area. Preserve every existing action and give each control an accessible name.

- [ ] **Step 6: Add explicit loading and error containers**

Include status regions with `aria-live="polite"` for data preparation, local empty states, and sync errors. Do not use fake skeleton data.

### Task 3: Style and animate the workspace for clean, high-signal admin UX

**Files:**
- Modify: `styles/main.css` admin dashboard rules around the existing admin section and mobile media rules.
- Modify: `scripts/app.js` GSAP admin animation setup near `initGSAPAnimations`.

**Interfaces:**
- Consumes the stable admin regions from Task 2.
- Produces `animateAdminWorkspaceEntrance()` and `animateAdminWorkspaceChange(target)` as internal motion helpers.

- [ ] **Step 1: Replace modal styling with workspace hierarchy**

Use a wider but bounded admin surface, matte parchment panels, restrained borders, deliberate radius variation, one matcha action accent, and no page-wide blur or glow. Make the queue the visual focal point.

- [ ] **Step 2: Add responsive workspace rules**

At mobile widths, stack header actions, operations rail, queue sections, catalog controls, and tool groups. Keep table-like content within intentional horizontal containers only where necessary. Verify `document.documentElement.scrollWidth === document.documentElement.clientWidth`.

- [ ] **Step 3: Add interaction affordances**

Provide distinct hover, active, focus-visible, and disabled states. Ensure all enabled controls have pointer cursors and all keyboard focus remains visible.

- [ ] **Step 4: Add purposeful GSAP motion**

Animate the workspace header into the queue once on open, crossfade active tab content on tab change, and animate a new or changed order row once with a short background emphasis. Do not use infinite loops, floating effects, or opacity states that can hide content after scrolling.

- [ ] **Step 5: Add reduced-motion behavior**

Under `prefers-reduced-motion: reduce`, skip transforms, stagger, and highlight transitions while rendering the same content and focus behavior immediately.

### Task 4: Verify admin workflows, browser-local realtime, and delivery gate

**Files:**
- Modify: `sw.js` cache version if admin CSS/JS cache busting changes require it.
- Modify: `index.html` stylesheet/script query versions if stale PWA assets could mask the change.

**Interfaces:**
- Consumes all workspace, adapter, and motion behavior from Tasks 1-3.

- [ ] **Step 1: Run syntax checks**

Run:

```cmd
node --check .\scripts\app.js
node --check .\scripts\qris.js
```

Expected: both pass.

- [ ] **Step 2: Verify desktop admin flows**

Open `http://localhost:5500/index.html?admin=1`, log in, then exercise: orders tab, advance order, product tab, add product, edit product, delete product, WhatsApp save, QRIS settings, CSV export, notification permission state, sound test, logout, and modal close.

- [ ] **Step 3: Verify browser-local realtime**

Open two admin tabs. Change order status and product availability in one tab. Assert the other tab updates without reload, the sync status timestamp changes, and the changed order highlight runs once.

- [ ] **Step 4: Verify fallback and resilience**

Run with `BroadcastChannel` unavailable, then repeat a cross-tab localStorage update. Clear orders and verify the honest empty state. Corrupt the stored order JSON and verify the error state keeps the workspace usable.

- [ ] **Step 5: Verify mobile and reduced motion**

At 390px width, verify no document overflow, no clipped controls, and keyboard focus visibility. Repeat with reduced motion enabled and verify content is immediately visible without transform-dependent behavior.

- [ ] **Step 6: Run the UI detector and inspect findings**

Run:

```cmd
.\.agents\skills\impeccable\scripts\impeccable.cmd detect --json index.html styles/main.css scripts/app.js
```

Fix any new hard-gate or directly related findings before delivery.

- [ ] **Step 7: Complete the antislop delivery gate**

Record evidence for real controls, empty/loading/error states, responsive behavior, reduced motion, browser-local sync, and the explicit limitation that cross-device realtime requires a future backend.
