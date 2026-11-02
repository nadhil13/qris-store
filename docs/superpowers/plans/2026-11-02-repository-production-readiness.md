# Repository Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the complete Paket 2 documentation, repository configuration, CI checks, and focused browser-independent regression tests without presenting the frontend demo as a production payment system.

**Architecture:** Keep the static HTML/CSS/JavaScript architecture intact. Add documentation as standalone root files, repository policy under `.github`, a dependency-free Node test harness under `tests/`, and a GitHub Actions workflow that runs the same local checks.

**Tech Stack:** HTML, CSS, browser JavaScript modules, Node.js built-ins, GitHub Actions YAML, Markdown.

**Spec:** `docs/superpowers/specs/2026-11-02-repository-production-readiness-design.md`

## Global Constraints

- Document actual behavior: `localStorage`, BroadcastChannel browser-local sync, demo credentials in client code, and QRIS without settlement webhook.
- Do not add backend, server authentication, database, webhook settlement, or active deployment.
- Do not add production dependencies only for documentation.
- Do not claim QRIS settlement verification.
- Preserve the static HTTP-server workflow and mobile/reduced-motion behavior.
- Keep authored copy free of em dashes and unsupported claims.

## Review Focus

- Malformed or unexpected localStorage must be described as a limitation, not treated as durable storage.
- QRIS payload generation must be documented separately from payment settlement.
- Deployment instructions must not imply that GitHub Pages, Netlify, or Vercel has already been configured.
- CI must fail on syntax, whitespace, missing required files, or failing tests.
- Browser behavior must remain unchanged while test seams are added.

---

### Task 1: Add repository documentation and policy pages

**Files:**
- Create: `ARCHITECTURE.md`
- Create: `DEPLOYMENT.md`
- Create: `SUPPORT.md`
- Create: `PRIVACY.md`
- Create: `TERMS.md`
- Create: `ACCESSIBILITY.md`
- Create: `PERFORMANCE.md`
- Create: `DEMO.md`
- Create: `DATA-MODEL.md`
- Create: `MIGRATION.md`
- Create: `API.md`
- Create: `SECURITY-ROADMAP.md`

**Interfaces:**
- Consumes: Current behavior described in `README.md`, `DESIGN.md`, `scripts/app.js`, `scripts/qris.js`, and `sw.js`.
- Produces: Linked documentation pages with no claims beyond the current frontend-only implementation.

- [ ] **Step 1: Write the architecture and data documentation**

Document browser entry points, state ownership, localStorage keys at a conceptual level, realtime message domains, QRIS flow, and boundaries between storefront and admin. Document product, order, customer, store, and QRIS fields as currently used, marking optional or demo-only values.

- [ ] **Step 2: Write deployment, demo, support, and accessibility documentation**

Document the existing Python HTTP server command, manual hosting options for static files, cache invalidation through `sw.js`, admin demo flow, keyboard and reduced-motion expectations, and support request information. Label every hosting option as a manual guide rather than an active integration.

- [ ] **Step 3: Write privacy, terms, performance, migration, API direction, and security roadmap**

State what browser storage and WhatsApp links can expose, that no server account or settlement verification exists, how the current demo may be used, current performance mechanisms, a staged path to backend migration, a proposed future API shape without fake endpoints, and the security work required before production.

- [ ] **Step 4: Verify documentation integrity**

Run:

```powershell
git diff --check
```

Expected: no whitespace errors, no missing referenced files, and no em dash in authored copy.

- [ ] **Step 5: Commit documentation**

```powershell
git add ARCHITECTURE.md DEPLOYMENT.md SUPPORT.md PRIVACY.md TERMS.md ACCESSIBILITY.md PERFORMANCE.md DEMO.md DATA-MODEL.md MIGRATION.md API.md SECURITY-ROADMAP.md
git commit -m "docs: add production readiness guides"
```

### Task 2: Add repository conventions and GitHub templates

**Files:**
- Create: `.editorconfig`
- Create: `.gitattributes`
- Create: `.github/CODEOWNERS`
- Modify: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Modify: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: Existing issue, pull request, README, and changelog conventions.
- Produces: Consistent editor settings, binary/text handling, ownership defaults, and links to all new guides.

- [ ] **Step 1: Write editor and Git attributes**

Set UTF-8 text handling, LF line endings for source and documentation, two-space indentation for web files, four-space indentation for JSON where appropriate, and binary treatment for `png`, `jpeg`, `jpg`, `gif`, `webp`, and `ico`.

