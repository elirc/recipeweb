# 01 — Product Requirements Document: Sarap & Ngon on .NET

| | |
|---|---|
| Status | Proposed |
| Owner | you (the learner) |
| Baseline | React app at repo root, 74 recipes, 4 cuisines |
| Related | `../docs/IMPROVE.md` (debt register), `02-ARCHITECTURE.md` |

## Why this document exists (a note on PRDs)

A PRD answers *what* and *why* and stays silent on *how* — the how belongs
to the architecture doc. The discipline matters because requirements
written as implementations ("store the cart in a cookie") smuggle in
decisions nobody examined. Every requirement below is stated as observable
user-facing behavior, which is also what makes them **testable** — each
maps to acceptance tests in `06-TESTING-AND-QUALITY.md`.

Requirements use RFC-2119-ish language: **must** (launch blocker),
**should** (strongly wanted, cuttable under pressure), **may** (explicitly
optional).

## 1. Product summary

Sarap & Ngon is a cookbook companion: it makes *trying a new recipe less
daunting* by pairing every dish with its complete shopping list. It curates
recipes from the web's best cooking sites, always crediting and linking the
original author — we never republish instructions. Users browse, search,
and filter 74 Filipino, Vietnamese, Thai, and Spanish recipes, then build a
combined multi-recipe shopping list they use *in the store, on their
phone*.

The rewrite keeps the product identical in spirit and fixes what the
current architecture cannot: recipe pages that can be shared, previewed,
and found by search engines; and persistence that survives schema changes
without corrupting user data.

## 2. Goals and non-goals

### Goals

1. **Feature parity** with the React app (the parity matrix in §4 is the
   contract).
