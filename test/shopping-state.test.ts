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
