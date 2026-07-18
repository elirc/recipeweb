# IMPROVE — How This Project Could Have Been Built Better

An honest review of our own codebase. Read this *after* the other docs —
each critique assumes you understand the current design and why it was
chosen (02-ARCHITECTURE.md).

Two framing notes before the list:

- **Most of these are not mistakes; they're debts.** A debt is a shortcut
  that was reasonable when taken and becomes expensive under specific
  conditions. For each item we name the trigger condition. A codebase with
  zero debt was over-engineered; a team that can't *name* its debts is in
  trouble. The goal is the named list you're reading.
- Severity scale: 🔴 real bug or user-facing risk today · 🟡 will hurt at
  moderate growth · 🟢 polish / craft.

---

## 1. 🔴 Checked-ingredient state is keyed by array index

**The design:** a checked ingredient is stored in localStorage as
`` `${slug}:${index}` → true `` (`ShoppingListContext.tsx`,
`IngredientChecklist.tsx`).

**The flaw:** `index` is the ingredient's *position*. Positions are not
identities. If a data update inserts, removes, or reorders ingredients in a
recipe — a completely normal maintenance edit to the JSON — every saved
check after the edit point attaches to the **wrong ingredient**, for every
user who had that recipe in their list. No crash, no warning: a user at the
grocery store sees "fish sauce ✓" when they actually checked off garlic.

Silently-wrong beats loudly-broken only in horror stories. This is the most
instructive flaw in the codebase because the type system is happy, the
tests (if we had them — see #2) would likely pass, and the bug only
manifests as a *cross-version interaction* between old stored data and new
code.

**How it should have been built:** give checked state a durable identity —
either explicit `id`s on ingredients in the source JSON, or a content hash
(e.g. first 8 chars of a hash of `group|quantity|item`). Hashes need no
data-file changes and self-heal: if the item's text changes, the check
drops off (annoying but *honest*) instead of migrating to a neighbor
(wrong). Plus a `v1 → v2` storage migration for existing users.

**Trigger condition:** already live — the first ingredient-list edit to any
recipe someone has saved. Exercise 3.1 in 05-EXERCISES.md is fixing this.

## 2. 🔴 No tests, and no test infrastructure

Zero test files, no test runner installed, no `npm test` script. The
project relies on two safety nets — the TypeScript compiler and the
generator's validation — which are genuinely good but only cover *shape*,
not *behavior*. Nothing verifies that search matches tags, that
`ingredientsToText` formats groups correctly, that removing a recipe clears
its checks, that `loadState` survives garbage.

The absence is felt most exactly where the logic is trickiest: the grouping
algorithm in `IngredientChecklist`, the localStorage defensive reads, the
filter combination logic. These are pure functions — the *cheapest possible
things to test* — and they're untested.

**How it should have been built:** Vitest from day one (it's Vite-native,
near-zero config), with the rule "logic in pure functions gets a unit
test." Not for coverage numbers — for the ability to refactor without fear.
Note how many IMPROVE items below say "refactor X": every one is scarier
than it should be because there's no harness. That compounding fear is the
real cost of missing tests, and it starts accruing at file #1, which is why
"we're too small to test" is usually backwards.

## 3. 🟡 All data ships in one eager bundle

The production JS is ~357KB (~102KB gzipped): React, all pages, and all 74
recipes with full ingredient lists, loaded before anything renders. Today
that's acceptable. But the architecture has no *seams* — nothing is lazy,
so growth in any direction (more recipes, images, more pages) degrades
first paint for every visitor linearly.

**How it should have been built:** two cheap seams, both nearly free at
project start:

- `React.lazy` + route-level code splitting, so `/shopping-list` code isn't
  paid for by someone browsing recipes.
- Recipe *summaries* (name, slug, cuisine, tags — what the grid needs)
  separate from full ingredient lists, with details loaded per-recipe via
  dynamic import. The generator already exists; emitting two files instead
  of one would have cost ten minutes at the start and costs a real refactor
  now.

**Trigger condition:** ~150+ recipes, or the day someone adds photos.

## 4. 🟡 The generated file can silently go stale

`src/data/recipes.ts` is committed to git, and nothing regenerates or
verifies it automatically. Edit `thai.json`, forget to run the generator,
and you ship the old data — the JSON and the site silently disagree. The
deploy workflow builds whatever is committed; it neither runs the generator
nor checks sync. There's also no CI on pull requests at all — lint and
build only run at deploy time, after merge.

**How it should have been built:** pick one of two coherent designs:
(a) *don't commit generated output* — run the generator as a `prebuild`/
`predev` script so it can't be stale; or (b) commit it *and* enforce sync
in CI (`node scripts/generate-recipes.mjs && git diff --exit-code
src/data/recipes.ts`). The current design — committed but unenforced — is
the one combination that permits silent drift. Exercise 3.4 closes this.

## 5. 🟡 "Add a cuisine" still touches too many places, some silently

Adding Thai/Spanish required edits in: `types.ts` (union + labels), the
JSON, `index.css` (two variables + two rule blocks), `index.html` (title,
description), `App.tsx` (subtitle), `HomePage.tsx` (hero text). The compiler
guides the first two; **everything else fails silently** — a forgotten CSS
rule renders an unstyled tag, a forgotten subtitle just lies.

The chip row is now derived from `CUISINE_LABELS` (good — that was one of
the hardcodings, fixed during the Thai/Spanish work). But the header
subtitle and hero paragraph still hardcode the cuisine list as prose, and
per-cuisine colors live in CSS with no link to the type system.

**How it should have been built:** one `CUISINES` config object as the
single source of truth — label, color, soft color per cuisine — with CSS
variables set from it (inline style on `:root` or generated CSS), and UI
strings derived (`Object.values(CUISINE_LABELS).join(' · ')`). Then adding
cuisine #5 is: extend the config, add the JSON. Two places, both loud if
missed.

## 6. 🟡 Hash routing makes every recipe invisible to the web

`/#/recipe/pad-thai` — crawlers and link unfurlers see only `/`. For a
*cookbook*, whose natural growth channel is people sharing recipe links
that preview nicely and rank in search, this quietly amputates the
product's discoverability. The tradeoff bought real simplicity (works on
any static host, zero config — see 02-ARCHITECTURE.md decision 3), but it
was likely decided as a technical default rather than a product decision.

