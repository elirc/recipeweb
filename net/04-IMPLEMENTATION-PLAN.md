# 04 — Implementation Plan

Six phases. Each ends with something **demonstrably working** and each
introduces at most one new layer of the stack — that pacing is the
anti-drowning mitigation from the architecture risk table, and it's how
real teams de-risk too: integration order is a design decision.

Rules that apply to every phase:

- Work on a branch per task; merge via PR even solo (the CI gate from
  Phase 1 must mean something).
- Every phase's **Definition of Done includes its tests passing in CI** —
  not locally, in CI.
- Keep a `net/LOG.md` as you go: date, what diverged from this plan, why.
  The log is a deliverable; comparing plan vs reality is the upskilling.
- Time boxes assume part-time learning pace (evenings/weekends). They are
  *calibration targets*, not deadlines: finishing way early or way late is
  information about estimation, write it in the log.

---

## Phase 0 — Environment & walking skeleton (~1 weekend)

**Goal:** an empty but *deployable* app: solution builds, one page serves,
CI runs, deploy works. Skeleton first, meat later — deployment problems
found in Phase 0 cost hours; found in Phase 5 they cost the schedule.

Tasks:

1. Install .NET 10 SDK; `dotnet --version` sanity check.
2. Create the solution per the architecture layout: `Sarap.Web` (Blazor Web
   App template, no sample pages kept), `Sarap.Core` (classlib),
   `Sarap.Tests` (xUnit). Wire references: Web→Core, Tests→both.
3. Add `.editorconfig` (dotnet conventions) + `dotnet format` check.
4. One real page: `/` renders "Sarap & Ngon" via static SSR. View source —
   confirm it's plain HTML, no framework payload. (First lesson: this is
   what N1/N3 mean.)
5. GitHub Actions: on PR → restore, build, `dotnet format --verify-no-changes`,
   `dotnet test`. On main → also publish a container image (or publish
   artifact).
6. Deploy the skeleton to the chosen free tier; visit the URL.

**DoD:** green CI on a trivial PR; the skeleton reachable at a public URL;
`dotnet test` runs (even with one placeholder test).

**You learn:** solution/project anatomy, the SDK CLI, how Blazor SSR
differs from the SPA you know, CI-as-habit.

---

## Phase 1 — Domain, database, import pipeline (no UI) (~1–2 weeks)

**Goal:** the entire data layer, built and tested headless. If Phase 1 is
solid, everything after is "just views."

Tasks:

1. Model the entities from 03-DATA-MODEL.md in `Sarap.Core`; configure with
   EF Core fluent API (unique indexes, cascades, owned enum conversions).
2. First migration; confirm the generated SQL reads sanely (open it — the
   migration file is a readable artifact, treat it like code review).
3. Copy the four `scripts/*.json` files into `net`-world as-is (they remain
   the shared source of truth; PRD F14).
4. Build `DataImportService`:
   - deserialize + validate (all today's generator rules **plus** absolute
     URL check; collect *all* errors, don't stop at the first — kinder for
     data PRs),
   - parse time strings → minutes (log unparseables),
   - diff-sync against DB using `ContentKey` matching (03-DATA-MODEL.md),
   - report: added/updated/retired counts, warnings.
5. Wire import to app startup (dev) and a `dotnet run -- import` command
   (CI/deploy).
6. **Tests (the heart of the phase):** unit-test validation rules and
   ContentKey normalization; integration-test the sync against real SQLite:
   *initial import → 74 recipes; re-import unchanged → zero changes
   (idempotent); reorder a recipe's ingredients → Ids stable; edit an item's
   text → old row gone, new row present; duplicate slug → import fails
   loudly.*
7. Add the CI step: run import against the PR's JSON (closes IMPROVE.md #4
   forever — invalid data cannot merge).

**DoD:** `dotnet run -- import` on a fresh checkout produces a SQLite file
holding all 74 recipes with correct groups/ordering; the idempotence and
identity tests pass in CI.

