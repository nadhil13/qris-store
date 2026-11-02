# Admin Full Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the small admin modal with a spacious frontend-only admin workspace that manages the existing storefront state and synchronizes changes across same-origin tabs.

**Architecture:** Keep `index.html`, `styles/main.css`, and `scripts/app.js` as the existing application boundaries. Add a full-viewport admin shell with section switching, preserve localStorage as source of truth, and extend the current `BroadcastChannel` plus `storage` adapter for supported store domains. Keep QRIS image storage and QRIS payload generation separate so a static image is never falsely treated as a dynamic payment payload.

**Tech Stack:** Native HTML/CSS, ES modules, existing GSAP, localStorage, BroadcastChannel, storage events, existing QRIS EMVCo utilities, browser validation.

**Spec:** `docs/superpowers/specs/2026-11-02-admin-full-workspace-design.md`

## Global Constraints

- Realtime means same-origin tabs and windows using `BroadcastChannel` with a `storage` event fallback.
- This phase provides no backend, database, cross-device realtime, server authentication, or payment settlement verification.
- Keep all values sourced from real application state. Do not invent charts, activity feeds, trends, or customer data.
- Use the existing Editorial Commerce system: warm parchment surfaces, matcha operational accent, terracotta for attention/destructive states, Playfair Display, Plus Jakarta Sans, and JetBrains Mono.
- Dials remain ENERGY 2 / RHYTHM 2 / MOTION 2.
- Native controls, visible focus, Escape handling, reduced motion, empty/loading/error states, and no mobile horizontal overflow are required.

## Review Focus

- A remote order/product/store update must refresh the visible section without closing or resetting the workspace; test with two same-origin tabs.
- A malformed or missing localStorage domain must leave the rest of the workspace usable; test invalid orders, products, store, and QRIS values independently.
- A QRIS image without a readable payload must remain an honest static preview and must not generate a dynamic payload; test image-only configuration.
- A storefront setting without an existing state model must not become a dead control; test every navigation item and control for a real destination or behavior.
- Mobile and reduced-motion layouts must preserve access to every section; test at 390px and with `prefers-reduced-motion`.

---

### Task 1: Building the full-viewport admin shell

**Files:**
- Modify: `index.html` admin dashboard section around the existing `admin-dashboard-modal-backdrop`
- Modify: `styles/main.css` admin workspace and responsive rules
- Modify: `scripts/app.js` admin section switching and workspace open/close behavior
- Test: browser checks for workspace geometry, navigation, keyboard, and mobile overflow

**Interfaces:**
- Consumes: `openAdminDashboardModal()`, `closeAdminDashboardModal()`, `switchAdminTab()`, existing admin modal IDs and rendered table helpers.
- Produces: `admin-workspace-shell`, section navigation for `overview`, `orders`, `catalog`, `storefront`, `payments`, and `tools`, and `switchAdminSection(sectionName)`.

- [ ] **Step 1: Write the failing browser check**

  Assert after opening admin that:
  - the workspace shell occupies the available viewport instead of using the current small modal width;
  - each navigation button has a corresponding visible section;
  - switching sections changes the active section;
  - Escape closes the workspace;
  - at a 390px viewport, `document.documentElement.scrollWidth <= window.innerWidth`.

- [ ] **Step 2: Run the check and verify it fails**

  Run the existing local server and browser check against `http://localhost:5500/index.html?admin=1`.
  Expected: the current modal structure has no full workspace section contract and at least one assertion fails.

- [ ] **Step 3: Implement the shell and section navigation**

  Add semantic workspace markup with a persistent desktop rail, top bar, and section containers. Implement `switchAdminSection(sectionName)` using an allowlist of the six named sections. Preserve existing order and catalog controls by moving them into their matching sections rather than duplicating them. Keep mobile navigation stacked or horizontally scrollable within its own container without page overflow.

- [ ] **Step 4: Add purposeful workspace motion**

  Update the existing GSAP admin entrance/change animation to target the workspace header, rail, active section, and remote-change row. Do not add perpetual loops. Return immediately when reduced motion is requested.

- [ ] **Step 5: Run the browser check and syntax validation**

  Run the browser checks, `node --check .\\scripts\\app.js`, and `node --check .\\scripts\\qris.js`.
  Expected: all shell, section, Escape, mobile, and syntax assertions pass.

### Task 2: Wiring storefront controls to real state

**Files:**
- Modify: `index.html` new `storefront` and `tools` sections
- Modify: `styles/main.css` storefront settings forms and states
- Modify: `scripts/app.js` store settings state, render functions, and publish calls
- Test: browser checks for each supported setting and same-origin propagation

**Interfaces:**
- Consumes: `state.productsList`, `state.merchantWhatsApp`, `saveStateToStorage()`, `publishAdminChange(domain, details)`, `renderCatalog()`, and `refreshAdminWorkspace()`.
- Produces: `renderAdminStorefrontSettings()`, `saveAdminStorefrontSetting(key, value)`, and explicit `store` or `products` domain messages.

