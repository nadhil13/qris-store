# Transactional inventory implementation plan

**Goal:** Reserve stock for ten minutes before showing payment instructions, with Redis as the production authority.

**Architecture:** Dedicated inventory state separate from published catalog snapshots. One Redis Lua command validates and mutates inventory and orders; idempotent requests and server time prevent duplicate holds. Existing local demo behavior remains explicitly non-production.

**Tech stack:** JavaScript ES modules, Node HTTP/serverless APIs, Redis Lua, Node test runner.

## Decisions

- Reserve on checkout, not on payment confirmation; payment must not reduce stock twice.
- Release expired or cancelled holds exactly once; paid cancellations restock exactly once.
- Ten-minute window applies to QRIS and WhatsApp.
- No credential values in source, chat, or test output.
- Missing durable storage fails closed in production.
- Server-owned shipping/vouchers and canonical prices; browser totals are not accepted.
- Catalog metadata publication cannot replace inventory counters. Restocking is an explicit server operation.
- Protected transitions require backend authorization, not the legacy client login alone.

## Tasks

- [ ] Map checkout, payments, catalog publication and expiry call sites.
- [ ] Add failing API/inventory tests, including duplicate requests and concurrent buyers.
- [ ] Implement authoritative reservation endpoint and protected transitions.
- [ ] Integrate awaited reservation creation and server acknowledgements in buyer/admin flows.
- [ ] Verify Lua against real Redis if a runtime can be provisioned without elevation; otherwise record the blocker.
- [ ] Run regression tests and document deployment/migration requirements.

## Review focus

Retries after an ambiguous timeout must reuse the same idempotency key. Product quantities aggregate across variants. Cancellation and expiry must not release twice. Stale catalog writes must not reset inventory. Payment confirmation must reject expired orders. The public legacy order endpoint must not be able to overwrite authoritative reservations.
