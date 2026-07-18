# 05 — C# and .NET for Someone Who Knows This React App

You already know one language (TypeScript) and one component model (React)
from building/studying the app at the repo root. This doc is a **rosetta
stone**: every mapping starts from code you've already read in `src/` and
shows its .NET counterpart. Learning-by-mapping is dramatically faster than
learning from scratch — but watch for the *false friends* flagged ⚠️, where
similar syntax hides different behavior.

## 1. The mental shift that matters more than syntax

TypeScript types are **erased** — they exist for the compiler, then
vanish; runtime JS will happily carry any shape if you lie with `as`.
C# types are **real at runtime**: an object *is* its class, casts are
checked, and there is no "trust me" that survives compilation. Consequence:
some habits get stricter (no duck typing), some get safer (a `Recipe` can
never secretly be missing a field).

Second shift: your React app ran entirely in one browser, one user, one
thread. The .NET app is **one process serving everyone at once** — every
request runs concurrently with others, services are shared, and "who owns
this state?" becomes a question with real stakes (see DI lifetimes, §6).

## 2. Types: the vocabulary mapping

| You wrote (in `src/types.ts`) | You'll write |
|---|---|
| `interface Recipe { … }` | `class Recipe { … }` (entities) or `record RecipeCard(…)` (immutable view data) |
| `nativeName: string \| null` | `string? NativeName` — nullable reference types |
| `type Cuisine = 'filipino' \| …` | `enum` *if closed at compile time*; a **database table** if data-driven (03-DATA-MODEL.md chose the table — reread why) |
| `Record<Cuisine, string>` | `Dictionary<Cuisine, string>`, or better: the label lives *on* the Cuisine row |
| `Ingredient[]` | `List<Ingredient>` (mutable) / `IReadOnlyList<Ingredient>` (what you should expose) |
| `[boolean, (t: string) => Promise<void>]` (the `useCopy` tuple) | `(bool Copied, Func<string, Task> Copy)` — named tuple; names beat positions |
| `r is Recipe` type predicate | `is` pattern: `if (obj is Recipe r) { …use r… }` — narrowing, but *checked at runtime* |

⚠️ **False friend — `string?` vs `string \| null`:** they look identical
and mostly act it (the compiler makes you check before use — same
discipline as `docs/03-TYPESCRIPT.md` §2). But TS unions are structural
and general (`string | number | null`); C# nullability is a single
annotation, and there is no general union type. Where you'd write a TS
union of literals, C# wants an enum, a class hierarchy, or `OneOf`-style
patterns. Model differently, don't transliterate.

**Records deserve a highlight** — they're the closest thing to the
immutable-update style you drilled in React:

```csharp
public record ShoppingLine(int IngredientId, string Item, bool Checked);

var line = new ShoppingLine(42, "fish sauce", false);
var done = line with { Checked = true };   // new object, original untouched
```

`with` *is* your `{ ...s, checked: … }` spread. Same philosophy: don't
mutate, produce new values. You already have this instinct; keep it.

## 3. LINQ is your array methods, upgraded

You already think in `filter/map/find/some` — that fluency transfers 1:1:

```ts
// HomePage.tsx — the filter you know
const filtered = RECIPES.filter((r) => {
  if (cuisine !== 'all' && r.cuisine !== cuisine) return false;
  if (q && !haystack(r).includes(q)) return false;
  return true;
});
```

```csharp
// RecipeQueryService — the same thought in LINQ
var filtered = db.Recipes
    .Where(r => cuisineId == null || r.CuisineId == cuisineId)
    .Where(r => q == null || r.Name.Contains(q) ||
                r.Ingredients.Any(i => i.Item.Contains(q)))
    .OrderBy(r => r.Name)
    .ToList();
```

Mapping: `filter`→`Where`, `map`→`Select`, `find`→`FirstOrDefault`,
`some`→`Any`, `every`→`All`, `reduce`→`Aggregate` (rare; prefer `Sum`/
`GroupBy`).

