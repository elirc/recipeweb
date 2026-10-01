# Solutions and engineering review

[Course index](README.md) · [Practice prompts](05-PRACTICE.md)

Attempt each exercise before using these notes. These are solution approaches and review criteria, not claims that every extension has been implemented. The actual completed behavior is described in the worked-change chapter.

## Existing implementation

Shoppers can edit quantities using labeled keyboard-accessible controls. Overrides persist, removal cleans up stale keys, and copied text uses the same effective quantities as the screen. Old saved selections/checkmarks are retained and malformed keys are removed.

The key model is: Shopping state contains recipeSlugs, checked and quantities. Quantity overrides are strings keyed by slug:index. An absent override uses the source recipe quantity; an explicit empty string means the shopper intentionally removed the quantity text.

The worked fixture should behave as follows: The source ingredient says "1 cup". Change it to "2 1/2 cups" in the shopping list. Reload and copy the list: both still say "2 1/2 cups". The source recipe continues to say "1 cup". Remove the recipe and its override disappears.

## Extension solutions

### Exercise 1

**Prompt:** Add a reset-to-recipe-quantity button beside each override.

**Approach:** The store needs a *third* operation. It currently has "set an override" and nothing else; `setQuantity(key, '')` means "the user cleared this field", which is not the same as "use the recipe's quantity".

```tsx
// ShoppingListContext.tsx - alongside setQuantity
const resetQuantity = useCallback((key: string) => {
  setState((s) => {
    const { [key]: _removed, ...rest } = s.quantities;   // delete the key, do not blank it
    return normalizeShoppingState({ ...s, quantities: rest }, RECIPES);
  });
}, []);
```

```tsx
// IngredientChecklist.tsx, inside the existing <label className="quantity-control">
{onResetQuantity && Object.hasOwn(quantities, key) && (
  <button type="button" className="reset-quantity"
          onClick={() => onResetQuantity(key)}>
    Reset <span className="visually-hidden">quantity for {ing.item} to the recipe amount</span>
  </button>
)}
```

The button renders only when an override actually exists, which is why the component needs the raw `quantities` record and not just the resolved ingredients.

**Review:** The ordinary case is: override `1 cup` to `2 cups`, press Reset, the field reads `1 cup` again, and `state.quantities` no longer has the key at all - assert the absence (`assert.equal(Object.hasOwn(state.quantities, 'soup:0'), false)`), not the displayed value, because a blank-string implementation shows the same screen while storing something different. The implementation that breaks is `setQuantity(key, '')`: it passes any test that reads the input, then reveals itself after a reload, where `?? ` at `shoppingState.ts:29` correctly honours the empty override and the ingredient shows *no* quantity at all. Demonstrate that round trip - it is the same `??`-versus-`||` distinction the trace lab makes, seen from the other side. The invariant that remains unchanged: absence means fallback, presence means override, including presence of an empty string; `resetQuantity` is the only operation that can move a key from present to absent, and removing a recipe (`ShoppingListContext.tsx:63-71`) is the only other thing that deletes keys.

### Exercise 2

**Prompt:** Add a recipe-level servings multiplier only for an explicitly supported numeric format.

**Approach:** Parse into an explicit, deliberately small grammar; return `null` for anything outside it; multiply only what parsed; and show the user exactly which lines were left alone.

```typescript
// Supported: "2", "1/2", "2 1/2", each optionally followed by a unit word. Nothing else.
const QUANTITY = /^(\d+)?(?:\s*(\d+)\/(\d+))?(?:\s+(.+))?$/;

export function parseQuantity(text: string): { value: number; unit: string } | null {
  const match = QUANTITY.exec(text.trim());
  if (!match) return null;
  const [, whole, numerator, denominator, unit] = match;
  if (!whole && !numerator) return null;                       // "to taste", "a pinch"
  if (denominator && Number(denominator) === 0) return null;
  const value = (whole ? Number(whole) : 0)
              + (numerator ? Number(numerator) / Number(denominator) : 0);
  return Number.isFinite(value) && value > 0 ? { value, unit: unit ?? '' } : null;
}

export function scaleQuantity(text: string, factor: number): string | null {
  const parsed = parseQuantity(text);
  if (!parsed) return null;                                     // caller must handle this
  const scaled = parsed.value * factor;
  const rounded = Math.round(scaled * 100) / 100;
  return `${rounded}${parsed.unit ? ' ' + parsed.unit : ''}`;
}
```

