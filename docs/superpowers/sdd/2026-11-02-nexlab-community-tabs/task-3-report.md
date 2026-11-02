# Task 3 Report — Verified promotion cards, localization, and final checks

## Implementation

- Community promotions load current catalog products and DIY projects through the existing product/project services. The page validates only `NEXLAB10` through `getCoupon("NEXLAB10", 1000)`; any validation failure omits its card. Product offers use the product detail route, kit offers use the project detail route, and coupon offers lead to the sale catalog.
- Sale prices, full-kit subtotals, kit discounts, and coupon terms are derived from current service data. Products with incomplete kit pricing remain visible without invented prices. Product artwork uses the existing `productArt` renderer.
- Added an offers section, card/empty-state styling, English translations for tabs, offer/question labels and curated idea content, and tests for coupon filtering, bundle price derivation, coupon validation wiring, and localization.
- Existing build, question, project pagination, and submit flows remain on their existing service paths.

## Verification

- `npm test`: passed, 117 frontend tests and 13 Cloud Functions tests.
- `git diff --check`: passed.
- Browser: local Community page loaded. Mouse activation selected Builds; keyboard ArrowRight selected Questions. Three tabs were present. Two verified offers rendered; the product image loaded. No console errors or warnings were reported.
- Browser at desktop width: no horizontal overflow. At 390px mobile width: no horizontal overflow; offer links resolved to `product.html?id=arduino-uno` and `catalog.html?tag=sale`; offer image loaded.
- Sale catalog (`catalog.html?tag=sale`): one product rendered with current price 490 ₴ and prior price 560 ₴; image loaded; no overflow and no console errors/warnings.

## Notes

- In the local demo state, the offers shown were the current product discount and validated coupon; no configured kit discount was returned. Kit price/terms are covered with catalog-backed fixtures.

## Round 1 review fixes

- Split complete-kit and coupon minimum-subtotal terms into independent text nodes and added exact English translations. Localization regression assertions cover `повний комплект деталей` → `complete kit of parts` and `мінімальна сума` → `minimum subtotal`.
- Moved optional offer retrieval/rendering into non-awaited `loadOffers()`. Community tab listeners and form/project handlers can initialize while catalog and coupon requests remain pending.
- Focused command: `node --test tests/i18n.test.js tests/site-links.test.js` — passed, 36 tests, 0 failures.
- Full command: `npm test` — passed, 118 frontend tests and 13 Cloud Functions tests, 0 failures.
