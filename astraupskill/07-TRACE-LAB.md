# Trace lab: overrides without rewriting the cookbook

[Course index](README.md)

## Separate source facts from user choices

The cookbook owns the source quantity. Shopping state owns a user's current override. A key combines recipe slug and ingredient index. For an illustrative key adobo:0:

Quantities remain bounded text: `2 1/2 cups`, `to taste` and `a pinch` are not one uniform numeric grammar. A servings multiplier needs an explicitly supported parsing rule; silently interpreting 1 1/2 as 1 would be wrong.

TypeScript does not validate JSON loaded from storage. The normalizer checks known recipes, ingredient keys, booleans and bounded text. Older saved state without overrides falls back to source quantities. Removing a recipe clears its overrides and checks (`ShoppingListContext.tsx:63-71`).

## The six boundaries of one quantity edit

A client-only React app crosses the same boundaries a CRUD request does - the "server" is `localStorage` and the "request" is a keystroke. Walk them with [shoppingState.ts](../src/store/shoppingState.ts) and [ShoppingListContext.tsx](../src/store/ShoppingListContext.tsx) open.

**1. The input surface - `IngredientChecklist.tsx:52-58`.** A real `<label className="quantity-control">` wrapping `<span>Quantity for {ing.item}</span>` and `<input type="text" maxLength={100}>`, so the control is named for assistive technology without an `aria-label` on a `<div>`. `maxLength` is a *convenience*, not a rule - it stops typing past 100 characters but does nothing about a pasted value in an older browser, a programmatic set, or a document already in storage. The value shown is `ing.quantity`, which is the already-resolved effective quantity, not the source: the field is a view of derived state.

**2. The client-side action - `setQuantity`, `ShoppingListContext.tsx:99-102`.** `onChange` calls it with the composite key and the raw string. It rejects over-100 input again (line 100) - the same rule as the DOM attribute and as line 23 of the normalizer, stated three times in three places. Decide for yourself whether that is defence in depth or a rule with no single owner; the argument for keeping it here is that this is the only layer that can refuse *without* discarding what the user typed.

**3. The normalization boundary - `normalizeShoppingState`, `shoppingState.ts:8-25`.** This is the layer the whole course is about, and its placement is the surprising part: `setQuantity` runs the *entire* state through it on every keystroke (`ShoppingListContext.tsx:101`), not just on load. So the same function that sanitizes a hostile stored document also enforces the invariant on ordinary user input, and there is exactly one definition of "a valid shopping list" in the codebase. That is why it must be pure and fast, and why it takes `recipes` as a parameter instead of importing them - it is testable without mounting React, which is what makes the four test cases possible.

**4. The store's published state - `useState` in `ShoppingListProvider`, `ShoppingListContext.tsx:43`.** `useState(loadState)` - the function form, so the normalizer runs once at mount rather than on every render. Everything downstream reads this one object. Note `loadState` (`:34-38`): `JSON.parse` is wrapped in a `try` and the `catch` calls `normalizeShoppingState(null, RECIPES)` rather than returning a literal, so a corrupt document and an absent document produce the same value by the same code path.

**5. The persistence boundary - the `useEffect` at `ShoppingListContext.tsx:46-53`.** One `localStorage.setItem` of the whole state, triggered by a state change rather than by a handler. The ordering here is the opposite of the localStorage projects earlier in this batch and deliberately so: React has already published the new state, so persistence *cannot* come first. What the code does instead is disclose - `setStorageError(true)` on a throw, with the comment "Keep the current session usable; disclose persistence failure." Nothing is rolled back, and the UI says so. Compare with `JS1/task-board`'s `commitBoard`, which persists first and refuses to publish; then say which is right here, and why "the user keeps typing and we tell them it is not being saved" beats "the character you just typed disappears".

**6. The two outputs - `ShoppingListPage.tsx:13` and `:89`.** The screen and the clipboard both call `ingredientsWithQuantities(recipe, quantities)` (`shoppingState.ts:27-31`). That is the second half of the change and the reason it matters: two consumers, one resolution function, so the copied text cannot drift from the displayed list. The resolution itself is one line - `quantities[key] ?? ingredient.quantity` - and the operator choice is load-bearing.

```typescript
const source = '1 cup';
const overrides: Record<string, string> = { 'adobo:0': '' };
const key = 'adobo:0';
const quantity = Object.hasOwn(overrides, key) ? overrides[key] : source;
```

The empty override intentionally clears the quantity. Using `overrides[key] || source` would incorrectly restore the original; `??` gets it right because `''` is not nullish. Use a real source slug when running the app.

Now trace backwards from a change nobody made in this codebase: the cookbook gains an ingredient in the middle of `soup`. Which layers notice? Layer 3 rebuilds `validKeys` from today's ingredients, so nothing is *dropped* - and nothing is corrected either. Every override from index 1 onwards now names a different ingredient than the user meant, and layers 4, 5 and 6 will faithfully display, persist and copy the wrong thing. No test fails. That is the cost of positional keys, spelled out below.

## Verify the visible contract

Add a recipe, keyboard-edit its quantity, reload and copy the list. Screen and clipboard should agree; the source recipe should retain its original quantity. This app uses hash routing, so the shopping route ends in `/#/shopping-list`.

Ingredient indices are convenient for this static cookbook. A remotely edited cookbook that reorders ingredients would need stable ingredient ids and a saved-data migration policy.