⚠️ **The false friend that matters most in this codebase:** against EF
Core, that chain is not filtering an in-memory array — it's **building a
SQL query**. Nothing executes until `ToList()`; the `Where` clauses become
`WHERE` clauses *in the database*. Two consequences you must internalize
in Phase 2:

1. `IQueryable` (recipe for SQL) vs `IEnumerable` (in-memory sequence).
   Call `.ToList()` too early and you've dragged the whole table into
   memory to filter it in C# — the classic perf bug, invisible at 74 rows,
   fatal at 74,000. (Recognize it? It's the "what happens at 10×" review
   question from `docs/06-GROWTH.md` wearing a new hat.)
2. Only expressions translatable to SQL are allowed inside — your helper
   `haystack(r)` function can't go in a `Where`; its *logic* must be
   inlined or done differently.

## 4. Components: React → Razor

Your `RecipeCard.tsx` knowledge maps almost embarrassingly directly:

```tsx
export default function RecipeCard({ recipe }: { recipe: Recipe }) {
  return <article className="recipe-card"><h3>{recipe.name}</h3>…</article>;
}
```

```razor
@* RecipeCard.razor *@
<article class="recipe-card"><h3>@Recipe.Name</h3>…</article>

@code {
    [Parameter, EditorRequired] public required RecipeCardModel Recipe { get; set; }
}
```

