# NEXLAB Community Tabs and Offers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the college demo Community page with separate Ideas, Builds, and Questions tabs plus verified, separate offer cards.

**Architecture:** Add a small data module for curated ideas and pure question/offer shaping. Reuse the existing community pagination/service, product/project services, coupon validation, and CSS/i18n patterns; do not add storage or change the backend schema.

**Tech Stack:** Static HTML, CSS, browser ES modules, Node.js built-in test runner, existing Firebase/local API services.

**Spec:** `docs/superpowers/specs/2026-11-02-nexlab-community-tabs-design.md`

## Global Constraints

- No likes, follows, private messages, notifications, or generic standalone user posts.
- No new payment flow, payment provider, or real-order claim.
- No fake price reductions or claims that an offer is available when the current catalog or coupon data does not confirm it.
- No new community database schema: ideas are editorial content; builds and questions reuse the existing service.
- The Ideas content is curated and read-only in this iteration. Students can publish actual builds through the existing form.
- The existing project service returns at most 30 newest questions per project; show a recent discussion list, not a complete archive.
- Do not enumerate arbitrary coupons; only check known public demo coupon `NEXLAB10`.

## Review Focus

1. An empty project/question list should keep its contextual empty state rather than show a blank panel. Test each tab's empty rendering.
2. Projects with missing, blank, or invalid question dates should not break sorting or produce an invalid `<time>` value. Test sorting and date fallback in the question helper.
3. Duplicate question IDs from different projects must remain distinct. Test flattening uses the project ID as part of its stable key.
4. Missing, inactive, or below-minimum `NEXLAB10` must not produce a coupon card. Test the renderer receives no coupon after validation fails.
5. Products/projects without confirmed discounts must not appear in offers; discounted price and original price must remain correctly paired. Test offer selection and price fields.

---

### Task 1: Curated ideas and feed shaping

**Files:**
- Create: `frontend/js/community-feed.js`
- Test: `tests/community-feed.test.js`

**Interfaces:**
- Produce `communityIdeas: Array<{ id, title, summary, components: string[], difficulty, href }>` with links to existing project pages or catalog categories.
- Produce `collectCommunityQuestions(projects): Array<{ id, projectId, projectTitle, userName, text, date, answer, answeredBy, answeredAt }>` sorted newest-first; stable keys include both project and question IDs.
- Produce `buildCommunityOffers({ products, projects, coupon }): Array<{ id, kind: "product" | "kit" | "coupon", title, href, percent?, price?, oldPrice?, minTotal?, productId?, projectId?, code? }>` using current prices/old prices, configured bundle discounts, and only a validated coupon passed by the caller.

- [ ] **Step 1: Write failing tests for `collectCommunityQuestions`**
  - Assert nested project questions flatten with parent IDs/titles and sort newest-first.
  - Assert same question IDs in different projects remain distinct.
  - Assert invalid/missing dates sort last without throwing.
- [ ] **Step 2: Run the focused test and confirm it fails because the module is absent**
  - Run: `node --test tests/community-feed.test.js`
  - Expected: FAIL with missing module/export.
- [ ] **Step 3: Implement `collectCommunityQuestions` and curated `communityIdeas`**
  - Keep the initial idea list small and use verified project/catalog links.
- [ ] **Step 4: Add failing and passing tests for `buildCommunityOffers`**
  - Assert only real product markdowns, configured bundle deals, and the validated coupon parameter are returned.
  - Assert missing coupon and no-discount catalog produce no coupon/discount cards.
- [ ] **Step 5: Implement `buildCommunityOffers` and rerun the focused test**
  - Run: `node --test tests/community-feed.test.js`
  - Expected: PASS.

### Task 2: Community tabs and question view

**Files:**
- Modify: `frontend/community.html`
- Modify: `frontend/js/community-projects.js`
- Modify: `frontend/css/fixes.css`
- Test: `tests/site-links.test.js`
- Test: `tests/community-feed.test.js`

**Interfaces:**
- Consume `communityIdeas` and `collectCommunityQuestions` from Task 1.
- Preserve `getCommunityProjects({ append })`, the current project submission form, image processing, and detail-page question/comment handlers.
- The tab bar has three tabs (`ideas`, `builds`, `questions`) with one active panel, `aria-selected`, tab/panel relationships, arrow-key navigation, and visible focus.

