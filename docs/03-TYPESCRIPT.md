# 03 — TypeScript, Taught From This Codebase

TypeScript is JavaScript plus a *type system*: a way to describe what shape
your data has, checked by a compiler before the code ever runs. Every
concept below is used somewhere in this repo — each section names the file
so you can see it in the wild.

Work through this with an editor open. Hover over things. Hovering over any
variable in VS Code shows you its inferred type — that's how you learn to
"see" types.

## 1. Why types at all?

Plain JavaScript happily runs this:

```js
const recipe = { name: 'Adobo' };
console.log(recipe.tittle.toUpperCase()); // 💥 crashes AT RUNTIME
```

The typo (`tittle`) is only discovered when a user hits that line.
TypeScript refuses to compile it: *"Property 'tittle' does not exist"*. The
whole value proposition is **moving failures from runtime (users see them)
to compile time (only you see them)**.

Try it: in `src/pages/RecipePage.tsx` change `recipe.name` to
`recipe.namee` and run `npm run build`. Read the error carefully — file,
line, what it expected, what it found. Error-message literacy is a skill;
practice it deliberately.

## 2. Interfaces — describing object shapes

`src/types.ts` is our vocabulary file. The core of it:

```ts
export interface Ingredient {
  group: string | null;   // e.g. "Marinade", or null if ungrouped
  quantity: string;
  item: string;
}

export interface Recipe {
  slug: string;
  name: string;
  nativeName: string | null;
  cuisine: Cuisine;
  // … more fields
  ingredients: Ingredient[];   // an array of Ingredient objects
  tags: string[];              // an array of strings
}
```

An `interface` is a contract: "anything calling itself a Recipe has exactly
these fields with exactly these types." It costs nothing at runtime — types
are erased when TypeScript compiles to JavaScript. They exist purely to
catch mistakes and power your editor's autocomplete.

**`string | null` is a union type** — this field is either a string *or*
null. TypeScript then *forces* you to handle the null case. That's why
`RecipePage.tsx` writes:

```tsx
{recipe.nativeName && <p className="native-name">{recipe.nativeName}</p>}
```

If you tried to render `recipe.nativeName.toUpperCase()` without checking,
the compiler would stop you: *"'nativeName' is possibly 'null'"*. A whole
category of production crashes (`Cannot read properties of null`) —
eliminated by the type system, **if** you model nullability honestly instead
of pretending fields are always present.

## 3. Literal union types — "one of these exact strings"

Top of `src/types.ts`:

```ts
export type Cuisine = 'filipino' | 'vietnamese' | 'thai' | 'spanish';
export type Difficulty = 'easy' | 'medium' | 'hard';
```

This is a union of **string literals**. A `Cuisine` isn't any string — it's
one of exactly four. Assign `"thia"` to a `Cuisine` anywhere and the build
fails. Compare the amateur alternative, `cuisine: string`, which would
accept every typo forever.

This gives our data pipeline a superpower: `src/data/recipes.ts` is declared
as `Recipe[]`, so if any of the 74 generated recipes had a misspelled
cuisine or difficulty, `npm run build` fails *before deployment*.

**Rule to internalize:** if a value can only be one of N known things, make
the type say so. Every `string` in a type definition is a small lie unless
literally any string is valid.

## 4. `Record` — typed dictionaries, and exhaustiveness

Also in `types.ts`:

```ts
export const CUISINE_LABELS: Record<Cuisine, string> = {
  filipino: 'Filipino',
  vietnamese: 'Vietnamese',
  thai: 'Thai',
  spanish: 'Spanish',
};
```

`Record<Cuisine, string>` means: an object whose keys are **every** Cuisine
and whose values are strings. Two-way enforcement:

- Add a key that isn't a Cuisine → error.
- **Omit** one of the four cuisines → error. ("Property 'spanish' is missing")

That second part is called **exhaustiveness**, and it's how this repo made
adding Thai + Spanish safe: the moment `'thai'` was added to the `Cuisine`
union, the compiler produced a to-do list — every `Record<Cuisine, …>` and
every switch-like usage that didn't yet handle it. The type system turned
"grep and hope" into "fix every red squiggle and you're done."

## 5. Type inference — you don't annotate everything

Look at `HomePage.tsx`:

```ts
const filtered = useMemo(() => {
  return RECIPES.filter((r) => { … });
}, [cuisine, category, query]);
```

Nobody wrote a type for `filtered` or for `r` — TypeScript *infers*
`Recipe[]` and `Recipe` from `RECIPES`'s type flowing through `.filter`.
Good TypeScript style annotates **boundaries** (function parameters, return
types of exported functions, data files) and lets inference handle the
middle. Over-annotating everything is a junior tell; it adds noise and can
even mask mistakes.

## 6. Generics — types with parameters

`useState` in `HomePage.tsx`:

```ts
const [cuisine, setCuisine] = useState<Cuisine | 'all'>('all');
```