| React (you know) | Blazor (you'll write) |
|---|---|
| props | `[Parameter]` properties |
| `{expr}` in JSX | `@expr` in Razor |
| `onClick={() => …}` | `@onclick="() => …"` |
| conditional render `{x && <p/>}` | `@if (x) { <p/> }` |
| `list.map(x => <Card key…/>)` | `@foreach (var x in list) { <Card @key="x.Slug" …/> }` — yes, `@key` exists for the same reconciliation reason |
| `useState` + re-render | mutate a field, then the component re-renders after the event handler (or call `StateHasChanged()` when Blazor can't know) |
| `useEffect(fn, [])` | `OnInitializedAsync()` lifecycle method |
| `children` | `RenderFragment ChildContent` |
| Context | `CascadingValue` / cascading parameters |

⚠️ **The big behavioral difference:** React re-runs your whole function and
diffs; you never mutate. Blazor components are **long-lived class
instances** — you *do* mutate fields, and re-render happens per-event.
The immutability religion from `docs/04-REACT.md` §2 relaxes *inside a
component*; keep it for anything shared.

⚠️ **The render-mode difference (no React equivalent):** every Blazor
component runs in a *mode* — static SSR (renders once to HTML, no events
ever), or interactive (WASM island). A button with `@onclick` in a static
component renders fine and silently does nothing. When your click handler
"doesn't work," check the render mode *first*. This will bite you in
Phase 3; consider yourself warned in writing.

## 5. async/await — same keywords, stricter culture

You've seen `async` in `useCopy.ts`. C#'s is the same idea with `Task<T>`
playing `Promise<T>`. Differences that matter:

- **Everything I/O is async in .NET** — every DB call
  (`await db.SaveChangesAsync()`), every HTTP call. It's not optional
  seasoning; sync-over-async blocks a server thread that could be serving
  another user (remember: one process, everyone at once).
- Async **colors the whole call chain**: an `await` at the bottom means
  `async Task` signatures all the way up. Accept it early; fighting it
  (`.Result`, `.Wait()`) causes deadlocks and is the #1 junior C# crime.

## 6. The genuinely new concept: Dependency Injection

Nothing in the React app prepared you for this, so slow down here.

In `src/`, sharing behavior = importing it: `import { useCopy } from
'../hooks/useCopy'`. Modules are effectively global singletons wired at
bundle time. In ASP.NET Core, you instead **register** services at startup
and **declare** what you need; the framework constructs and hands them in:

```csharp
// Program.cs — the composition root
builder.Services.AddDbContext<SarapDbContext>(…);          // scoped: one per request
builder.Services.AddScoped<ShoppingListService>();
builder.Services.AddSingleton<TimeProvider>(TimeProvider.System);
```

```csharp
public class ShoppingListService(SarapDbContext db, TimeProvider clock)
{
    public async Task ToggleCheckAsync(Guid shopperToken, int ingredientId) { … }
}
```

Why the ceremony? Two reasons you'll *feel* rather than read:

1. **Lifetimes.** A `DbContext` must not be shared across concurrent
   requests (it's stateful, not thread-safe) — so it's **scoped**: each
   request gets its own. A clock or config is **singleton**: one for the
   process. This is the "one process, many users" shift made concrete;
   getting a lifetime wrong is the classic .NET bug (capturing a scoped
   thing inside a singleton).
2. **Swappability = testability.** Tests hand `ShoppingListService` an
   in-test SQLite context and a fake `TimeProvider` — no mocking
   frameworks, no module-patching gymnastics. The constructor *is* the
   seam. (This is why 06-TESTING can be so much stronger than the React
   app's story.)

Map it back: DI's guard-rails play the role `useShoppingList`'s
throw-if-no-provider played (`docs/04-REACT.md` §5) — fail fast at
composition, not deep in a request.

## 7. Where things you know went

| React app concept | Its .NET home |
|---|---|
| `generate-recipes.mjs` validation | `DataImportService` + CI import step (Phase 1) |
| `recipes.ts` (data as code) | SQLite rows (data as… data) |
| localStorage + `loadState()` defensiveness | DB + migrations; the *defensiveness instinct* moves to the import boundary and model binding |
| `ShoppingListContext` | `ShoppingListService` (logic) + Shopper cookie (identity) + DB (state) |
| React Router / `useParams` | endpoint routing: `/recipe/{slug}` binds to a parameter |
| `npm run dev` | `dotnet watch` (hot reload included) |
| `package.json` scripts | project files + `dotnet` CLI verbs |
| oxlint | Roslyn analyzers + `.editorconfig` + `dotnet format` |
| `npm run build` as truth-teller | `dotnet build` — same habit, same reason |

## 8. Idioms to adopt on day one (and junior tells to avoid)

Adopt:
- `var` when the right side makes the type obvious (like your TS inference
  habit from `docs/03-TYPESCRIPT.md` §5 — annotate boundaries, infer
  locals).
- Expression-bodied members for one-liners; pattern matching (`switch`
  expressions) where you'd have written a lookup object in TS.
- `IReadOnlyList<T>` / `IEnumerable<T>` on public surfaces; concrete
  `List<T>` privately.
- Nullable reference types **on** and warnings-as-errors from Phase 0 —
  it's the TS `strict: true` of C#; opting out is learning with the net
  down.

Avoid (the C# equivalents of junior tells you already know):
- `.Result` / `.Wait()` on Tasks (the `as any` of async).
- Catching `Exception` broadly and continuing (the empty-catch you were
  taught to suspect in `loadState` — there it was *narrow and justified*;
  broad-and-silent is how servers lie).
- Static mutable state for convenience (it's shared across *all users*
  now — the stakes changed).
- Interfaces with one implementation created "for testability" — DI +
  concrete classes test fine; add interfaces when a second implementation
  exists (same rule as premature hook extraction, `docs/04-REACT.md` §8).

## 9. Self-check before Phase 2

You're ready to leave the data layer when you can answer these cold —
they're the .NET versions of questions you already answered for React:

1. Why is `DbContext` scoped, not singleton? What breaks — and *when* —
   if you get it backwards? (Hint: only under concurrent load. The worst
   bugs are the ones your solo dev machine can't show you.)
2. `db.Recipes.Where(...).ToList().Where(...)` — what's wrong, at what
   data size does it start mattering, and how would you *see* it happening?
3. Your Blazor button's `@onclick` does nothing and there's no error. List
   the three most likely causes in the order you'd check them.
4. Translate `{ ...state, checked: { ...state.checked, [key]: true } }`
   into the record-`with` idiom, then explain where in the new app that
   pattern *isn't* needed anymore and why (the server owns state now —
   Architecture Decision 5).