- [ ] **Step 1: Add failing structural tests for three accessible tabs and their target panels**
  - Assert exactly three tab controls and each tab references an existing panel.
  - Assert `community.html` continues to link valid scripts, stylesheet, and local assets.
- [ ] **Step 2: Run the focused test and confirm the current page lacks tabs**
  - Run: `node --test tests/site-links.test.js tests/community-feed.test.js`
  - Expected: FAIL on the new tab-structure assertions.
- [ ] **Step 3: Add the three tab panels in `community.html`**
  - Put the existing submit form and project grid in the Builds panel.
  - Add dedicated Ideas and Questions roots; keep page header and footer.
- [ ] **Step 4: Implement tab interaction and render the panels in `community-projects.js`**
  - Activate panels with native buttons, synchronize ARIA state, support left/right arrows, and preserve focus.
  - Load current community projects once, render Builds with the existing load-more behavior, and render Questions from their latest returned question records.
  - Link each question card to its parent project detail page and label answered/unanswered state.
- [ ] **Step 5: Add idea/question cards, empty states, and mobile/desktop styles**
  - Keep styles within existing community sections in `frontend/css/fixes.css`.
  - Use existing button, card, muted, accent, and focus tokens; avoid horizontal overflow on small screens.
- [ ] **Step 6: Run focused structure/data tests**
  - Run: `node --test tests/site-links.test.js tests/community-feed.test.js`
  - Expected: PASS; all three panels exist and question links resolve to the correct parent.

### Task 3: Verified promotion cards, localization, and final checks

**Files:**
- Modify: `frontend/js/community-projects.js`
- Modify: `frontend/js/i18n.js`
- Modify: `frontend/css/fixes.css`
- Test: `tests/community-feed.test.js`
- Test: `tests/i18n.test.js`
- Test: `tests/site-links.test.js`

- [ ] **Step 1: Add failing tests for translated tab, idea, question, and offer labels**
  - Assert new Ukrainian UI copy resolves to English through the project's current translation map.
- [ ] **Step 2: Add failing offer tests for coupon eligibility and bundle terms**
  - Assert `NEXLAB10` is requested through existing validation with its demo minimum, and missing/inactive/invalid coupons are omitted.
  - Assert bundle cards show the full-kit condition and link to an existing project detail page.
- [ ] **Step 3: Implement the offers section using current services**
  - Load products/projects through existing services; use `getCoupon("NEXLAB10", 1000)` as the active-code check and omit the card on validation failure.
  - Derive price and bundle terms from returned data; do not hardcode markdown or kit discount amounts in HTML.
  - Link product offers to `product.html?id=...`, bundle offers to `project.html?id=...`, and coupon offers to the catalog/checkout path.
- [ ] **Step 4: Add Ukrainian and English translations and focused test assertions**
  - Keep labels and empty/error states localizable through `frontend/js/i18n.js`.
- [ ] **Step 5: Run the full test suite**
  - Run: `npm test`
  - Expected: all frontend/server and Cloud Functions tests pass.
- [ ] **Step 6: Run a browser pass at desktop and mobile widths**
  - Open `community.html`, switch each tab by mouse and keyboard, verify question links, offer links, images, no horizontal overflow, and no console errors.
  - Open `catalog.html?tag=sale` and confirm promotion prices match their product cards.

## Self-Review

- **Spec coverage:** Tabs and accessible states are covered in Task 2; ideas and existing project flow in Tasks 1–2; recent question aggregation and links in Tasks 1–2; current discounts/coupon/kit offers in Tasks 1 and 3; mobile, localization, and console checks in Tasks 2–3.
- **Scope:** No backend/API/schema changes, no new dependencies, no real payment behavior.
- **Known limits:** Questions older than the existing per-project 30-record response remain outside this view; arbitrary coupon discovery remains intentionally unsupported.
- **Implementation method:** Native implementation is recommended because the three tasks share one Community-page renderer and rely on the same small set of service interfaces; one agent can keep the tab state and offer rendering coherent.
