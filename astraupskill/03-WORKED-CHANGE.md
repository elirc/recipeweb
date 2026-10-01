# Worked implementation and examples

[Course index](README.md)

## Before and after

**Before:** The shopping list persisted recipe selection and checkmarks, but quantities came only from recipe data and could not be adjusted. Storage checking was shallow.

**After:** Shoppers can edit quantities using labeled keyboard-accessible controls. Overrides persist, removal cleans up stale keys, and copied text uses the same effective quantities as the screen. Old saved selections/checkmarks are retained and malformed keys are removed.

## Predict this example

The source ingredient says "1 cup". Change it to "2 1/2 cups" in the shopping list. Reload and copy the list: both still say "2 1/2 cups". The source recipe continues to say "1 cup". Remove the recipe and its override disappears.

Before running anything, write the exact expected stored values and visible response. Include ids or record counts where they matter. Then run the focused tests and reproduce the matching UI/API action. Do not settle for seeing a success message: inspect the authoritative stored result as well.

## Actual implementation excerpt

The excerpt below comes from [src/store/shoppingState.ts](../src/store/shoppingState.ts) near line 8. It is a teaching snapshot; the linked source is authoritative if you later edit the project. Read surrounding code for callers and setup.

```typescript
export function normalizeShoppingState(value: unknown, recipes: Recipe[]): ShoppingListState {
    const empty: ShoppingListState = { recipeSlugs: [], checked: {}, quantities: {} };
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return empty;
    const input = value as Record<string, unknown>;
    const recipeSlugs = Array.isArray(input.recipeSlugs)
        ? [...new Set(input.recipeSlugs.filter((slug): slug is string => typeof slug === 'string' && recipes.some((recipe) => recipe.slug === slug)))] : [];
    const validKeys = new Set(recipeSlugs.flatMap((slug) => recipes.find((recipe) => recipe.slug === slug)!.ingredients.map((_, i) => `${slug}:${i}`)));
    const entries = (field: unknown): [
        string,
        unknown
    ][] => field && typeof field === 'object' && !Array.isArray(field) ? Object.entries(field) : [];
    return {
        recipeSlugs,
        checked: Object.fromEntries(entries(input.checked).filter(([key, v]) => validKeys.has(key) && typeof v === 'boolean')) as Record<string, boolean>,
        quantities: Object.fromEntries(entries(input.quantities).filter(([key, v]) => validKeys.has(key) && typeof v === 'string' && v.length <= 100)) as Record<string, string>,
    };
}
/** Use the same effective quantities for the screen and clipboard. */
```

## How to reason through the code

1. Identify the inputs. Distinguish data supplied by a caller from state read from storage or a trusted context.
2. Find the guard clauses. For each early return or thrown error, describe which invariant it protects and whether anything has already been written.
3. Find the candidate state or query. Explain whether it mutates an existing object or constructs a replacement.
4. Locate the persistence operation. For asynchronous code, follow the promise through success and rejection; for transactions, check that all related writes use the same transaction object.
5. Find the output or state publication. Ask what a repeated invocation would do after the first invocation succeeds.

Use this project-specific reasoning as your guide:

The cookbook is reference data; the shopping list is user state. Mutating the recipe’s ingredient array would mix those responsibilities and could change the recipe-detail screen unintentionally. A keyed override is smaller and preserves the source. Quantity strings are intentionally not automatically parsed or scaled because values can contain fractions, ranges, package sizes and phrases such as "to taste". The nullish-coalescing operator matters: override ?? original respects an empty string, while override || original would silently restore text the user cleared. TypeScript checks source code at compile time, but JSON from localStorage is unknown runtime data, so normalization is still required. A pure normalization function is easy to test without mounting React; interaction and keyboard checks then verify the wiring around it. Storage failure is disclosed rather than hidden behind a claim that progress was saved.

### Unpacking the densest line

Line 13-14 of [shoppingState.ts](../src/store/shoppingState.ts) is one ~200-character expression doing four separate jobs. It is the most important line in the change and the easiest to skim past, so take it apart. The input for every step below is the hostile document `{ recipeSlugs: ['soup', 'soup', 'missing', 42, null] }` against a cookbook whose only recipe is `soup`.

```typescript
const recipeSlugs = Array.isArray(input.recipeSlugs)
    ? [...new Set(input.recipeSlugs.filter((slug): slug is string =>
        typeof slug === 'string' && recipes.some((recipe) => recipe.slug === slug)))]
    : [];
```

