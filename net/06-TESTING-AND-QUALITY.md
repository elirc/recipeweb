# 06 — Testing & Quality Strategy

The React app shipped with zero tests, and `docs/IMPROVE.md` #2 names the
real cost: not bugs, but *fear* — every refactor scarier than it should be.
This plan inverts that: test infrastructure lands in Phase 0–1, before
features, and CI enforces it before anything merges. This doc is the
strategy; the plan's phases reference it.

## The stack

| Layer | Tool | Plays the role of |
|---|---|---|
| Unit tests | **xUnit** (+ FluentAssertions if the default asserts chafe) | what Vitest would have been |
| Component tests | **bUnit** — render Razor components, assert markup, click things | React Testing Library |
| Integration tests | **`WebApplicationFactory<Program>`** — boots the real app in-memory, real DI, real routing, real SQLite | Playwright-ish coverage at test speed |
| Database in tests | **real SQLite** (temp file or in-memory connection) | — |
| CI | GitHub Actions, from Phase 0 | the gate the React app never had |

Notably absent, on purpose:

- **No mocking framework (Moq etc.) to start.** DI + real SQLite + small
  fakes (`TimeProvider`) cover this app. Mock-heavy suites test the mocks;
  earn a mocking library only when a dependency is genuinely unownable
  (a third-party HTTP API — we have none).
- **No EF InMemory provider.** It's a false database: no relational
  integrity, no SQL translation — precisely the layers our tests exist to
  exercise. Real SQLite is exactly as easy and infinitely more honest.
  ⚠️ Known false-comfort trap; write it on the wall.
- **No browser-automation suite (Playwright/Selenium) initially.** With
  server-rendered HTML, `WebApplicationFactory` + parsing the response
  covers most "does the page work" questions without browser flakiness.
  Trigger to add Playwright: the first bug that only reproduces with real
  JS in a real browser (likely a Phase 3 island). Add *one* smoke test
  then; keep it thin.

## The pyramid, sized for this app

```
      ~5   end-to-end user journeys (integration, via WebApplicationFactory)
    ~25    endpoint/page integration tests (status codes, key content, headers)
   ~60+    unit + component tests (services, import logic, Razor components)
```

Rough proportions, not quotas. The signal to watch: **when a test fails,
does it point at the culprit?** A good pyramid means unit tests name the
broken function while the journey test merely confirms the user would have
noticed. All-journeys suites (inverted pyramids) fail as a blob.

## What gets tested, mapped to the PRD

### The contract tests (each F-requirement gets at least one)

The parity matrix (PRD §4) is the test plan's table of contents. Selected
highlights with their shapes:

**F6/F13 — the durability contract (the crown jewel):**

```
GIVEN a shopper with pad-thai on their list and "fish sauce" checked
WHEN  scripts/thai.json is edited to reorder pad-thai's ingredients
AND   DataImportService re-syncs
THEN  the shopper's check still attaches to "fish sauce"
AND   no check attaches to any other ingredient
```

This test is the *reason for the rewrite* expressed as executable truth —
it fails by design on the React architecture. Write it early in Phase 3,
watch it fail against a naive implementation, make it pass. Also its evil
twin: *edit an ingredient's text* → the check is **dropped** (not
migrated) — pinning the honest-loss behavior from 03-DATA-MODEL.md so
nobody "fixes" it into the old bug later.

**F10/F11 — the server-only wins:** unknown slug → HTTP **404** (assert
the status, not just the sad page — crawlers read statuses, IMPROVE.md #6);
`/recipe/authentic-pad-thai` → 200, contains `<title>` with the dish name
and OG tags; sitemap lists exactly the 74 non-retired slugs.

**F14 — import validation (pure-function paradise, Phase 1):** table-driven
xUnit `[Theory]` cases: missing field → named error; duplicate slug →
error naming both files; bad URL → error; unparseable prep time → warning
+ null, import continues; idempotence (re-import → zero changes); the
ContentKey suite (reorder → stable Ids; text edit → new Id; duplicate
lines → disambiguated).

**F9 — the golden-master port test:** `IngredientsToText` output compared
against captured output of the React `ingredientsToText` for the same
recipes. Behavior-preserving ports get golden tests *before* the port —
the only way to know "same" means same.

### Component tests (bUnit, Phases 2–3)

Chips render from Cuisine rows (add a fake fifth cuisine in test data →
five chips — the IMPROVE.md #5 regression test); checklist renders groups
in order with correct `aria-pressed`; empty states appear at zero results;
badge shows count. Component tests assert **behavior and accessibility
semantics, not markup trivia** — a test that breaks when a `div` becomes a
`section` is a maintenance tax, not a safety net (same "test what the user
sees" philosophy as RTL).

### The journeys (~5, Phase 3–4)

1. Browse → filter Thai → open Khao Soi → add to list → badge = 1.
2. Check three ingredients → "reload" (new request, same cookie) → still
   checked, progress line says 3/N.
3. Remove recipe → its checks gone; other recipes' checks untouched.
4. Copy combined list → text matches golden format.
5. No-JS journey: with scripts stripped, browse/search/open/add still work
   via forms (N1's proof).

## Test data strategy

- A tiny **builder** (`RecipeBuilder.WithIngredients(…)`) for unit tests —
  three obvious recipes beat seventy-four realistic ones for readability.
- The **real JSON files** for import/integration tests — they're the actual
  production data; tests against them catch data quirks (the `&amp;`
  lesson) that synthetic data never would.
- Each integration test gets a **fresh SQLite** file/connection — isolation
  beats speed at this scale, and SQLite creation is milliseconds anyway.

## CI: the quality gate (Phase 0, hardened by Phase 1)

Every PR, in order, fail-fast:

```
1. dotnet format --verify-no-changes      # style is not a review topic
2. dotnet build -warnaserror              # nullable warnings are errors (§8 of 05-)
3. dotnet test                            # the pyramid
4. dotnet run --project src/Sarap.Web -- import --validate-only scripts/
                                          # bad data cannot merge (IMPROVE.md #4's fix)
5. (main only) publish artifact/container
```

Target: under ~3 minutes. A slow gate gets bypassed culturally long before
it gets bypassed technically; speed is a feature of the gate itself.

Two ratchets once green (**should**, per PRD): coverage *reported* on PRs —
watched, not worshipped; a Lighthouse CI run against a preview deploy
asserting N2/N4 budgets, so perf/a11y regressions arrive as red X's
instead of user complaints.

## Quality beyond tests

- **Warnings are errors** from day 0 — including nullability. Every
  suppressed warning is a small loan; the file of suppressions *is* the
  debt register.
- **`dotnet format`/analyzers** own style so humans never discuss commas
  in review — review attention is the scarcest resource; spend it on
  design.
- **Every bug found after CI passes** gets: a failing test reproducing it
  *first*, then the fix, then a one-line note in `net/LOG.md` answering
  "why did the system let this happen?" — the `docs/06-GROWTH.md` §2 loop,
  now with a place to put the answer. Bugs are tuition; the log is the
  receipt.

## The learning arc (why this doc is upskilling, not process)

The React curriculum taught you to *notice* missing safety (IMPROVE.md #2,
review question 4-in-`docs/06-GROWTH.md`). This project makes you *build*
the safety, in the order professionals do: harness before features →
contract tests from requirements → golden tests for ports → regression
tests from bugs. When you can look at PRD OQ4 ("does search match group
names?"), write the test, watch it force the requirement decision, and
check the answer back into the PRD — the loop is closed. That skill —
**requirements ⇄ tests as one conversation** — is the most senior thing in
this entire folder.
