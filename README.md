# Sarap & Ngon 🍲

A Filipino, Vietnamese, Thai & Spanish cookbook companion web app. It compiles
74 classic recipes from the web's best cooking sites and makes trying a new
recipe way less daunting:

- **Browse & search** all recipes, filtered by cuisine (Filipino / Vietnamese /
  Thai / Spanish) and category (mains, noodles, soups, rice, appetizers,
  desserts).
- **Every recipe links to the original** author's page for the full
  step-by-step instructions — the creators get the credit and the traffic.
- **Complete ingredient lists for shopping**, mirrored from each original
  recipe. Tap items to check them off in the store.
- **Combined shopping list**: add any number of recipes, shop them all in one
  trip, copy the whole list to your notes app, and your check-off progress is
  saved on your device.

Built with React 19 + TypeScript + Vite, no backend — the whole cookbook is a
static site.

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Build for production

```bash
npm run build     # tsc -b, then vite build → static site in dist/
npm run preview   # serve the production build locally
npm run lint      # oxlint
npm test          # tsx --test test/*.test.ts (4 tests for src/store/shoppingState.ts)
```

The build uses relative asset paths and hash-based routing, so `dist/` works on
any static host with zero configuration.

## Deploy

**Vercel** — `vercel.json` is included; just import the repo at
vercel.com/new (or run `npx vercel`). Framework preset: Vite.

**GitHub Pages** — a workflow is included at
`.github/workflows/deploy.yml`. Push the project to GitHub, then in the repo
settings set *Pages → Source → GitHub Actions*. Every push to `main` deploys.

**Anything else** (Netlify, Cloudflare Pages, an S3 bucket…) — build and
upload the `dist/` folder.

## Project structure

```
src/
  types.ts                      # Recipe / Ingredient types
  data/recipes.ts               # generated recipe data (74 recipes)
  store/ShoppingListContext.tsx # shopping list state + localStorage persistence
  store/shoppingState.ts        # pure normalizer for stored state + quantity overrides
  hooks/useCopy.ts              # clipboard copy with a transient "Copied!" flag
  components/                   # RecipeCard, IngredientChecklist
  pages/                        # Home (browse), Recipe detail, Shopping list
scripts/
  filipino.json, vietnamese.json,  # researched recipe source data
  thai.json, spanish.json          # (16 + 16 + 21 + 21 recipes)
  generate-recipes.mjs             # validates + regenerates src/data/recipes.ts
test/
  shopping-state.test.ts           # node:test suite run through tsx
```

The shopping list is stored under the `localStorage` key `recipeweb.shoppingList.v1` as `{ recipeSlugs, checked, quantities }` (`src/store/ShoppingListContext.tsx:32`). Every load goes through `normalizeShoppingState` (`src/store/shoppingState.ts:8-25`), which drops unknown slugs, duplicate slugs, non-boolean checks, and quantity overrides longer than 100 characters or pointing at an ingredient index that no longer exists. Ingredient checks and overrides are keyed by `slug:index` — the ingredient's **position** in its recipe — so reordering a recipe's ingredients in the JSON would move existing checks onto different items (see `docs/IMPROVE.md` §1).

## Known issues

- Quantity overrides are shown on the shopping-list page but **not** on the recipe page, whose checklist and "Copy ingredient list" button use the source quantities (`src/pages/RecipePage.tsx:75-80`, `:116`).
- `useCopy` shows "Copied!" even if both the Clipboard API and the `execCommand` fallback fail; the fallback's boolean result is ignored (`src/hooks/useCopy.ts:14-25`).
- `new URL(recipe.sourceUrl)` (`src/pages/RecipePage.tsx:29`) throws on a malformed URL, and the generator only checks that `sourceUrl` is non-empty (`scripts/generate-recipes.mjs:17-19`).
- Two open tabs do not see each other's changes (no `storage` event listener); the last tab to write wins.
- Internal store actions (`toggleChecked`, `addRecipe`, …) do not run the normalizer, so an invalid key written at runtime is persisted and only dropped on the next load.

## Adding recipes

Add an entry to `scripts/filipino.json`, `scripts/vietnamese.json`,
`scripts/thai.json`, or `scripts/spanish.json` (same shape as the existing
ones — including the source URL and the full ingredient list from the original
page), then run:

```bash
node scripts/generate-recipes.mjs
```

## Credits

All recipes belong to their original authors — Kawaling Pinoy, Panlasang
Pinoy, Foxy Folksy, Hungry Huy, Vicky Pham, RecipeTin Eats, Delightful Plate,
The Woks of Life, Hot Thai Kitchen, Thai Caliente, Spain on a Fork, Spanish
Sabores, and others. This app stores only ingredient lists and links; visit the
source pages for instructions and support the creators.

## Junior SWE learning course

[Start the detailed Astra upskilling course](astraupskill/README.md): React state ownership, storage validation and accessible controls, with a codebase map, worked implementation, executable examples, debugging labs, exercises and solution discussions.
