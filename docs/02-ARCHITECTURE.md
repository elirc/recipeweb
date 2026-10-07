# 02 — Architecture: How It Works and Why It's Built This Way

Junior engineers learn *what* the code does. Mid-level engineers learn *how*
it works. Senior engineers can explain *why it's this way and not another
way* — and what would make them change their mind. This doc practices that
skill on our own codebase.

Every section below follows the same pattern: **the decision → the
alternatives → why this one → when it would be wrong.**

## Decision 1: No backend — data compiled into the bundle

**What we do:** all 74 recipes live in `src/data/recipes.ts`, a generated
file imported like any other module. The production site is pure static
files.

**Alternatives:**
- A real database + API server (Postgres + Express/FastAPI/etc.)
- A hosted "backend as a service" (Firebase, Supabase)
- Static JSON files fetched at runtime (`fetch('/recipes.json')`)

**Why this one:** the data is small (~75KB), changes rarely, is the same for
every user, and nobody edits it from the browser. A database would add a
server to pay for, secure, and keep alive — for data that changes a few
times a year via pull request. Baking data into the bundle also means zero
loading states: the recipes are simply *there* when the code runs.

Compare what "add a recipe" costs in each world:

| | This app | With a backend |
|---|---|---|
| Storage | JSON file in git | DB table + migrations |
| Validation | generator script + `tsc` | API validation layer |
| Deployment | git push | deploy API + run migrations |
| Failure modes | build fails (visible, pre-deploy) | runtime 500s (visible to users) |

**When it would be wrong:** the moment users need to *write* shared data
(ratings, comments, user accounts), or the dataset grows big enough that
shipping all of it to every visitor is wasteful (rule of thumb: hundreds of
KB of data). Then you'd split data out of the bundle — see IMPROVE.md for
the intermediate steps before jumping to a full backend.

**The senior lesson:** the cheapest infrastructure is the infrastructure you
don't have. Every component you add (server, DB, cache) is something that
can be down at 3am. Earn complexity; don't start with it.

## Decision 2: Codegen (JSON → generated .ts) instead of importing JSON directly

**What we do:** `scripts/generate-recipes.mjs` reads four JSON files,
validates them, and writes `src/data/recipes.ts` with an explicit
`: Recipe[]` type annotation.

**Alternative:** Vite can import JSON directly — `import recipes from
'./thai.json'` just works. Why the extra step?

**Why this one:** two reasons.

1. **Validation at the earliest possible moment.** The generator throws on a
   duplicate slug or a missing field *when you run it*, with a message
   naming the exact recipe. TypeScript's JSON imports infer loose types —
   a typo like `"cuisine": "thia"` in a direct JSON import produces the
   inferred type `string`, which *would* be caught when assigned to
   `Recipe[]`… but the error message points at the assignment, not the
   recipe. The generator + the `: Recipe[]` annotation gives you both:
   friendly errors early, compiler enforcement always.
2. **A place for normalization.** The `&amp;` → `&` cleanup and
   `quantity: null` → `''` conversion happen once, at generation time,
   instead of scattered through UI code at render time.

**When it would be wrong:** if the data changed often or was edited by
non-engineers, a generated file people must remember to regenerate becomes a
footgun ("I edited the JSON, why didn't the site change?"). The mitigation
would be running the generator automatically as part of `npm run dev`/`build`
— which honestly we should do anyway (see IMPROVE.md #4).

## Decision 3: Hash routing (`/#/recipe/pad-thai`)

**What we do:** `App.tsx` uses `HashRouter` from react-router. All routes
live after a `#` in the URL.

**Alternative:** `BrowserRouter` gives clean URLs (`/recipe/pad-thai`).

**Why this one:** with clean URLs, when a user refreshes the page on
`/recipe/pad-thai`, the *browser asks the server* for that path — and a
static host that doesn't know about our app returns 404, because there's no
`recipe/pad-thai/index.html` file. Fixing that requires host configuration
(rewrite rules) that differs per host. Everything after `#` is never sent to
the server, so `HashRouter` works on *any* static host, including GitHub
Pages subpaths, with zero configuration. Combined with `base: './'` in
`vite.config.ts` (relative asset paths), the `dist/` folder is genuinely
host-agnostic — you could open it from a USB stick.

**The cost:** ugly URLs, and — more importantly — search engines and social
media link previews treat all hash URLs as the same page. Recipe pages are
invisible to Google.

**When it would be wrong:** if SEO mattered (a public cookbook site would
plausibly want recipe pages indexed!), this is the wrong call. This is a
genuine tension in this app — read IMPROVE.md #6 for what we'd do instead.

## Decision 4: One React Context for the shopping list

**What we do:** `ShoppingListContext.tsx` holds `{ recipeSlugs, checked }`
in a single `useState`, exposes actions (`addRecipe`, `toggleChecked`, …),
and persists every change to `localStorage` via a `useEffect`.

**Alternatives:**
- Prop drilling (pass state down through every component manually)
- A state library (Redux, Zustand, Jotai)
- Component-local state in each page

**Why this one:** the state is needed in three distant places (header badge,
recipe cards, shopping list page), which rules out local state and makes
prop drilling painful. A state library is a dependency, a learning curve,
and boilerplate — to manage *two fields*. React's built-in Context does the
job with zero dependencies.

**Read the code with these questions** (answers in 04-REACT.md):
- Why is state initialized with `useState(loadState)` — passing the
  *function* — instead of `useState(loadState())`?
- Why is every action wrapped in `useCallback`, and the `value` object in
  `useMemo`?
- Why does `useShoppingList()` throw if there's no provider above it?

**When it would be wrong:** more state domains (auth, preferences, cached
server data), or performance problems from too many consumers re-rendering.
Note the subtle flaw that already exists: *any* checkbox toggle re-creates
the context value, so *every* consumer re-renders — including the header.
Fine at this scale; a real cost at 10× the scale. IMPROVE.md #7 covers the
fix (splitting state and actions into separate contexts).

## Decision 5: localStorage for persistence

**What we do:** the entire shopping list state —
`{ recipeSlugs, checked, quantities }` — serializes to one localStorage key,
`recipeweb.shoppingList.v1` (`src/store/ShoppingListContext.tsx:32`).
`quantities` (per-ingredient override strings) was added later without
bumping the key; the normalizer treats a missing field as "no overrides", so
older stored documents still load.

**Why:** no accounts, no server — the user's own browser is the only place
to remember things. localStorage is synchronous, ~5MB, survives restarts.

**Details worth studying in `loadState()` (`ShoppingListContext.tsx:34-38`):**
- It's wrapped in `try/catch` — localStorage can throw (private browsing,
  disabled storage) and stored JSON can be corrupted. Defensive reads of
  external data are a habit, not an optimization.
