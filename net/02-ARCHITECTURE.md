# 02 — Proposed Architecture

Same format as `../docs/02-ARCHITECTURE.md`, because the format *is* the
lesson: **decision → alternatives → why → when it would be wrong.** These
are proposals — implementation may prove some wrong, and the plan
(04-IMPLEMENTATION-PLAN.md) has checkpoints for revisiting them.

## The shape at a glance

```
┌─────────────────────────────────────────────────────────┐
│  Sarap.Web  (one ASP.NET Core process, .NET 10 LTS)     │
│                                                          │
│  Blazor static SSR ──► HTML for home / recipe / list    │
│    └─ interactive islands (WASM): checklist, filters,   │
│       copy buttons — only where the UI must be live     │
│                                                          │
│  Services: RecipeQuery, ShoppingList, DataImport        │
│                        │                                 │
│  EF Core ──────────────┤                                 │
│                        ▼                                 │
│  SQLite (app.db) ◄── seeded/synced from scripts/*.json  │
│                                                          │
│  Anonymous identity: HttpOnly cookie ──► ShopperToken   │
└─────────────────────────────────────────────────────────┘
Deployment: one container (or one App Service). No client build pipeline.
```

Solution layout (three projects — resist the urge for more):

```
Sarap.sln
├── src/Sarap.Web/            # ASP.NET Core + Blazor components + endpoints
├── src/Sarap.Core/           # domain types, services, import/validation logic
└── tests/Sarap.Tests/        # unit + component + integration tests
```

Why not the fashionable 7-project "Clean Architecture" scaffold? Because at
this size, each extra project is a place for code to hide. `Core` exists
for exactly one reason: so domain logic compiles and tests **without** a
web server — the boundary that pays for itself immediately in test speed.
More boundaries can be earned later. (Junior tell: architecture cosplay —
copying the structure of systems 100× your size.)

## Decision 1: Blazor Web App with static SSR + islands

**What:** pages render to plain HTML on the server (static SSR — no
persistent connection, no client runtime by default). Components that need
liveness — the ingredient checklist, the filter bar (pending PRD OQ1), copy
buttons — opt into `InteractiveWebAssembly` rendering as *islands*.

**Alternatives considered:**

| Option | Why not |
|---|---|
| Blazor Server (SignalR) | Every user holds an open websocket; UI dies on flaky connections — and our priority user is **the shopper on store Wi-Fi**. Wrong failure mode for this product. |
| Full Blazor WASM (SPA again) | Recreates the React app's problems in C#: big initial download, client-only rendering, SEO gone (IMPROVE.md #3/#6 unfixed). Would make the rewrite pointless. |
| MVC / Razor Pages + a sprinkle of JS | Genuinely strong option — simpler mental model, teaches "classic web." Rejected only because component-model skills (and the React → Blazor concept mapping) are a primary learning goal. If the learner's goal were pure backend, this would win. |
| Minimal API + keep the React frontend | Least learning for most work: two build pipelines, a CORS boundary, and the frontend debts stay. |

**Why this one:** it's the only option that simultaneously (a) serves HTML
— fixing SEO/sharing by construction, (b) keeps the checklist UX as live as
the React version, (c) teaches a component model that maps 1:1 onto the
React knowledge from `docs/04-REACT.md`, and (d) stays one process, one
deploy.

**When it would be wrong:** if interactivity grew to dominate every page,
the islands model becomes ceremony and a full SPA (Blazor WASM or React)
with a JSON API becomes honest again. Watch for the smell: every new
feature starting with "make another island."

## Decision 2: SQLite + EF Core (a real database, deliberately small)

**What:** one SQLite file, accessed through EF Core; schema owned by EF
**migrations** (versioned, in git, reviewed like code).

**Alternatives:** keep compiling data into the app (parity with today);
Postgres/SQL Server; a document store (JSON columns / LiteDB).

**Why this one:**
- The PRD's durability contract (F13) and the IMPROVE.md #1 fix both hinge
  on **rows with stable primary keys** — identity is a database's whole
  job. The schema (03-DATA-MODEL.md) makes the index-key bug inexpressible.
- Migrations are the #9 fix: schema evolution becomes a reviewed,
  mechanical, *tested* operation instead of "bump the localStorage key and
  discard everyone's data."
- SQLite specifically: zero admin, free tier, a file you can copy for
  backup, and — underrated — the *same engine* runs in tests as in prod.
- Learning: EF Core (modeling, LINQ translation, change tracking,
  migrations) is arguably the single highest-value .NET skill after the
  language itself.

**When it would be wrong:** multiple app instances writing concurrently
(SQLite is single-writer — fine for one hobby instance, wrong for
horizontal scale), or if we'd stayed truly read-only forever (then
in-memory from JSON would beat a DB). The moment accounts + sync arrive,
plan the Postgres migration — which EF makes mostly a connection-string
and provider swap *because* we kept the SQL boring.

## Decision 3: Recipes stay authored in JSON; the database is a build artifact of it

**What:** `scripts/*.json` remain the **source of truth**, edited by PR
exactly as today (PRD F14). On startup (and in CI), a `DataImport` service
validates the JSON and *synchronizes* the recipe tables — insert new,
update changed, flag removed. User data (lists, checks) lives in separate
tables and survives sync untouched.

