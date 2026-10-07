# Testing and debugging

[Course index](README.md)

## Run the checks

Run `npm install` and `npm run dev` from this project folder. Run `npm test` for its automated checks and `npm run build` for the production build.

```text
npm test
```

## What the test suite proves

Read [test/shopping-state.test.ts](../test/shopping-state.test.ts). The suite targets **React state ownership, storage validation and accessible controls** and uses the worked fixture:

The source ingredient says "1 cup". Change it to "2 1/2 cups" in the shopping list. Reload and copy the list: both still say "2 1/2 cups". The source recipe continues to say "1 cup". Remove the recipe and its override disappears.

Case 4 covers the schema-migration case the design implies: a document stored when `soup` had three ingredients, loaded against a cookbook where it now has two. `soup:0` and `soup:1` survive with their values, both `soup:2` entries are dropped, and the surviving override still reaches `ingredientsWithQuantities` while the source recipe is untouched. No migration code runs — `validKeys` (`shoppingState.ts:15`) is rebuilt from today's ingredient list, which is what makes the normalizer a migration in itself.

The expectation should not be copied from the function being tested. Hand-calculate counts, amounts, identities or elapsed time first. Otherwise the same mistake can appear in both implementation and expected result. Tests that exercise only a mocked dependency prove a narrower contract than tests against the real dependency; read the helper to understand which kind you are running.

This project has no plain app.js: its pure tests verify the state helpers' data behavior directly, and the component and browser checks verify that the controls call those helpers correctly. A real browser check is still useful for layout, focus visibility and native interaction.

## Debugging workflow

1. Reproduce the smallest failing case with the exact input saved in your notes.
2. Inspect the relevant event/request. Confirm the intended handler actually ran.
3. Pause at `normalizeShoppingState` and inspect input types as well as values.
4. Follow validation branches, noting whether any state or persistence changed before rejection.
5. Inspect the write result and the subsequent render/response. Separate storage correctness from display correctness.
6. Add a regression reproducing the failure, make the smallest justified fix, then run the focused suite and relevant broader checks.

Avoid changing several layers at once when you do not yet know where the failure starts. A correct backend with a stale UI needs a different fix from a malformed query or an invalid saved document.

## Failure experiments

- Reuse the invalid fixture from the tests and verify no unintended records or fields change.
- Reload or restart after a successful operation to distinguish persistence from temporary screen state.
- Repeat the operation and explain whether it should be idempotent, rejected or intentionally create another record.
- Simulate the relevant timing or storage failure only in a disposable fixture. Restore normal behavior after the experiment.

## Reading an assertion failure

“Expected 3, received 4” is evidence about one observation, not a complete diagnosis. Ask whether the fixture created an extra record, the operation ran twice, an old record survived, or the assertion looked at an unfiltered collection. Start from the state table and trace the first point where the actual value diverges. A stack trace identifies where the program noticed a problem, which may be later than the code that caused it.

## What the suite does not cover

The four tests in `test/shopping-state.test.ts` exercise only `normalizeShoppingState` and `ingredientsWithQuantities`. Nothing tests: the React store actions in `src/store/ShoppingListContext.tsx` (add/remove/toggle, the persistence effect and `storageError`), the grouping logic and `ingredientsToText` in `src/components/IngredientChecklist.tsx:17-25`, `:70-81`, the search/filter in `src/pages/HomePage.tsx:18-38`, the clipboard fallback in `src/hooks/useCopy.ts`, or the generator's validation in `scripts/generate-recipes.mjs`. There is no component-test runner in `package.json`.

**Goal:** add the cheapest missing test. **Check:** a new case asserts `ingredientsToText('Soup', [{group:'Broth',quantity:'1 cup',item:'water'},{group:null,quantity:'',item:'salt'}])` equals `'SOUP\n\nBroth:\n- 1 cup water\n- salt'` and passes under `npm test` — then work out by reading `IngredientChecklist.tsx:73-79` why the ungrouped `salt` line gets no heading.

## Verification record

The companion [VERIFICATION.md](VERIFICATION.md) records checks actually run for this implementation. Record your own command, date, result and any environmental prerequisite when practicing. A passing test does not imply every route, browser, dependency version or production deployment has been exercised.
