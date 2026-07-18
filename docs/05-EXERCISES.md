# 05 — Exercises: The Ladder

These are ordered by difficulty and mapped to the skill they build. Each has
a **Definition of Done** — the habit of asking "how do I know I'm actually
finished?" is itself a senior skill, so practice it here.

Ground rules:

- Work on a branch per exercise (`git checkout -b ex/03-tag-filter`), even
  though you're solo. Small, revertible units of work are a professional
  reflex, not a team formality.
- "Done" always includes: `npm run build` passes, `npm run lint` passes,
  and you clicked through the affected screens yourself.
- After finishing each one, read your own diff (`git diff main`) line by
  line and ask: would I approve this if someone else sent it to me?

---

## Tier 1 — Junior (learn the codebase by touching it)

### 1.1 Difficulty badge colors
The difficulty dots (`●● Medium`) are all the same gray. Give easy/medium/
hard distinct colors, consistent with the design system (use CSS variables;
look at how `.cuisine-tag.thai` does it).
**Files:** `RecipeCard.tsx`, `index.css`.
**DoD:** three visibly distinct difficulties on the home grid; colors defined
as variables in `:root`, not hardcoded in the rule.
**Skill:** reading an existing pattern and extending it *in the same style*.

### 1.2 Recipe count per chip
Make each cuisine chip show its count: `Thai (21)`.
**Files:** `HomePage.tsx`.
**DoD:** counts correct for all chips including "All cuisines" (74); counts
are computed from `RECIPES`, not hardcoded; still correct if you add a
recipe to a JSON file and regenerate.
**Skill:** deriving values from data at render time.

### 1.3 Empty search state
Search for "xyzzy" — you get a blank grid with no explanation. Add a
friendly empty state with a "Clear search" button. There's an existing
`.empty-state` pattern in `ShoppingListPage.tsx` — reuse it.
**DoD:** message appears only when `filtered.length === 0`; the button
resets the query (and only the query — check your assumption: should it
reset the cuisine/category filters too? Decide and be able to defend it).
**Skill:** UX edge cases; noticing that "no results" is a state you must
design, not an accident.

### 1.4 Add a real recipe end-to-end
Find a recipe on one of the credited sites, add it to the right JSON file
with a complete grouped ingredient list, regenerate, verify in the UI.
**DoD:** generator prints 75; recipe renders with groups intact; source
link works; it appears under the right filters; slug follows the existing
naming style.
**Skill:** the data pipeline, and care with someone else's content
(ingredient lists + link only — never copy instructions).

---

## Tier 2 — Mid-level (design within constraints)

### 2.1 Tag filtering
Tags render on the recipe page but do nothing. Make them clickable: clicking
`spicy` navigates to the home page filtered to that tag, alongside the
existing filters.
**Design decisions you must make (write them down first):** Where does the
tag filter state live — component state like the others, or the URL
(`/#/?tag=spicy`)? What are the tradeoffs? (Hint: can you share a filtered
view with a friend right now? Should you be able to?)
**DoD:** tag filter combines correctly with cuisine + category + search;
an active tag filter is visible and clearable; build/lint pass.
**Skill:** state-location decisions — the most common mid-level design call.

### 2.2 Scale servings
Add ×½ / ×1 / ×2 buttons to the recipe page that scale ingredient
quantities.
**The trap (discover it before coding):** quantities are *strings* —
`"1½ cup"`, `"400g/14oz"`, `"to taste"`. You cannot reliably scale them all.
A mid-level answer scales what's parseable and leaves the rest visibly
unscaled (e.g. an asterisk); a junior answer either crashes on `"to taste"`
or silently shows wrong numbers. Silent-wrong is the worst outcome —
remember the checked-index flaw from IMPROVE.md #1.
**DoD:** a written note (comment or docs) stating what is and isn't scaled
and why; unparseable quantities clearly marked; servings label updates.
**Skill:** working honestly with messy real-world data; failing visibly
instead of lying.

### 2.3 Split the context (the IMPROVE.md #7 fix)
Refactor `ShoppingListContext` into two contexts: one for state, one for
actions (the actions object never changes, so action-only consumers never
re-render). Verify with the `console.log('header render')` experiment from
04-REACT.md exercise 4 — before and after.
**DoD:** behavior identical; the header no longer re-renders on ingredient
check; public API (`useShoppingList` or successors) still guards against
missing provider; no component outside the store file needed changes beyond
imports — if they did, reflect on the API design.
**Skill:** refactoring for performance with evidence, not vibes.