**How it should have been built:** for a fully static, small, enumerable
route space — we know all 74 slugs at build time! — **pre-rendering** is
the sweet spot: generate a real `recipe/pad-thai/index.html` per recipe at
build (vite-ssg or a custom postbuild script), each with proper
`<title>`/OG meta. Keeps static hosting, gains real URLs and previews.
The current design is the right call only if sharing/SEO genuinely doesn't
matter — that should have been an explicit product conversation, and
"decisions that silently foreclose product options" is a senior-level thing
to watch for.

## 7. 🟡 One context value = everything re-renders on any change

`ShoppingListContext` exposes a single `value` object rebuilt on every
state change, so checking off one ingredient re-renders every consumer —
header badge, all visible recipe cards, both list pages. React makes this
fast enough here, but the design couples unrelated consumers, and the fix
is standard: **split state and actions into two contexts** (actions are
stable — action-only consumers then never re-render), optionally splitting
`recipeSlugs` from `checked` as well. Doing this later is a breaking change
to every consumer; doing it at creation was free. Exercise 2.3.

## 8. 🟢 Stringly-typed data fields

`prepTime`/`cookTime` are free-form strings — the data already contains
`"15 min"`, `"14 minutes"`, `"2 hours"`, `"1 hour"`. Inconsistent display
today; impossible features tomorrow (sort by total time, "under 30 min"
filter — both natural cookbook features) without a data cleanup that gets
more expensive as recipes accumulate. `difficulty` got this right (a
literal union); time fields should have been `prepMinutes: number | null`
with formatting at the display layer. Same disease, milder form: `category`
and `cuisine` as raw strings in JSON have no schema validation until the
generator/compiler — a JSON Schema for the recipe files would catch typos
in-editor, where they're cheapest.

## 9. 🟢 Versioned storage key, but no migration story

The `.v1` suffix on `recipeweb.shoppingList.v1` shows the right instinct,
but there's no code path for what `v2` does with `v1` data — the implicit
plan is "ignore it," i.e., silently discard users' lists on schema change.
A `migrate(raw: unknown): State` function — even one that just handles
v1→current — should have existed from the start, because (see #1) a schema
change is not hypothetical. Persisted data is an API you have with your
past self; version *and* migrate it.

## 10. 🟢 Assorted craft issues

Individually minor; listed because noticing them is review practice:

- **`RecipePage.tsx` uses inline `style={{…}}`** in two places while the
  rest of the app uses the stylesheet. Pick one system; inline styles dodge
  the design tokens (`--accent` etc.) and can't be themed.
- **`new URL(recipe.sourceUrl)`** throws on malformed URLs — one bad data
  entry would crash the whole recipe page (defense exists for slugs but not
  for this). The generator validates presence, not URL validity: one-line
  fix in the generator, where it belongs.
- **`document.execCommand('copy')`** in the `useCopy` fallback is
  deprecated. Fine as a fallback, but worth a comment noting it's
  intentionally legacy-only.
- **Accessibility gaps:** filter chips don't expose `aria-pressed`
  (ingredient rows do — inconsistent); the "✓" state changes are visual
  only, no `aria-live` announcement; color-only distinction between some
  states.
- **No error boundary:** any render error white-screens the whole app.
  One `<ErrorBoundary>` around the routes = graceful degradation.
- **Repo hygiene:** this project sits inside a git repository whose root is
  the user's *home directory*. It should be its own repo — as-is, the
  GitHub Actions workflow can't even run, `git status` is unusable, and a
  careless `git add .` from the wrong directory would commit personal
  files. Probably the first thing to actually fix on this list.
- **Search UX at the margins:** the search input isn't debounced (fine at
  74 recipes — knowing it's fine, and *why*, is the point of the "10×"
  review question) and matching is substring-only (`"chiken"` finds
  nothing).

---

## What the project got *right* (calibration matters)

A review that only lists flaws teaches you to be a cynic, not a senior.
The load-bearing good decisions, worth imitating:

- **No backend for all-readers-same-data.** The single best call in the
  project; everything cheap about maintaining this app flows from it.
- **Codegen + typed output** — two-layer data validation with clear error
  messages, and normalization in exactly one place.
- **Types that mostly tell the truth:** honest `| null` fields, literal
  unions for cuisine/category/difficulty, exhaustive `Record`s that turn
  additions into compiler to-do lists.
- **Defensive persistence reads:** try/catch, shape checks, filtering
  stale slugs, graceful no-storage fallback. `loadState` is a model
  function.
- **Fail-fast ergonomics:** the `useShoppingList` provider guard converts
  a distant confusing crash into an immediate named error.
- **Boring, appropriate tech:** plain CSS with design tokens, Context over
  a state library, no dependency that a smaller tool could replace. Every
  dependency you don't add is maintenance you don't owe.

The pattern in both lists: the good decisions were *sized to the problem*,
and the debts are mostly *identity and evolution* problems — what happens
when data changes shape, when users hold old state, when the project grows.
Juniors build for the demo; seniors build for the second year. The
difference is exactly the items on this page.