**Step 1 - the is-array guard.** `Array.isArray(input.recipeSlugs) ? ... : []`. Everything else in the expression assumes an array, and `input` is typed `Record<string, unknown>` precisely so the compiler will not let you forget. If the stored value is `{ recipeSlugs: 'soup' }` the answer is `[]`, not `['s','o','u','p']` - which is what `[...input.recipeSlugs]` alone would have produced, because strings are iterable. Input: `['soup','soup','missing',42,null]`. Output: the same array, now known to be an array.

**Step 2 - the type predicate.** `.filter((slug): slug is string => typeof slug === 'string' && ...)`. The `: slug is string` return annotation is not decoration: without it, `filter` returns `unknown[]` and the assignment to `string[]` fails to compile. It is how you tell TypeScript that a runtime check has narrowed a type - the manual version of what a schema library's `parse` does for you. The `typeof slug === 'string'` half drops `42` and `null`. Input: `['soup','soup','missing',42,null]`. Output after this half: `['soup','soup','missing']`.

**Step 3 - the membership check.** `recipes.some((recipe) => recipe.slug === slug)`, the second half of the same predicate. This is the one that turns *type* validation into *domain* validation: `'missing'` is a perfectly good string and still is not a recipe this cookbook has. Note that it is a lookup against trusted data, which is what makes the non-null assertion on line 15 (`recipes.find(...)!`) safe - every surviving slug has already been proven to exist. Input: `['soup','soup','missing']`. Output: `['soup','soup']`.

**Step 4 - the `Set` dedupe.** `[...new Set(...)]`. A duplicated slug would produce duplicate keys downstream and render the recipe twice. `Set` preserves insertion order, so the first occurrence wins and the list stays stable across reloads. Input: `['soup','soup']`. Output: `['soup']`.

Only then does line 15 build `validKeys` - `soup:0`, `soup:1`, ... one per ingredient of each *surviving* recipe - and lines 22-23 keep only the `checked` and `quantities` entries whose key is in that set **and** whose value has the right type. Read those two lines as the same four-step shape applied to objects instead of arrays: guard (`entries` returns `[]` for a non-object, line 16-19), key check (`validKeys.has(key)`), type check (`typeof v === 'boolean'` / `'string'`), bound (`v.length <= 100`).

If you were writing this on a server you would write it as a schema instead, and it is worth seeing the same rules in that form:

```typescript
// The Zod equivalent of lines 13-23. Same four steps, declared rather than coded.
const shoppingList = (slugs: string[]) => z.object({
  recipeSlugs: z.array(z.enum(slugs as [string, ...string[]])).catch([]),   // steps 1-3
  checked:    z.record(z.string(), z.boolean()).catch({}),
  quantities: z.record(z.string(), z.string().max(100)).catch({}),
}).catch({ recipeSlugs: [], checked: {}, quantities: {} });
```

Note what the schema library does *not* give you for free: the dedupe, and the cross-field rule that a `checked` key must refer to an ingredient index of a slug that survived. Those still need code. Hand-writing the normalizer first is why you can tell.

## Three variations to work through

Each is a one-line call to `normalizeShoppingState` with the cookbook fixture from [test/shopping-state.test.ts](../test/shopping-state.test.ts) (`soup`, one ingredient, `1 cup Water`). Predict the exact returned object before running it.

**Variation 1 - an override of the wrong type.** `normalizeShoppingState({ recipeSlugs: ['soup'], quantities: { 'soup:0': 0 } }, recipes)`. Predicted: `{ recipeSlugs: ['soup'], checked: {}, quantities: {} }`. The key is valid, so the naive implementation ("drop keys I do not recognise") keeps it; the type check at line 23 is what drops it. Ask what would happen downstream if it survived: `ingredientsWithQuantities` would put the number `0` where a string is expected, React would render `0`, and the clipboard formatter would concatenate it - a runtime type error in a TypeScript codebase, arriving from storage where the compiler cannot see. Now try `'soup:0': ''` instead and confirm it is **kept**: empty is a deliberate override meaning "I cleared this", which is exactly why line 29 uses `??` and not `||`.