`useState` is a **generic function** — it works "for any type T", and here
we tell it `T = Cuisine | 'all'`. Why explicitly? Because if we just wrote
`useState('all')`, TypeScript would infer the *narrowest* type: `'all'`
only, and `setCuisine('thai')` would be an error. The annotation widens the
state to what it will ever hold.

You also *write* generics, not just use them — see `src/hooks/useCopy.ts`'s
return type:

```ts
function useCopy(timeoutMs = 2000): [boolean, (text: string) => Promise<void>]
```

That return type is a **tuple**: an array with exactly two elements of
specific types — first a boolean, then a function. This is why
`const [copied, copy] = useCopy()` gives `copied: boolean` and `copy` a
callable, in that order.

## 7. Type narrowing and type predicates

TypeScript follows your `if` statements. In `RecipePage.tsx`:

```ts
const recipe = RECIPES.find((r) => r.slug === slug);
// here: recipe is `Recipe | undefined` (find can fail)

if (!recipe) {
  return <NotFound … />;   // early return
}
// here: recipe is `Recipe` — the undefined was "narrowed" away
```

After the early return, the compiler *knows* recipe exists. This
early-return-then-proceed shape is idiomatic; nesting the whole page in
`if (recipe) { … }` would say the same thing worse.

The advanced version lives in `ShoppingListContext.tsx`:

```ts
const recipes = state.recipeSlugs
  .map((slug) => RECIPES.find((r) => r.slug === slug))  // (Recipe | undefined)[]
  .filter((r): r is Recipe => Boolean(r));              // Recipe[]
```

`(r): r is Recipe` is a **type predicate** — it tells the compiler "when
this function returns true, `r` is a `Recipe`". A plain
`.filter(Boolean)` would *remove* the undefineds at runtime but the type
would still say `(Recipe | undefined)[]`; the predicate updates the type to
match reality. (Recent TS versions have gotten smarter about inferring
this, but the explicit predicate is the portable idiom you'll see in every
codebase.)

## 8. `as const` and `keyof` — deriving instead of repeating

`HomePage.tsx` derives its filter chips from the labels object:

```ts
const CUISINE_FILTERS: (Cuisine | 'all')[] = [
  'all',
  ...(Object.keys(CUISINE_LABELS) as Cuisine[]),
];
```

Two things to study:

- `Object.keys()` returns `string[]` — TypeScript deliberately forgets
  the keys' specific types (because objects can have extra keys at runtime).
  The `as Cuisine[]` is a **type assertion**: "trust me, compiler." It's
  safe here because `CUISINE_LABELS` is `Record<Cuisine, string>` — its keys
  are *exactly* the cuisines. Assertions are a loaded gun: they silence the
  compiler, so every one you write should have an obvious safety argument
  like this one. If you can't articulate why an `as` is safe, don't write it.
- The deeper win: the chip row is **derived from data** instead of a
  hardcoded list. Adding a cuisine now updates the UI automatically. The
  original code hardcoded `['all', 'filipino', 'vietnamese']` — which is
  exactly why adding Thai required editing this file. Deriving beats
  duplicating.

`type` vs `interface`, since you'll ask: for object shapes they're nearly
interchangeable; this repo uses `interface` for object shapes and `type`
for unions. That's a common convention — pick one and be consistent.

## 9. Where the type system CAN'T save you

Critical senior insight: types verify *shape*, not *meaning*.

- `prepTime: string | null` — accepts `"15 min"`, `"15 minutes"`, and
  `"fifteen"`. The inconsistency is real (compare Thai vs Filipino data).
  A `prepMinutes: number | null` would push consistency into the type.
- The generator's runtime validation (`generate-recipes.mjs`) still matters:
  *duplicate slugs* are a data property no type can express.
- `checked: Record<string, boolean>` — the string keys are secretly
  `` `${slug}:${index}` ``, but nothing enforces that format. TypeScript
  has template literal types (`` type CheckKey = `${string}:${number}` ``)
  that could — this repo doesn't use them. Knowing what the type system
  *could* enforce but currently doesn't is exactly the review skill
  IMPROVE.md practices.

## Exercises (do now, ~45 min)

1. Add `'brazilian'` to the `Cuisine` union in `types.ts`. Run
   `npm run build`. List every error. Fix them all (label, CSS not required
   for compiling — note which changes the compiler could NOT prompt).
   Then revert (`git checkout src/types.ts` etc. — or just undo).
2. In `types.ts`, change `nativeName: string | null` to `nativeName: string`.
   Build. Why do the errors appear in `recipes.ts` and not in the pages?
   What does that tell you about where nullability is *enforced* vs *handled*?
3. Write (in a scratch file) a function
   `recipesByCuisine(recipes: Recipe[]): Record<Cuisine, Recipe[]>`
   with no type assertions. It's harder than it looks — building a Record
   requires initializing every key. That struggle is the lesson.

Next: [04-REACT.md](04-REACT.md).