**You learn:** EF Core modeling + migrations + change tracking, LINQ,
System.Text.Json, DI registration/lifetimes (`DbContext` scoping!), writing
integration tests against a real database file.

**Checkpoint (from risk table):** does the ContentKey matching behave sanely
on the real data? Run import twice, diff the DB. If >0 rows churn on a
no-op re-import, stop and fix before proceeding — this exact class of churn
is the old bug's ghost.

---

## Phase 2 — The read-only site (~1–2 weeks)

**Goal:** browse, search, filter, recipe detail — fully server-rendered.
A visitor (or crawler) with JS disabled gets everything except checkboxes.

Tasks:

1. `RecipeQueryService` in Core: list w/ filters (cuisine, category, search
   text), single-by-slug. Filters translate to SQL via LINQ — inspect the
   generated queries (log them in dev; teaching moment on IQueryable vs
   IEnumerable, i.e. *where* the filtering runs).
2. Layout components: header (badge placeholder), footer, the design tokens
   ported from `src/index.css` (steal the CSS wholesale — visual parity is
   free familiarity, and CSS is explicitly not what this rewrite teaches).
3. Home page: cards grid, chips **rendered from the Cuisine/Category
   tables** (IMPROVE.md #5 fix visible in UI), search box. Filters/search
   as **URL query parameters** (`/?cuisine=thai&q=basil`) — server-rendered
   filtering, shareable URLs for free. *(This resolves PRD OQ1 for now:
   submit-based search, zero JS. Revisit as-you-type only if it feels bad
   on a phone — record the decision in the log.)*
4. Recipe page at `/recipe/{slug}`: everything from F5, grouped ingredient
   list (visually identical, checkboxes inert for now), 404 with friendly
   body for unknown slugs (F10 — assert the *status code* in a test).
5. F11 head matter: per-page `<title>`, description, OG tags; `sitemap.xml`
   endpoint enumerating recipe URLs; `robots.txt`.
6. Tests: bUnit render tests for card/list components; integration tests
   asserting `/recipe/authentic-pad-thai` returns 200 + contains the dish
   name, unknown slug returns 404, sitemap lists 74 URLs.
7. Lighthouse pass against the deployed phase; record N2/N3 numbers in log.

**DoD:** parity matrix rows F1–F5, F10, F11 green; share a deployed recipe
link in a chat app and watch it unfurl (the PRD's manual acceptance test).

**You learn:** Razor component syntax (the React mapping from 05- doc goes
from theory to fingers), routing/model binding, IQueryable, SEO mechanics
you've never had to do (because the old app couldn't).

---

## Phase 3 — Shopping list & interactivity (~2 weeks, the hardest phase)

**Goal:** the stateful half: anonymous identity, add/remove recipes,
checkable ingredients, the live badge.

Tasks:

1. Anonymous identity middleware: read `sarap_shopper` cookie → resolve
   `Shopper` row; on first *mutating* action, create + set cookie (HttpOnly,
   1-year rolling, essential-only per N8). Deliberately hand-rolled
   (~20 lines) per Architecture "exclusions" — read it, understand it,
   *then* you've earned ASP.NET Identity later.
2. `ShoppingListService` in Core: add/remove recipe, toggle check, clear
   checks, clear all — each a small transactional method with unit +
   integration tests (including the unique-constraint races: double-add is
   a no-op, not an exception bubbling to the user).
3. First interactive island: the ingredient checklist. Optimistic toggle,
   server reconcile (Architecture Decision 5). **Spike this before building
   the rest** — it's the riskiest UI piece (render modes, serialization);
   the architecture risk table says prove it early.
4. Remaining islands/forms: add-to-list button (works as a plain form POST
   without JS; enhances to island with it — progressive enhancement, N1),
   header badge (server-rendered count; updates via island state after
   actions), shopping list page with per-recipe sections, progress lines,
   remove/uncheck/clear (F8).
5. Copy-to-clipboard (F9): tiny JS interop for `navigator.clipboard` —
   port the *text format* from `ingredientsToText` exactly (write the unit
   test against the React app's known output first: behavior-preserving
   ports need golden tests).
6. Retired-recipe tombstone on lists (the OQ2 answer from 03-DATA-MODEL.md).
7. **The durability acceptance test (F6/F13), the whole point:**
   integration test that adds recipes + checks, *reorders ingredients in
   the JSON and re-imports*, then asserts every check still points at the
   same item text. This test failing on the old design is why we're here.

**DoD:** full parity matrix green except F11 (done) — i.e., everything;
the durability test passes; **phone checkpoint:** use the deployed app in
an actual store (or airplane-mode-then-flaky simulation): is per-tap
latency acceptable? Record verdict in log; if bad, implement the designed
batching fallback before calling the phase done.

**You learn:** middleware and the request pipeline, cookies and identity
from first principles, transactions and constraint-race handling, Blazor
render modes / islands, JS interop, progressive enhancement.

---

## Phase 4 — Polish & accessibility (~1 week)

**Goal:** the craft items the React app got review comments for
(IMPROVE.md #10) — done properly here.

Tasks: empty states everywhere (search, list — F4); `aria-pressed` on
chips and checklist rows, `aria-live` announcement for check/copy feedback,
keyboard walk of every flow; error page (the ErrorBoundary lesson —
ASP.NET's exception handler + a designed 500 page); WCAG AA contrast pass
on the ported palette; 404/410/500 all designed, all status-code-asserted
in tests.

**DoD:** keyboard-only complete-a-shop succeeds; Lighthouse a11y ≥ 95;
axe scan clean; N-row NFRs re-measured and logged.

**You learn:** accessibility as a checklist you *execute*, not a value you
profess. (Interview gold, genuinely rare skill.)

---

## Phase 5 — Production readiness (~1 week)

**Goal:** boring, inspectable operations.

Tasks: structured logging (built-in `ILogger`, request logs + import
reports); health endpoint; SQLite on a persistent volume + nightly copy
step + **a tested restore** (an untested backup is a rumor); container
image pinned + `dotnet publish` trimming; README-for-net: run, test,
deploy, restore runbook; load sanity check (a `hey`/`bombardier` run —
watch it hold, note the numbers).

**DoD:** kill-and-restore drill completed from the runbook alone; deploy
from clean clone using only the README; CI badge green.

**You learn:** the operational floor every backend engineer owns:
logs-health-backups-runbook. Small app, real habits.

---

## Phase 6 — Stretch (only after parity; pick, don't hoover)

Now the schema's dividends. Each of these was *impossible or dishonest* in
the old architecture, which is the retrospective lesson — list them next to
the IMPROVE.md item that blocked them:

- **"Under 30 minutes" filter + sort by total time** (unblocked by #8 fix —
  trivially, since `PrepMinutes` exists).
- **Merged shopping view** ("garlic — for 5 recipes") — the docs exercise
  3.2, now with SQL grouping to lean on.
- **Favorites** (one table, the Shopper token already exists).
- **Accounts + list claiming** — the §6 promotion path made real; *now*
  adopt ASP.NET Identity and feel what the hand-rolled version taught.
- **PWA/offline for the store aisle** — revisits Architecture Decision 4's
  named limitation honestly.

**Rule:** write a one-page mini-PRD (goal, non-goals, acceptance test)
before each. The muscle this plan practiced, now unassisted.

---

## Plan-level Definition of Done

The rewrite is "done" when: parity matrix green in CI · durability test
green · PRD success criteria §7 all checked · `net/LOG.md` retrospective
written (biggest divergence, worst estimate, one decision you'd reverse) ·
and you can give the 02-ARCHITECTURE.md decision walk-through from memory.

That last artifact — the retro — is the difference between *having done a
project* and *having learned from one*.
