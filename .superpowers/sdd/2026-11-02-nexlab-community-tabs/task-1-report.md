# Task 1 report — Curated ideas and feed shaping

Status: Complete.

Implemented `frontend/js/community-feed.js` with three curated ideas linked to existing project pages, newest-first cross-project question aggregation with composite project/question IDs, and pure product, kit, and known-coupon offer shaping. Kit prices are derived from current product prices and configured component quantities; only products with a valid current/old price reduction are emitted. Coupon cards require the caller-supplied coupon to be the known `NEXLAB10` code and satisfy basic validated shape checks.

Tests added in `tests/community-feed.test.js` cover question flattening/context/order, duplicate IDs across projects, invalid/missing dates, idea links, and offer inclusion/omission/pricing. Red evidence was captured before implementation: Node reported `ERR_MODULE_NOT_FOUND` for `community-feed.js`. Focused tests pass (5/5). Full `npm test` passes (111 root tests and 13 functions tests).

Concerns: Kit price fields are omitted when the current catalog cannot price the kit; the configured offer card remains linked to the project. No runtime coupon lookup is performed here; the caller must pass a validated coupon as specified.