**Alternatives:** hand-edit the DB (loses review/versioning — the JSON-in-
git pipeline is one of the React app's *praised* decisions, keep it); an
admin CRUD UI (PRD non-goal); seed once and edit via migrations (migrations
are for schema, not content — mixing them is a classic mess).

**Why this one:** it keeps the reviewable data pipeline **and** closes
IMPROVE.md #4 (stale generated file) — there is no generated file to
forget; the running app *is* the generator. Import-on-startup + a CI step
that runs the same import against the PR's JSON means invalid data can't
merge and can't boot.

**The subtle part (teaching gold):** "update changed" requires knowing when
an *ingredient* is "the same one" across imports — the identity question
from IMPROVE.md #1, now unavoidable and solved properly in
03-DATA-MODEL.md. The bug that was a silent landmine in the React app
becomes an explicit, designed-for concern here. That's what "fixed by
construction" means.

**When it would be wrong:** non-engineer editors (then you need the admin
UI), or data too large to diff-sync at startup (~thousands of recipes —
move sync to a deploy step).

## Decision 4: Shopping list moves server-side, keyed by an anonymous cookie

**What:** first meaningful interaction sets an HttpOnly cookie holding an
opaque `ShopperToken` (a GUID). Lists and checks are rows referencing that
token. No login, no personal data — the cookie *is* the identity (PRD N8).

**Alternatives:**
- **localStorage again** (via JS interop or `ProtectedLocalStorage`):
  parity-cheap, but re-inherits every debt — no durability contract, no
  migrations, unpromotable to accounts, and each island needs storage
  plumbing.
- **Session state:** wrong lifetime; sessions expire, shopping lists must
  not (the shopper returns in three days).

**Why this one:** it's the smallest design satisfying F12/F13 *and* the
PRD's "promotable to accounts" constraint (§6) — claiming an anonymous list
later = pointing its token at a user row. It also centralizes state where
the renderer lives, which static SSR strongly prefers.

**Cost accepted, named out loud:** the list is now per-browser *via
cookie* instead of per-browser *via storage* — same UX, but clearing
cookies loses the list (same as clearing storage did), and the server now
holds (anonymous) user data, which means backups matter (N6). Also: any
device change still starts fresh until accounts exist. No free lunch, just
a better-shaped lunch.

**When it would be wrong:** if the product promise were "works fully
offline in the store." It isn't today (the React app also needs the network
for first load), but if it becomes that, this decision inverts — see the
PWA note in the stretch phase.

## Decision 5: Server is the state owner; islands are thin

**What:** interactive islands render current state and call endpoints (or
injected services) for every mutation — check an ingredient, add a recipe.
Optimistic UI is allowed *inside* an island (flip the checkbox instantly,
reconcile on response), but the server's answer is the truth. No
client-side store, no cache layer, no state duplication.

**Why:** the React app's hardest lessons were state-shaped (context
re-render coupling #7, derived-vs-stored state). The rewrite's simplest
posture: **there is one state, it's in the database, the UI is a view of
it** — `UI = f(state)` again, with `f` now running on the server. Resist
importing SPA state patterns (Fluxor, cascading app-state objects) until an
actual need shows up; at this app's interaction density, it won't.

**When it would be wrong:** high-frequency interactions where a round trip
per action feels laggy. The checklist's per-tap round trip is the risk;
Phase 3 has an explicit checkpoint to measure it on a phone and, if needed,
batch check-toggles (queue + flush) rather than abandon the model.

## Decision 6: Testing and CI are Phase-1 infrastructure, not Phase-6 polish

xUnit + bUnit + `WebApplicationFactory` integration tests against SQLite,
wired into GitHub Actions before the first feature merges. Full strategy in
06-TESTING-AND-QUALITY.md. Called out here only because it's an
*architecture* decision: `Sarap.Core`'s existence, the import-as-service
design, and DI throughout are all shaped by "must be testable without a
browser." The React app showed what deferring this costs (IMPROVE.md #2 —
"every refactor is scarier than it should be").

## Cross-cutting: what we deliberately do NOT add

Naming the exclusions is half the architecture:

- **No repository pattern over EF Core.** `DbContext` *is* a repository +
  unit of work. Wrapping it in `IRecipeRepository` at this size is
  abstraction theater; services take the context.
- **No AutoMapper / MediatR.** Map by hand (it's ten lines and greppable);
  call methods directly. Add indirection when a second consumer exists,
  not before.
- **No microservices, no message bus, no Redis.** One process, one file DB.
  The entire load fits in the margins of one small container.
- **No authentication framework** yet — the anonymous cookie is
  hand-rolled *on purpose* so the learner sees exactly what identity is
  before ASP.NET Identity abstracts it away (it's ~20 lines of middleware).

Each exclusion has a trigger condition for reversal; a senior keeps the
list, a junior either adds everything on day 1 or refuses everything
forever.

## Risks (see them coming)

| Risk | Mitigation |
|---|---|
| Blazor island interactivity is fiddlier than React expectations (render modes, serialization boundaries) | Phase 2 spike: build the checklist island *first*, before committing the whole UI plan |
| Per-tap server round trips feel slow in-store | Phase 3 checkpoint with a real phone; batching fallback designed up front (Decision 5) |
| SQLite file loss on ephemeral hosting | Deployment doc requires a persistent volume + nightly copy; tested restore in Phase 5 |
| Learner drowns in new concepts (DI + EF + Blazor + SQL at once) | The plan sequences them: Core+EF first with tests only (no UI), UI second — never more than one new layer per phase |
| Scope creep toward the stretch features | PRD non-goals are the contract; stretch lives in Phase 6 and only after parity |
