# NEXLAB community tabs and offers

## Intent

Make the Community area easier to browse for college students by separating short project ideas, member builds, and project questions into clear tabs. Give existing discounts a visible home as separate, clearly labeled offer cards. Keep the site a learning demo: no real payments, invented prices, or production social network features.

## Goals

- Add three accessible tabs: **Ідеї**, **Збірки**, and **Питання**.
- Fill Ideas with concise, curated electronics prompts that link to relevant NEXLAB products or existing DIY guides.
- Keep member builds backed by the existing community-project service, including its pagination, upload flow, comments, and project detail pages.
- Show project questions as a cross-project list, with the linked project, asker, date, answer state, and a link to continue the discussion on that project.
- Add a distinct **Акційні пропозиції** section with cards generated only from current product discounts, configured kit discounts, and the known demo coupon `NEXLAB10` after checking that it is active. Each card links to the relevant product, kit, or sale catalog.
- Keep all controls usable by keyboard and on narrow screens; preserve current color theme and shared button/card styles.
- Keep copy in the project's Ukrainian/English translation system.

## Non-goals

- No likes, follows, private messages, notifications, or generic standalone user posts.
- No new payment flow, payment provider, or real-order claim.
- No fake price reductions or claims that an offer is available when the current catalog or coupon data does not confirm it. Do not list or expose arbitrary admin coupon codes.
- No new community database schema: ideas are editorial content; builds and questions reuse the existing service.

## Approaches considered

1. **One chronological stream:** mix ideas, builds, questions, and promotions. Rejected because the user chose separate sections and different item types need different actions.
2. **Three tabs with separate offer cards — selected:** put ideas, builds, and questions into three tabs and keep offers visually distinct below them. This fits the requested organization while reusing the existing project and offer data.
3. **A full social network:** add generic posts, likes, follows, and profile feeds. Rejected as unnecessary for the college demo and would require new storage, permissions, and moderation rules.

## Proposed experience

The existing Community page keeps its title and introductory copy, then presents a tab bar with three controls and one visible panel at a time. Tabs use native buttons with `role="tablist"`, `role="tab"`, `aria-selected`, linked tab panels, keyboard arrow navigation, and visible focus. The selected tab can be represented in the URL fragment so refresh and direct linking preserve context.

### Ідеї

Show a small curated set of compact cards. Each card includes a practical problem, a one-sentence build idea, suggested components, difficulty, and an action to open an existing guide or a filtered catalog. Start with ideas grounded in the current NEXLAB catalog, such as a plant-moisture indicator, a motion-triggered light, and a room climate display. Keep the collection in the frontend source so no new account or backend setup is required.

### Збірки

Move the existing community project grid and submit form into this tab without changing its data flow. Preserve project pagination, image requirements, ratings, comments, questions, and links to code/schematics. The tab should keep its current empty, loading, and error states.

### Питання

Flatten the existing questions attached to community projects into a newest-first list. Each card identifies the parent project and links to its detail page, where the existing question/answer flow stays in place. Questions without an answer are marked as awaiting the project author's reply. Reuse the existing project pagination; the current service returns at most 30 newest questions per project, so the tab promises a recent discussion list rather than a complete archive. If there are no questions, show a prompt to open a project and ask about its wiring or code.

### Акційні пропозиції

Place this as a separate section after the tab panel, not as a fourth community tab. Show only offers supported by current data: product discounts with old/current prices, configured complete-kit discounts, and the specifically known demo coupon `NEXLAB10` after reading its public document on Firebase or validating it through the local API. Coupon cards show their minimum subtotal and percent and link to the catalog/checkout. Do not enumerate coupons: Firestore permits public reads for a known code but restricts listing coupon documents, and the local API validates a supplied code rather than returning a public list. Hide unavailable offers; if there are none, show a calm empty state linking to the catalog. Existing promotion validation and checkout remain the source of truth.

## Constraints and implementation calls

- Reuse `frontend/js/community-projects.js`, `frontend/api/communityProjectService.js`, the current `frontend/css/fixes.css` community styles, and the product/promotion services.
- Keep the existing backend and Firebase interfaces unchanged; do not create or migrate Firestore collections.
- The Ideas content is curated and read-only in this iteration. Students can publish actual builds through the existing form.
- Respect the project's existing sanitization helpers and do not interpolate unsanitized user content into HTML.
- For the questions tab, fetch project pages using the existing page size and load-more behavior; do not issue a separate request per question. Be clear that the existing API caps each project's returned question list at 30.
- Offers must be derived from current catalog/project/coupon data rather than duplicated discount amounts in markup. Coupon support is deliberately limited to the known public demo code `NEXLAB10`; adding public coupon discovery later would require a deliberate API/rules change.

## Acceptance checks

- The three tabs show only their selected panel; switching tabs does not reset the build pagination unexpectedly.
- Tab controls have correct ARIA state, keyboard navigation, and focus visibility.
- Ideas link to valid existing guides or catalog filters.
- Builds still submit and paginate; a published question appears in the Questions tab after refresh and links to its project. Only the most recent questions returned by the existing service are presented.
- Offer cards show the same current/old prices and discount conditions used by checkout; an inactive or missing `NEXLAB10` coupon is omitted.
- Empty states are meaningful in all three tabs and the offers section.
- The layout works at desktop and mobile widths without horizontal overflow.
- Existing Node tests pass; add focused tests for tab semantics, question aggregation/order, idea links, and offer filtering. Check the browser console on Community and sale/catalog pages.

## Open for approval

This document records the user's choice of three separate tabs. The remaining defaults are implementation choices: the offers section sits below the tabs, Ideas are curated static content, Questions are recent existing project discussions, and only the known public demo coupon is eligible for a coupon card.