Scaling then writes overrides through the existing `setQuantity`, and every ingredient that returned `null` is listed in a notice: "3 ingredients were left unchanged because their amounts are not numeric: to taste, a pinch, 1 package."

**Review:** The ordinary case is `2 1/2 cups` at factor 2 becoming `5 cups`. Three implementations break and each is worth demonstrating. `parseFloat('2 1/2 cups')` returns `2` - the fraction is silently dropped and the shopper buys 4 cups instead of 5; assert `parseQuantity('2 1/2 cups').value === 2.5`. `eval`-style or `Number(text.replace(...))` handling of `1/2` looks clever until `1-2 cups` (a range) or `1,5` (a decimal comma) arrives. And scaling *without* returning `null` - defaulting to 1, or leaving the string untouched with no message - produces a shopping list that is silently wrong for exactly the ingredients the user cannot check by eye. The invariant that remains unchanged, and the one this exercise is really about: the source recipe is never modified. Scaling writes overrides only, so setting the factor back to 1 must be reversible - assert `recipes[0].ingredients[0].quantity === '1 cup'` after scaling, exactly as test 2 does.

### Exercise 3

**Prompt:** Test removal and re-adding a recipe without resurrecting its old checkmarks.

**Approach:** The behaviour already exists (`ShoppingListContext.tsx:63-71` and the `toggleRecipe` branch at `:77-85`); the deliverable is the test that pins it, written against the pure function so it needs no React.

```typescript
test('removing a recipe and re-adding it does not resurrect checks or overrides', () => {
    // Simulate what removeRecipe does, then normalize as the store would.
    const stripped = (state: any, slug: string) => normalizeShoppingState({
        recipeSlugs: state.recipeSlugs.filter((s: string) => s !== slug),
        checked: Object.fromEntries(Object.entries(state.checked).filter(([k]) => !k.startsWith(`${slug}:`))),
        quantities: Object.fromEntries(Object.entries(state.quantities).filter(([k]) => !k.startsWith(`${slug}:`))),
    }, recipes);

    const withEdits = normalizeShoppingState(
        { recipeSlugs: ['soup'], checked: { 'soup:0': true }, quantities: { 'soup:0': '9 cups' } }, recipes);
    const removed = stripped(withEdits, 'soup');
    assert.deepEqual(removed, { recipeSlugs: [], checked: {}, quantities: {} });

    const readded = normalizeShoppingState({ ...removed, recipeSlugs: ['soup'] }, recipes);
    assert.deepEqual(readded.checked, {});
    assert.deepEqual(readded.quantities, {});
    assert.equal(ingredientsWithQuantities(recipes[0], readded.quantities)[0].quantity, '1 cup');
});
```

**Review:** The ordinary case is the round trip above. The implementation that breaks is the obvious one-liner - `recipeSlugs: s.recipeSlugs.filter(x => x !== slug)` and nothing else - and the interesting part is *why it looks like it works*: `normalizeShoppingState` drops orphaned keys on the next call, so the screen is correct immediately and the bug only appears if the recipe is re-added **before** the next normalization, or if the orphaned keys are persisted and something else reads the raw document. Demonstrate it by skipping the `checked`/`quantities` filtering in `stripped` and asserting `readded.checked` - the stale `soup:0` comes straight back, because once the slug is valid again so is its key. That is the general hazard with derived validity: a key is not invalid *forever*, only while its parent is absent. The invariant that remains unchanged: `validKeys` (`shoppingState.ts:15`) is rebuilt from the current recipe list on every call, so the normalizer is a safety net and not a substitute for deleting the data you meant to delete.