- It delegates to the pure function `normalizeShoppingState`
  (`src/store/shoppingState.ts:8-25`), which **filters out slugs that no
  longer exist in RECIPES**, de-duplicates slugs, and keeps a `checked` or
  `quantities` entry only if its `slug:index` key points at a real
  ingredient of a listed recipe and its value has the right type (overrides
  are capped at 100 characters). Because it is pure and takes `recipes` as a
  parameter, `test/shopping-state.test.ts` can test it without React.
- Writes happen in an effect (`:46-53`); a failed write sets
  `storageError`, which the shopping-list page shows as an alert
  (`ShoppingListPage.tsx:45`) while the in-memory list keeps working.
- The key ends in `.v1` — if the shape of the stored data ever changes,
  bump to `.v2` and old data is simply ignored instead of half-parsed.
  (A migration function would be kinder; see IMPROVE.md #9.)

**The limits:** localStorage is per-browser-per-device. No sync between
phone and laptop. That's an accepted product limitation, not an oversight.

## Decision 6: Plain CSS, one file, custom properties

**What we do:** all styling lives in `src/index.css` (~600 lines), using CSS
custom properties (`--accent`, `--thai-soft`, …) defined once in `:root`.

**Alternatives:** Tailwind, CSS Modules, styled-components, Sass.

**Why this one:** at this size, a single well-organized stylesheet with
variables is completely manageable and requires learning *nothing* beyond
CSS itself — which you need to learn anyway. Every styling abstraction
(Tailwind's utility classes, CSS-in-JS runtime) is a layer on top of CSS
that is only worth its cost when the underlying problem (naming collisions,
dead code, theming across huge codebases) actually appears.

**When it would be wrong:** multiple developers writing CSS concurrently
(collisions), components meant to be reused across projects (CSS Modules or
Tailwind would help), or if the file grows past ~1500 lines without
structure.

**The senior lesson:** "boring technology" is a compliment. Choose the
simplest tool the problem allows, and know precisely which pain would make
you upgrade.

## Decision 7: The checked-ingredient key format

**What we do:** each checked-off ingredient is stored as
`` `${slug}:${index}` `` → `true`, where `index` is the ingredient's
position in the recipe's array.

**Why:** ingredients have no IDs; position is the only stable handle
available at render time, and it's trivially cheap.

**Why it's actually a flaw:** if a recipe's ingredient list in the JSON is
ever reordered or an item is inserted in the middle, every saved checkbox
after that point silently shifts to the *wrong ingredient* for every user
who had it checked. No error, no crash — just wrong data. These "silently
wrong" bugs are the most expensive kind. This is the single best design
critique in the codebase — sit with it until you can explain it to someone
else, then read IMPROVE.md #1 for the fix.

## The build pipeline, end to end

```
npm run build
  └─ tsc -b            # type-check ALL .ts/.tsx (fails on any type error)
  └─ vite build        # bundle: 33 modules → dist/
       ├─ dist/index.html                (~1 KB)
       ├─ dist/assets/index-<hash>.css   (~9 KB)
       └─ dist/assets/index-<hash>.js    (~357 KB — React + app + all 74 recipes)
```

The `<hash>` in filenames changes whenever content changes — this is
**cache busting**: hosts can cache assets forever because a new deploy
produces new filenames.

Deployment is "put `dist/` somewhere": GitHub Actions
(`.github/workflows/deploy.yml`) builds and publishes to GitHub Pages on
every push to main; `vercel.json` lets Vercel do the same.

## Questions you should now be able to answer

1. A user reports the site is "down". What are the possible failure points,
   given there's no server? (Hint: there are very few — host outage, bad
   deploy, browser extension interference. That shortness *is* the
   architecture's value.)
2. Product asks: "let users rate recipes 1–5 stars, visible to everyone."
   Which of the seven decisions above break? (At minimum #1 and #5.)
3. Why does the GitHub Actions workflow run `npm run build` but not
   `node scripts/generate-recipes.mjs`? Is that safe? (Answer: only because
   generated output is committed to git. What could go stale?)

Next: [03-TYPESCRIPT.md](03-TYPESCRIPT.md).