- [ ] **Step 1: Write the failing browser checks**

  Assert that:
  - opening Storefront shows real controls for supported product/store values;
  - changing a supported setting updates localStorage and the customer-facing render;
  - a second same-origin tab receives the update without reload;
  - unsupported content is not represented by a dead button;
  - loading, empty, and error states have actionable text.

- [ ] **Step 2: Run the checks and verify they fail**

  Expected: the current dashboard has no Storefront section or generic settings contract.

- [ ] **Step 3: Implement supported settings only**

  Add controls for the existing product model, availability, pricing, categories, descriptions, merchant WhatsApp, and existing storefront configuration. Use explicit labels and validation. Keep unsupported copy surfaces out of the navigation until they have state and rendering support.

- [ ] **Step 4: Implement remote refresh**

  Ensure product/store mutations publish their domain, reload the affected localStorage domain in the receiving tab, rerender the admin section, and refresh the storefront render without closing the workspace.

- [ ] **Step 5: Run the checks**

  Expected: all supported controls update the real storefront state, remote changes appear in the second tab, and no dead controls are present.

### Task 3: Adding the QRIS manager with honest static/dynamic boundaries

**Files:**
- Modify: `index.html` Payments section and QRIS configuration controls
- Modify: `styles/main.css` QRIS manager layout, preview, validation, and error states
- Modify: `scripts/app.js` QRIS configuration persistence and admin rendering
- Modify: `scripts/qris.js` only if a focused validation/helper is needed
- Test: browser checks for image-only, payload-valid, payload-invalid, and checkout generation paths

**Interfaces:**
- Consumes: `parseEMVCoQRIS()`, `convertStaticToDynamicQRIS()`, `renderQRCodeSVG()`, `STORAGE_KEY_QRIS_CONFIG`, `state.customStaticQRIS`, and existing merchant configuration behavior.
- Produces: `renderAdminQRISSettings()`, `saveAdminQRISConfig(config)`, and a persisted QRIS config that distinguishes `imageDataUrl`, `staticPayload`, and `mode`.

- [ ] **Step 1: Write the failing browser checks**

  Assert that:
  - an uploaded image is previewed and persisted locally;
  - image-only configuration is labeled static and does not claim dynamic generation;
  - a valid static payload can generate a dynamic payload with amount and invoice;
  - an invalid payload shows a recoverable error and does not overwrite the last valid configuration;
  - a QRIS mutation updates another same-origin admin tab.

- [ ] **Step 2: Run the checks and verify they fail**

  Expected: the current QRIS flow supports payload configuration but has no admin image upload manager or explicit image-only state.

- [ ] **Step 3: Implement QRIS configuration storage and preview**

  Use a file input with a size/type guard and store the resulting data URL in localStorage for this frontend-only phase. Store the payload string separately. Use the existing parser to validate the payload and render a clear empty/loading/error state. Do not decode arbitrary image pixels into a payload unless a verified decoder is present.

- [ ] **Step 4: Integrate dynamic generation**

  When a valid payload exists, keep using `convertStaticToDynamicQRIS()` at checkout. Use the uploaded image as a visual fallback/merchant reference only. Surface the exact limitation when no payload is available.

- [ ] **Step 5: Run QRIS and syntax checks**

  Expected: image-only, valid-payload, invalid-payload, and checkout cases all produce the specified state; syntax checks pass.

### Task 4: Completing realtime workspace verification and hardening

**Files:**
- Modify: `scripts/app.js` only for isolated storage loading, message details, and error surfacing discovered during tests
- Modify: `styles/main.css` only for verified responsive/focus/state fixes
- Modify: `sw.js` cache version
- Test: full browser regression matrix

**Interfaces:**
- Consumes: all workspace sections and mutation functions from Tasks 1-3.
- Produces: verified end-to-end admin workspace with cache-busted assets and no stale shell.

- [ ] **Step 1: Write the failing regression matrix**

  Cover login, logout, close, every workspace navigation item, order status change, product add/edit/delete, WhatsApp save, QRIS image/payload save, CSV export, browser notification controls, Escape, malformed storage recovery, two-tab synchronization, mobile width, and reduced motion.

- [ ] **Step 2: Run the matrix before hardening**

  Record every failure by behavior, not by screenshot appearance.

- [ ] **Step 3: Fix only failures caused by the new workspace**

  Keep errors visible in the workspace status region. Do not silently fall back to a success-shaped state. Preserve unrelated existing behavior.

- [ ] **Step 4: Update cache version and run final checks**

  Increment the service worker cache version, run syntax checks, file problems checks, the Impeccable detector, and the complete browser matrix.
  Expected: no JavaScript errors, no horizontal overflow, no dead controls, and the QRIS limitation remains visible.

- [ ] **Step 5: Commit**

  ```bash
  git add index.html styles/main.css scripts/app.js scripts/qris.js sw.js docs/superpowers/specs/2026-11-02-admin-full-workspace-design.md docs/superpowers/plans/2026-11-02-admin-full-workspace.md
  git commit -m "feat: expand admin into full workspace"
  ```