### Exercise 4

**Prompt:** Add cross-tab synchronization with a stated conflict policy.

**Approach:** The `storage` event fires in *other* tabs after a write has already landed, so this is detection, never prevention. Write the policy down before the code.

Policy chosen here: **the other tab's document wins for recipe selection and checkmarks; a quantity field the user is currently focused on is not overwritten until they blur.** That is a deliberate, narrow exception, not a merge algorithm.

```tsx
const [focusedKey, setFocusedKey] = useState<string | null>(null);   // set from the input's onFocus/onBlur

useEffect(() => {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    if (event.newValue === null) { setState(normalizeShoppingState(null, RECIPES)); return; }
    let incoming: ShoppingListState;
    try { incoming = normalizeShoppingState(JSON.parse(event.newValue), RECIPES); }
    catch { return; }                      // another tab wrote something unparseable: ignore it
    setState((s) => focusedKey && Object.hasOwn(s.quantities, focusedKey)
      ? { ...incoming, quantities: { ...incoming.quantities, [focusedKey]: s.quantities[focusedKey] } }
      : incoming);
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}, [focusedKey]);
```

**Review:** The ordinary case is two tabs where tab A adds a recipe and tab B's list grows without a reload. Two implementations break. The first calls `setState(JSON.parse(event.newValue))` directly: the payload came from another *origin-sharing page*, not from your code, so it is exactly as untrusted as the stored document - skip `normalizeShoppingState` and you have re-opened the hole the whole change closed, and no existing test covers it because no existing test goes through this path. The second writes the incoming state back to storage inside the handler, which re-fires the event in the first tab and gives you a loop; the `useEffect` at `ShoppingListContext.tsx:46-53` already persists on every state change, so the write is automatic and you must reason about whether echoing it is harmful. Demonstrate the focused-field exception by typing in tab B while tab A removes a recipe - the honest answer is that the exception cannot save an override whose *recipe* disappeared, and the policy should say so. The invariant that remains unchanged: every path into `setState` goes through `normalizeShoppingState` - `loadState`, `setQuantity` and now the storage listener - so there is still exactly one definition of a valid shopping list.

## Review questions with answer guidance

**Why not trust input just because it came from this UI?** A caller can bypass the UI, a saved file can be edited, and older data can have a different shape. Validate at the boundary that owns the operation.

**Why keep the id stable?** It identifies the same domain record across views and edits. Changing it can create duplicates, disconnect child records or make reconciliation impossible.

**What makes the failure test meaningful?** It observes the promised state invariant. For this project, explain exactly why the failing scenario in [test/shopping-state.test.ts](../test/shopping-state.test.ts) would detect the original or a plausible regression.

**What does the test not prove?** A bounded suite does not prove all concurrency, browsers, deployment configurations or unrelated domain behavior. Name the real limitation from this lesson instead of adding a generic disclaimer.

**When should you extract a helper?** When it isolates a coherent responsibility, makes an invariant clearer or enables a meaningful test without duplicating application logic. A pure validator and a shared persistence boundary are common examples, but do not abstract solely to increase the number of files.

## A sample change explanation

“The previous behavior was: The shopping list persisted recipe selection and checkmarks, but quantities came only from recipe data and could not be adjusted. Storage checking was shallow. I changed the implementation so that: Shoppers can edit quantities using labeled keyboard-accessible controls. Overrides persist, removal cleans up stale keys, and copied text uses the same effective quantities as the screen. Old saved selections/checkmarks are retained and malformed keys are removed. The strongest evidence is the regression that exercises the worked fixture and checks authoritative state. A remaining design question is the final stretch exercise.”

Replace that explanation with your own words and actual test results. A strong junior engineer can connect a concrete user problem to code, verification and a clearly stated limit. Completing that explanation independently is the final checkpoint for this course.