2. **Sharable, crawlable recipe pages** — every recipe has a real URL with
   correct title/description/social-preview metadata (fixes IMPROVE.md #6).
3. **Durable user data** — a user's shopping list and check-offs survive
   app updates, recipe data edits, and schema evolution (fixes #1, #9).
4. **A codebase that teaches** — idiomatic, current .NET; the repo doubles
   as a curriculum the same way `docs/` does for React.

### Non-goals (as important as the goals)

- **No user accounts / login** at launch. The anonymous experience is the
  product. (The design should not *preclude* accounts later — see §6.)
- **No recipe instructions.** Ingredient lists + source links only. This is
  an ethical/product stance, not a technical gap; it survives the rewrite.
- **No CMS / admin UI.** Recipes continue to be edited as JSON files by
  engineers via pull request. (Cheap, reviewable, versioned — see
  IMPROVE.md's praise of boring pipelines.)
- **No multi-device sync** at launch (requires accounts).
- **No recipe images.** Copyright complexity we don't need for v1.

## 3. Users and jobs

- **The browser** — "what should I cook this week?" Filters by cuisine or
  category, skims cards, opens a few recipes. Mostly desktop, evening.
- **The shopper** — same person, three days later, one-handed in a grocery
  aisle on a phone. Needs: their list to *be there*, big tap targets,
  check-offs that stick, works on flaky store Wi-Fi.
- **The sharer** — pastes a recipe link into a family group chat. Needs the
  link to unfurl with the dish name, not a generic homepage card. *(New —
  the current app cannot serve this user.)*

The shopper is the priority user when requirements conflict: the store
aisle is where the product proves its worth.

## 4. Functional requirements — parity matrix

| # | Requirement | Parity with React app | Notes |
|---|---|---|---|
| F1 | Browse all recipes as cards (name, native name, cuisine tag, difficulty, description, servings/prep/cook, ingredient count) | = | |
| F2 | Filter by cuisine (All + each cuisine), by category (All + 6), combinable | = | Chips derived from data, never hardcoded (IMPROVE.md #5) |
| F3 | Free-text search across name, native name, description, source, tags, ingredients; combines with filters | = | Case-insensitive substring, same as today; fuzzy matching **may** come later |
| F4 | Result count shown; designed empty state when zero matches | ≥ | Empty state is *required* here (it was an exercise gap in the React app) |
| F5 | Recipe detail: full grouped ingredient list, meta strip, tags, prominent source attribution + outbound link | = | |
| F6 | Check off ingredients on recipe page and shopping list; state persists | ≥ | **Must** survive recipe data edits without misattribution — the IMPROVE.md #1 acceptance test: reorder a recipe's ingredients in the data, redeploy, and a user's checks still point at the same items |
| F7 | Add/remove recipes to a combined shopping list; badge count in header everywhere | = | |
| F8 | Shopping list page: per-recipe sections, progress ("4/12 in the cart"), remove, uncheck-all, clear-all | = | |
| F9 | Copy ingredient list (single recipe, and entire combined list) as plain text | = | Same text format as `ingredientsToText` today |
| F10 | Unknown recipe URL shows a friendly not-found page with a path back | = | Must return HTTP 404 status, not a 200 — new, only possible with a server |
| F11 | Every recipe page has unique `<title>`, meta description, and Open Graph tags; recipe pages appear in the sitemap | **new** | The sharer's requirement; acceptance test = paste link in chat, see dish name |
| F12 | Shopping list persists across visits on the same browser without login | = | Mechanism changes (see architecture); behavior identical |
| F13 | A returning user's list **must** survive: app redeploys, recipe edits, and schema migrations. It **may** be lost only if they clear browser data | ≥ | This is the durability contract localStorage never had |
| F14 | Recipe data continues to be authored as per-cuisine JSON files; a validated import produces the runtime data | = | Same validation floor as today's generator (required fields, unique slugs, non-empty ingredients) *plus* URL validity (IMPROVE.md #10) |

## 5. Non-functional requirements

| # | Requirement | Budget / bar |
|---|---|---|
| N1 | Recipe and home pages render server-side; usable without JavaScript for reading and navigation (checklist interactivity may require JS) | Core content visible with JS disabled |
| N2 | Performance: home page **must** reach LCP < 2.0s on a mid-range phone over 4G; recipe page < 1.5s | Server-rendered HTML makes this achievable; measure with Lighthouse in CI (**should**) |
| N3 | Payload: initial HTML+CSS for a recipe page **should** be under 100KB before any optional interactivity loads | vs ~357KB JS today (IMPROVE.md #3) |
| N4 | Accessibility: keyboard operable end-to-end; filter and check states exposed to assistive tech (`aria-pressed`); WCAG AA contrast | Fixes the gaps listed in IMPROVE.md #10 |
| N5 | All 74 recipes preserved exactly (slugs, groups, quantities); slugs remain URL-stable forever | Slugs are public API now that URLs are real |
| N6 | Availability: single small instance, graceful restart; brief downtime acceptable (hobby-tier hosting) | We are *accepting* a real tradeoff vs static hosting — named explicitly |
| N7 | Cost: **must** run on free/hobby tier (single container or App Service free tier + SQLite file) | No managed DB spend at this scale |
| N8 | Privacy: no analytics, no third-party trackers; the anonymous identity cookie is essential-only (no consent banner needed), HttpOnly, ~1 year rolling expiry | |
| N9 | Tests and CI gate every merge (build, tests, data import validation) | The IMPROVE.md #2/#4 lesson, applied from day one |

## 6. Future-proofing constraints (design for, don't build)

These shape the data model without shipping features:

- **Accounts later:** the anonymous identity must be *promotable* — if
  accounts arrive, an anonymous list should be claimable by a new account
  rather than discarded. (Concretely: lists reference an owner token, not
  browser storage.)
- **Ratings/favorites later:** recipes need stable primary keys usable as
  foreign keys (another reason ingredient/recipe identity is schema-level).
- **More cuisines:** adding one = data change + one config entry, no code
  edits (the IMPROVE.md #5 bar).

## 7. Success criteria

Being a learning project, success is measured in demonstrable capability,
not DAUs:

1. Parity matrix fully green, verified by the acceptance test suite.
2. The F6/F13 durability tests pass — the class of bug in IMPROVE.md #1 is
   *provably* impossible, not just unobserved.
3. A pasted recipe link unfurls correctly in a chat app (F11, manual check).
4. Lighthouse: ≥90 performance and accessibility on home + recipe pages.
5. The learner can explain every architecture decision and its rejected
   alternatives without notes (the 02-ARCHITECTURE.md bar).

## 8. Open questions (left open on purpose)

Tracked here because a PRD that pretends to have no open questions is
lying. Each needs an answer before its phase starts:

- **OQ1:** Should search results update as-you-type (needs an interactive
  island or JS) or on submit (works with zero JS)? Affects N1's strictness.
  *Decide in Phase 2 — prototype both, pick by feel on a phone.*
- **OQ2:** When a recipe is *removed* from the data entirely, what happens
  to it on a user's shopping list? Silently vanish (today's behavior),
  or show a tombstone ("this recipe was removed")? *Decide in Phase 3;
  tombstone is kinder but more work.*
- **OQ3:** Is the combined shopping list ordered by recipe (today) or is a
  merged-by-ingredient view in scope? *Out of scope for parity; revisit
  as the stretch exercise it already is in `docs/05-EXERCISES.md` 3.2.*
- **OQ4 (the deliberately ambiguous one from 00-README):** F3 says search
  matches "ingredients" — the *item* text only, or also group names and
  quantities? Today's code searches item text only. Write the acceptance
  test first; you'll discover the PRD didn't specify it. That's the lesson:
  **tests are where requirement ambiguity goes to die.**
