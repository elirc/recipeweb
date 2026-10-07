# 04 — React, Taught From This Codebase

React's core idea fits in one sentence: **UI is a function of state.** You
don't manipulate the page ("find the badge, change its text to 3") — you
change *data*, and React re-runs your functions to produce the new UI.

Every concept below points at real code in this repo. Read this doc with
the files open.

## 1. Components are functions returning UI

Open `src/components/RecipeCard.tsx`:

```tsx
export default function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <article className="recipe-card">
      <h3>{recipe.name}</h3>
      …
    </article>
  );
}
```

- A component is a plain function. Its inputs are **props** (here, one prop:
  `recipe`). Same props in → same UI out.
- The HTML-looking stuff is **JSX** — syntax sugar for function calls that
  build a description of the UI. `{recipe.name}` embeds a JavaScript
  expression. `className` instead of `class` because `class` is a JS keyword.
- `{ recipe }: { recipe: Recipe }` is destructuring + a TypeScript type in
  one: "this function takes an object with a `recipe` field of type Recipe."

Components compose: `HomePage` renders many `RecipeCard`s; `App` renders
`Header`, a page, and `Footer`. The whole app is one tree of function calls
starting from `main.tsx`.

## 2. State — `useState`

Open `src/pages/HomePage.tsx`:

```tsx
const [query, setQuery] = useState('');
```

`useState` returns the current value and a setter. Calling
`setQuery('adobo')` does two things: stores the new value, and **re-renders
the component** — React calls `HomePage()` again, and the new return value
is diffed against the old and applied to the page.

The search box shows the fundamental input pattern (**controlled input**):

```tsx
<input
  value={query}                              // UI shows state
  onChange={(e) => setQuery(e.target.value)} // events update state
/>
```

The input doesn't "own" its text; React state does. The data flows in a
circle: state → screen → user event → setState → state. Once this loop is
intuitive, most of React is intuitive.

**The rule juniors break constantly:** never mutate state.
`state.recipeSlugs.push(slug)` changes the array *in place* — React compares
by reference, sees the "same" array, and may not re-render. Every state
update in this repo builds a **new** object/array. Study
`ShoppingListContext.tsx`:

```ts
{ ...s, recipeSlugs: [...s.recipeSlugs, slug] }   // add
s.recipeSlugs.filter((x) => x !== slug)           // remove — filter returns a NEW array
{ ...s.checked, [key]: !s.checked[key] }          // toggle a key
```

Learn to read those three lines fluently — spread-to-copy, filter-to-remove,
computed-key-to-update. They're 90% of immutable update patterns.

Also note *functional updates*: `setState((s) => …)` receives the latest
state, which protects against stale values when updates happen quickly.
This repo uses the functional form for every update that depends on
previous state. Copy that habit.

## 3. Derived state — compute, don't store

`HomePage` needs "the recipes matching current filters". Bad instinct:
store `filtered` in its own `useState` and update it whenever filters
change (now two sources of truth can disagree). This repo does it right —
`filtered` is **computed during render**:

```tsx
const filtered = useMemo(() => {
  return RECIPES.filter((r) => { …cuisine, category, query checks… });
}, [cuisine, category, query]);
```