**Variation 2 - a slug that exists but whose ingredient count shrank.** The cookbook used to ship `soup` with three ingredients and now ships two; the stored document still has `checked: {'soup:2': true}` and `quantities: {'soup:2': '3 bay leaves'}`. Predicted: the slug survives, `soup:0` and `soup:1` survive, and both `soup:2` entries are dropped - because `validKeys` (line 15) is rebuilt from *today's* ingredient array, not from the stored keys. This is a schema migration that needs no migration code, and it is the case test 4 pins. Then ask the harder question it exposes: if the cookbook *reordered* two ingredients instead of removing one, every index-based key would silently point at the wrong ingredient and nothing here would notice. That is the real limit of positional keys, and the last paragraph of the trace lab says what fixes it.

**Variation 3 - `checked` values as strings.** `normalizeShoppingState({ recipeSlugs: ['soup'], checked: { 'soup:0': 'true' } }, recipes)`. Predicted: `checked: {}`. The string `'true'` is truthy, so any implementation that wrote `if (v)` or `Boolean(v)` would accept it - and would also accept `'false'`, which is truthy too and would render the item as checked when the stored intent was the opposite. `typeof v === 'boolean'` is the only check that gets `'false'` right. Add it to the loop in test 3 and watch a `Boolean(v)` implementation pass every other case in the suite.

## Executable examples

These are the first three of the four regression tests in [test/shopping-state.test.ts](../test/shopping-state.test.ts); case 4 covers a cookbook that lost an ingredient after the document was stored. Read each test as arrange → act → assert. Setup creates a controlled initial state, the action exercises the application code, and assertions compare observable behavior with an independently stated expectation.

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeShoppingState, ingredientsWithQuantities } from '../src/store/shoppingState.ts';
const recipes: any[] = [{ slug: 'soup', ingredients: [{ quantity: '1 cup', item: 'Water', group: null }] }];
test('old storage upgrades without losing checked items; duplicates and unknown keys are removed', () => {
    const state = normalizeShoppingState({ recipeSlugs: ['soup', 'soup', 'missing'], checked: { 'soup:0': true, 'missing:0': true, 'soup:1': 'yes' } }, recipes);
    assert.deepEqual(state, { recipeSlugs: ['soup'], checked: { 'soup:0': true }, quantities: {} });
});
test('quantity overrides survive a serialization round trip and feed the displayed/copied ingredients', () => {
    const state = normalizeShoppingState(JSON.parse(JSON.stringify({ recipeSlugs: ['soup'], checked: {}, quantities: { 'soup:0': '2 1/2 cups' } })), recipes);
    assert.equal(ingredientsWithQuantities(recipes[0], state.quantities)[0].quantity, '2 1/2 cups');
    assert.equal(recipes[0].ingredients[0].quantity, '1 cup');
    assert.equal(ingredientsWithQuantities(recipes[0], { 'soup:0': '' })[0].quantity, '');
});
test('malformed storage and oversized or orphaned quantities cannot pollute state', () => {
    for (const input of [null, [], 3, { recipeSlugs: [{}], checked: [] }])
        assert.deepEqual(normalizeShoppingState(input, recipes), { recipeSlugs: [], checked: {}, quantities: {} });
    assert.deepEqual(normalizeShoppingState({ recipeSlugs: ['soup'], quantities: { 'soup:0': 'x'.repeat(101), 'soup:1': '2' } }, recipes).quantities, {});
});
test('a cookbook that lost an ingredient drops only the orphaned keys', () => {
    // The stored document was written when soup had three ingredients. It now has two.
    const shrunk: any[] = [{ slug: 'soup', ingredients: [{ quantity: '1 cup', item: 'Water', group: null }, { quantity: '1 tsp', item: 'Salt', group: null }] }];
    const stored = { recipeSlugs: ['soup'], checked: { 'soup:0': true, 'soup:1': false, 'soup:2': true }, quantities: { 'soup:1': '2 tsp', 'soup:2': '3 bay leaves' } };
    const state = normalizeShoppingState(stored, shrunk);
    assert.deepEqual(state, { recipeSlugs: ['soup'], checked: { 'soup:0': true, 'soup:1': false }, quantities: { 'soup:1': '2 tsp' } });
    assert.equal(ingredientsWithQuantities(shrunk[0], state.quantities)[1].quantity, '2 tsp');
    assert.equal(shrunk[0].ingredients[1].quantity, '1 tsp');
});
```

## Explain it back

Give a five-minute walkthrough: the original problem, one invariant, the exact changed function, the most revealing failure test, and one remaining limitation. You should be able to explain why the implementation is correct for the worked example without reading the code aloud line by line.
