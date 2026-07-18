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
npm run build     # outputs a static site to dist/
npm run preview   # serve the production build locally
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
  components/                   # RecipeCard, IngredientChecklist
  pages/                        # Home (browse), Recipe detail, Shopping list
scripts/
  filipino.json, vietnamese.json,  # researched recipe source data
  thai.json, spanish.json          # (one file per cuisine)
  generate-recipes.mjs             # regenerates src/data/recipes.ts
```

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