`useMemo` is a cache: recompute only when a dependency changes. Honest note:
at 74 recipes, the memoization is unnecessary — filtering is microseconds —
but the *shape* (derive, don't store) is the important lesson.

Same principle, smaller scale, in `ShoppingListPage.tsx`:

```tsx
const done = recipe.ingredients.filter((_, i) => checked[`${recipe.slug}:${i}`]).length;
```

"How many are checked" is never stored anywhere — it's computed from the
source of truth on every render. **If a value can be computed from existing
state, compute it.** Fewer states = fewer bugs.

## 4. Lists and `key`

```tsx
{filtered.map((r) => <RecipeCard key={r.slug} recipe={r} />)}
```

`key` tells React which rendered item corresponds to which data item when
the list changes, so it can reorder/remove DOM nodes instead of rebuilding
them (and so component state doesn't jump between items). Keys must be
**stable and unique** — `r.slug` is both. Using the array index as key is
the classic junior bug (it breaks when items reorder)…

…and notice something uncomfortable: `IngredientChecklist.tsx` uses
`key={index}` for ingredients. It gets away with it because ingredient
lists never reorder at runtime. But the *same index-instability problem*
bites this codebase anyway — in the persisted `${slug}:${index}` checkbox
keys (see IMPROVE.md #1). The same root cause can be "fine" in one place
and a real bug in another; judging which is which is the skill.

## 5. Sharing state — Context

Problem: the header badge, every recipe card, and two pages all need the
shopping list. Their nearest common ancestor is `App`. Passing props down
through every layer ("prop drilling") works but is miserable.

**Context** is React's built-in solution — study
`src/store/ShoppingListContext.tsx` as the canonical pattern, it's textbook:

```
createContext(null)                → the "channel"
<ShoppingListContext.Provider value={…}>  → broadcasts on the channel (in App.tsx)
useContext(ShoppingListContext)    → any descendant tunes in
```

Three details in that file are *senior* details:

1. **Lazy state init:** `useState<ShoppingListState>(loadState)` passes the
   function itself, so the (relatively expensive, try/catch-ing)
   localStorage read runs once — not on every render. `useState(loadState())`
   would call it every render and throw the result away.
2. **The custom-hook guard:**
   ```ts
   export function useShoppingList() {
     const ctx = useContext(ShoppingListContext);
     if (!ctx) throw new Error('useShoppingList must be used within ShoppingListProvider');
     return ctx;
   }
   ```
   Without this, using the hook outside the provider silently returns
   `null` and crashes later at a confusing distance. The guard converts a
   confusing runtime bug into an immediate, named error. **Fail fast, fail
   loud, fail near the mistake.**
3. **Persistence as an effect:**
   ```ts
   // src/store/ShoppingListContext.tsx:46-53
   useEffect(() => {
     try {
       window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
       setStorageError(false);
     } catch {
       setStorageError(true); // Keep the current session usable; disclose persistence failure.
     }
   }, [state]);
   ```
   `useEffect` runs *after* render, for side effects — things that touch
   the world outside React (storage, network, timers, DOM APIs). The
   `[state]` dependency array means "run this whenever `state` changes."
   Note the failure posture: if storage is unavailable, the app degrades
   gracefully instead of crashing — and, unlike a silent `catch {}`, it
   *tells* the user: `storageError` drives the alert at
   `ShoppingListPage.tsx:45`. One quirk to spot: the effect also runs on
   mount, so the first render immediately writes the normalized state back,
   which is how a corrupted stored document gets cleaned up.

## 6. `useCallback` / `useMemo` — referential identity

Why is every action in the store wrapped in `useCallback`, and the `value`
object in `useMemo`? Because **functions and objects are compared by
reference**. A component re-renders → recreates its functions → anything
comparing old-vs-new sees "changed" even if the behavior is identical.
Memoizing keeps the same reference across renders so consumers/dep-arrays
don't churn.

Real talk, because juniors over-apply this: memoization here is *hygiene*
(a context value should be stable), but sprinkling `useCallback` on
everything is noise. The default is: don't memoize until identity
actually matters (context values, dependency arrays, memoized children).

And one flaw to notice, having learned all that: the store's `value` is one
object rebuilt whenever *anything* changes — so checking off one ingredient
re-renders the header badge too. Harmless at this scale; the split-context
fix is in IMPROVE.md #7. Being able to *find* this in review is the goal.

## 7. Routing

`App.tsx`:

```tsx
<HashRouter>
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/recipe/:slug" element={<RecipePage />} />
    <Route path="/shopping-list" element={<ShoppingListPage />} />
  </Routes>
</HashRouter>
```

`:slug` is a **URL parameter**. `RecipePage` reads it:

```tsx
const { slug } = useParams<{ slug: string }>();
const recipe = RECIPES.find((r) => r.slug === slug);
if (!recipe) { return <NotFound/>; }
```

The URL is state too — and it's *user-editable* state. Someone can type
`/#/recipe/garbage` directly, so the not-found branch isn't optional
politeness; it's handling untrusted input. Also note `<Link to>` /
`<NavLink>` instead of `<a href>` for internal navigation — real anchors
would reload the whole page and wipe in-memory state.

## 8. Custom hooks — extracting reusable behavior

`src/hooks/useCopy.ts` packages "copy text + show ✓ for 2 seconds" and is
used by both `RecipePage` and `ShoppingListPage`:

```ts
const [copied, copy] = useCopy();
```

A custom hook is just a function that calls other hooks. This one
demonstrates three transferable techniques — read it line by line:

- **Progressive enhancement:** try the modern API
  (`navigator.clipboard.writeText`), fall back to the legacy hack
  (hidden textarea + `execCommand`) when it throws.
- **`useRef` for a non-rendered value:** the timer id needs to survive
  re-renders but shouldn't *cause* them. That's exactly what a ref is:
  a box whose `.current` you can mutate without triggering renders.
- **Effect cleanup:** `useEffect(() => () => clearTimeout(timer.current), [])`
  returns a cleanup function that runs when the component unmounts —
  otherwise a pending timer would fire `setCopied(false)` on an unmounted
  component. Timers, subscriptions, listeners: whatever an effect starts,
  its cleanup must stop.

**When to extract a hook:** the moment two components need the same
stateful behavior. Not before — premature abstraction is worse than
duplication.

## 9. Rules of hooks

The linter (`.oxlintrc.json` enables `react/rules-of-hooks` as an error)
enforces what React requires: **hooks are called unconditionally, at the
top level, in the same order every render** — never inside `if`/loops/
callbacks. That's why `RecipePage` calls all its hooks *before* the
`if (!recipe) return` early-exit. Move `useCopy()` below that `if` and
the linter flags it; at runtime it would corrupt hook state whenever the
branch flips. (React tracks hook state positionally — that's the whole
reason for the rule.)

## Exercises (do these — reading is not learning)

1. **Trace a click.** Set a breakpoint (or add `console.log`s) and follow:
   click "+ Shopping list" on a card → `toggleRecipe` → `setState` →
   which components re-run? → effect writes localStorage. Write the
   sequence down. Check the Application tab in DevTools to see the stored JSON.
2. **Add a "sort by" dropdown** to HomePage (name A–Z / ingredient count).
   You'll need one new `useState` + extending the derived computation.
   Don't store the sorted array in state — derive it.
3. **Build `useDocumentTitle(title: string)`** — a custom hook that sets
   `document.title` and restores the old one on unmount. Use it so
   RecipePage shows the recipe name in the browser tab. (You now know
   everything needed: effect + cleanup + dependency array.)
4. **Predict-then-verify:** before running, write down what happens to the
   header badge when you check off an ingredient (not add a recipe). Then
   add a `console.log('header render')` inside `Header` and verify. This
   is the re-render cost from section 6 — seeing it beats being told.

Next: [05-EXERCISES.md](05-EXERCISES.md) — the full graded ladder.