### 2.4 Set up tests (there are none — that's IMPROVE.md #2)
Install Vitest + React Testing Library. Write:
- unit tests for `ingredientsToText` (groups, ungrouped, quantity-less items),
- a test that `loadState` survives corrupted localStorage JSON,
- a component test: HomePage search for "pad thai" shows the right card.
Add `"test": "vitest"` to package.json scripts.
**DoD:** `npm test` runs green; at least one test *failed first* because it
caught a wrong assumption of yours (if none did, your tests are too gentle —
tighten them until you learn something).
**Skill:** the testing muscle. This exercise pays compound interest on every
later one.

---

## Tier 3 — Senior (own a problem end-to-end)

### 3.1 Fix the checked-ingredient identity bug
The flagship flaw (IMPROVE.md #1): checked state keyed by array index breaks
silently when a recipe's ingredients are edited. Design and implement a
durable fix.
**You must produce:** (a) a one-page design note — at least two alternative
key schemes (e.g. content-hash of the item text vs. explicit ids in JSON),
their failure modes, migration plan for existing users' localStorage;
(b) the implementation including a `v1 → v2` storage migration;
(c) tests proving the migration and the edit-resilience.
**DoD:** reordering ingredients in a JSON file and regenerating no longer
misattributes checks; old stored data is migrated, not discarded; design
note could be handed to another engineer to review the decision.
**Skill:** this is the full senior loop — problem framing, alternatives,
migration, verification, written rationale.

### 3.2 Merge duplicate ingredients across the shopping list
Add "combined view" to the shopping list: `garlic` appearing in 5 recipes
becomes one line ("garlic — for 5 recipes"). Checking it checks all
underlying entries.
**Why this is senior:** ingredient text is unnormalized natural language
("2 cloves garlic", "garlic, minced", "8 cloves garlic (thinly sliced)").
Perfect merging is impossible; you're designing a *good-enough* heuristic
with a clear escape hatch (per-recipe view stays available). Scope it,
document the heuristic's known misses, ship it behind a toggle.
**DoD:** toggle between per-recipe and combined; check state stays
consistent between views; a written note on the matching heuristic and its
known limitations.
**Skill:** judgment under ambiguity — knowing when 85% correct with an
escape hatch beats chasing 100%.

### 3.3 Per-recipe URLs that unfurl (the SEO problem, IMPROVE.md #6)
Hash routing makes every recipe the same URL to crawlers and chat apps.
Investigate and implement the best option that keeps hosting simple:
pre-rendering recipe pages at build time, switching to BrowserRouter +
host rewrites, or a hybrid. Start with a written comparison (constraints:
GitHub Pages must keep working), get it "reviewed" (rubber-duck it against
IMPROVE.md), then implement.
**DoD:** pasting a recipe URL into a chat shows a per-recipe title/
description; direct navigation and refresh work on the deployed host; the
decision doc explains what you gave up.
**Skill:** architectural change to a live constraint, executed without
breaking the property (zero-config hosting) that motivated the original
design.

### 3.4 CI quality gate
`deploy.yml` builds on push to main — nothing checks PRs. Add a CI workflow
that runs lint, build, tests, and *verifies the generated file is in sync*
(run the generator, `git diff --exit-code src/data/recipes.ts` — this
catches "edited JSON, forgot to regenerate", closing IMPROVE.md #4).
**DoD:** a PR with a broken type, a failing test, or a stale generated file
gets a red X; a clean PR gets a green check; the workflow finishes in under
~2 minutes.
**Skill:** building the guardrails a team runs on. Seniors don't just write
correct code — they make incorrect code hard to merge.

---

## After the ladder

Do the exercises in `06-GROWTH.md` continuously while working through these.
When you finish Tier 3, you will have: designed a migration, built a test
suite from zero, made an architectural tradeoff under constraints, and
automated quality enforcement. That *is* the mid→senior transition — there's
no secret beyond doing these things repeatedly, on larger systems, with
other people involved.