- [ ] **Step 2: Write CODEOWNERS and expand templates**

Set the repository owner as the default owner using the GitHub handle already associated with this repository. Add prompts for security-sensitive changes, documentation impact, and deployment claims without requesting secrets in issues.

- [ ] **Step 3: Link the new guides**

Add a documentation index to `README.md` and an entry to `CHANGELOG.md` for the production-readiness package.

- [ ] **Step 4: Verify repository configuration**

Run:

```powershell
git diff --check
```

Expected: clean output and all README links point to existing files.

- [ ] **Step 5: Commit configuration**

```powershell
git add .editorconfig .gitattributes .github README.md CHANGELOG.md
git commit -m "chore: define repository conventions"
```

### Task 3: Add dependency-free regression tests

**Files:**
- Create: `tests/qris.test.mjs`
- Create: `tests/catalog-contract.test.mjs`
- Create: `tests/run-tests.mjs`
- Modify: `scripts/qris.js` only if a testable export boundary is required
- Modify: `scripts/app.js` only if a small pure helper boundary is required
- Modify: `README.md`

**Interfaces:**
- Consumes: Existing QRIS module exports and static source contracts.
- Produces: `node tests/run-tests.mjs` as a dependency-free test command with non-zero failure status.

- [ ] **Step 1: Write failing QRIS tests**

Cover valid EMVCo parsing, static-to-dynamic conversion preserving merchant data while adding the requested amount, CRC recalculation, and malformed payload rejection. Assert exact behavior using the existing exported functions.

- [ ] **Step 2: Run the QRIS tests to verify the intended failure**

Run:

```powershell
node tests/qris.test.mjs
```

Expected: a meaningful failure if the test runner or required assertions are not yet wired.

- [ ] **Step 3: Write failing catalog and state contract tests**

Cover product availability filtering, price presence, admin control names, storage domains, and the existence of the checkout and realtime boundaries. Keep these tests source-level or pure-helper-level so the browser application does not need a DOM emulator.

- [ ] **Step 4: Implement only required test seams**

Use Node built-ins and existing exports. If a browser-coupled function cannot be tested directly, add the smallest pure export or source contract needed, without changing user-visible behavior or introducing a dependency.

- [ ] **Step 5: Run all tests**

Run:

```powershell
node tests/run-tests.mjs
```

Expected: all test files pass and failures use non-zero exit codes.

- [ ] **Step 6: Document verification**

Add the test command to `README.md` and `CONTRIBUTING.md`.

- [ ] **Step 7: Commit tests**

```powershell
git add tests README.md CONTRIBUTING.md scripts/app.js scripts/qris.js
git commit -m "test: add storefront and QRIS regression checks"
```

### Task 4: Add GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: `node tests/run-tests.mjs`, `node --check scripts\app.js`, `node --check scripts\qris.js`, and repository file checks.
- Produces: A pull request and push workflow that validates the static project without deployment.

- [ ] **Step 1: Write the workflow**

Use a pinned Node setup action version already supported by GitHub Actions, run on pushes and pull requests to `main`, and execute syntax checks, the test runner, `git diff --check`, and required-file checks. Do not add deployment jobs.

- [ ] **Step 2: Validate the workflow locally**

Run the exact shell commands represented by the workflow in PowerShell. Expected: each command exits zero.

- [ ] **Step 3: Link CI status in README**

Add the CI badge only if its URL reflects the actual repository and workflow path.

- [ ] **Step 4: Commit CI**

```powershell
git add .github/workflows/ci.yml README.md
git commit -m "ci: validate static storefront changes"
```

### Task 5: Full verification and delivery

**Files:**
- Modify: `CHANGELOG.md` if final verification notes need a user-facing entry

**Interfaces:**
- Consumes: All previous task outputs.
- Produces: A clean, pushed `main` branch with documented verification.

- [ ] **Step 1: Run syntax checks**

```powershell
node --check scripts\app.js
node --check scripts\qris.js
```

- [ ] **Step 2: Run regression tests**

```powershell
node tests/run-tests.mjs
```

- [ ] **Step 3: Run repository checks**

```powershell
git diff --check
git status --short
```

Expected: no diff errors and a clean worktree after commit.

- [ ] **Step 4: Run the static server smoke check**

Start `python -m http.server 5500`, request `/index.html`, and confirm an HTTP 200 response. Stop only the specific server process started for this check.

- [ ] **Step 5: Push and verify**

```powershell
git push origin main
git log -1 --oneline
git status --short
```

Expected: push succeeds, latest commit is present, and the worktree is clean.
