# 01 — Onboarding: Running the App and Touring the Code

Goal: by the end of this doc you can run the app locally, you know what every
file does, and you can trace a piece of data from a JSON file to a pixel on
screen.

## 1. Get it running

You need [Node.js](https://nodejs.org) (`node --version` to check). Use Node 22: it is what the deploy workflow installs (`.github/workflows/deploy.yml`), and `npm test` relies on Node's own test runner expanding the `test/*.test.ts` glob, which older Node versions do not do.

```bash
npm install     # downloads dependencies into node_modules/ (one time)
npm run dev     # starts a dev server, usually http://localhost:5173
```

Open the URL. You should see the cookbook. Leave this running — every file
you save will instantly refresh the browser (this is Vite's "hot module
replacement").

Other commands you'll use:

```bash
npm run build     # type-checks everything, then produces dist/ for deployment
npm run preview   # serves the production build locally (http://localhost:4173)
npm run lint      # runs oxlint, a fast linter that catches common mistakes
npm test          # runs test/shopping-state.test.ts with node:test via tsx
node scripts/generate-recipes.mjs   # regenerates recipe data (explained below)
```

**Habit to build now:** run `npm run build` before you consider any change
"done". The dev server is forgiving; the build is not. The build runs the
TypeScript compiler (`tsc`) across the whole project and fails on any type
error.

## 2. The map

```
recipeweb/
├── index.html                  ← the single HTML page (this is an "SPA")
├── package.json                ← project manifest: dependencies + npm scripts
├── vite.config.ts              ← build tool config (tiny, but read the comment in it)
├── tsconfig*.json              ← TypeScript compiler settings
├── vercel.json                 ← config for deploying to Vercel
├── .github/workflows/deploy.yml← GitHub Actions: auto-deploy on push to main
├── .oxlintrc.json              ← linter rules
│
├── public/                     ← static files copied verbatim into the build
│   └── bowl.svg                ← the favicon
│
├── scripts/                    ← the DATA PIPELINE (runs at dev time, not in browser)
│   ├── filipino.json           ← 16 recipes, hand-researched
│   ├── vietnamese.json         ← 16 recipes
│   ├── thai.json               ← 21 recipes
│   ├── spanish.json            ← 21 recipes
│   └── generate-recipes.mjs    ← validates + merges the JSON into src/data/recipes.ts
│
└── src/                        ← everything the browser runs
    ├── main.tsx                ← entry point: mounts React onto index.html
    ├── App.tsx                 ← top-level layout: header, routes, footer
    ├── index.css               ← ALL styling for the whole app (plain CSS)
    ├── types.ts                ← the data shapes (Recipe, Ingredient, Cuisine…)
    ├── data/recipes.ts         ← GENERATED. 74 recipes as TypeScript. Never edit by hand.
    ├── store/
    │   ├── ShoppingListContext.tsx  ← shopping list state + localStorage persistence
    │   └── shoppingState.ts         ← pure normalizer for stored state + quantity overrides
    ├── hooks/
    │   └── useCopy.ts          ← reusable "copy to clipboard" logic
    ├── components/
    │   ├── RecipeCard.tsx      ← one card in the browse grid
    │   └── IngredientChecklist.tsx  ← the checkable ingredient list
    └── pages/
        ├── HomePage.tsx        ← browse / search / filter
        ├── RecipePage.tsx      ← one recipe's detail view
        └── ShoppingListPage.tsx← the combined shopping list

test/
└── shopping-state.test.ts      ← 4 node:test cases for src/store/shoppingState.ts
```

Eleven hand-written source files (plus the generated `data/recipes.ts`) and one test file. You can read all of them in an afternoon. Do that — this
doc tells you what to look for in each.

## 3. Trace the data: from JSON to pixel

This is the most important mental exercise in onboarding. Follow one recipe —
say, *Pad Thai* — all the way through the system.

**Step 1 — it starts as JSON.** Open `scripts/thai.json` and find the object
with `"slug": "authentic-pad-thai"`. This is the *source of truth*. A human
researched this from the original recipe site and typed it in following the
shape that every recipe uses: slug, name, cuisine, category, ingredients
(each with an optional `group`, a `quantity`, and an `item`), and so on.

**Step 2 — the generator turns it into TypeScript.** Open
`scripts/generate-recipes.mjs`. Read it top to bottom — it's ~45 lines. It:

1. Reads the four JSON files.
2. Merges them into one array.
3. Validates every recipe: required fields present? slug unique? at least
   one ingredient? (If not, it throws — the build stops.)
4. Normalizes: `quantity: null` becomes `''`, stray `&amp;` becomes `&`.
5. Writes the array into `src/data/recipes.ts` as a typed constant.

Run it yourself: `node scripts/generate-recipes.mjs`. It prints
`Wrote 74 recipes (…)`. Now open `src/data/recipes.ts` and look at the first
line: it declares `export const RECIPES: Recipe[] = […]`. Because the
generated file is *typed*, the TypeScript compiler re-validates every recipe
against the `Recipe` interface on every build. Two layers of validation, for
free.

**Step 3 — types define the contract.** Open `src/types.ts`. This file is
the vocabulary of the whole app. `Cuisine` can only be one of four exact
strings. `Recipe` says exactly which fields exist and which can be `null`.
Every other file imports from here. When you extend the app (say, adding a
fifth cuisine), you start here — and the compiler then points at every other
place that needs updating.

**Step 4 — pages render it.** Open `src/pages/HomePage.tsx`. It imports
`RECIPES`, filters it based on the user's chosen cuisine/category/search
text, and renders a `<RecipeCard>` for each match. No fetching, no loading
spinners — the data was baked into the JavaScript bundle at build time.

**Step 5 — interaction state lives in the store.** Click "+ Shopping list"
on a card. That calls `toggleRecipe(slug)` from
`src/store/ShoppingListContext.tsx`, which updates React state *and* writes
it to `localStorage` (so it survives a page refresh). The header badge, the
card button, and the shopping list page all read from this one shared store.

That's the entire system. Data flows one way:

```
scripts/*.json → generate-recipes.mjs → src/data/recipes.ts → pages/components → screen
                                                     user clicks ↓
                                        ShoppingListContext ←→ localStorage
```

## 4. Your first-day tasks

Do these now, in order. Each takes minutes and proves your setup works.

1. **Change something visible.** In `src/App.tsx`, find the `brand-sub`
   line and add an exclamation mark. Watch the browser hot-reload. Revert it.
2. **Break the types on purpose.** In `src/pages/RecipePage.tsx`, change
   `recipe.name` to `recipe.namee`. Look at the red squiggle in your editor,
   then run `npm run build` and read the error. This is what a type error
   looks like — you'll see hundreds of these, and they're your friend.
   Revert it.
3. **Add a recipe.** Pick a simple dish you like from a real cooking site.
   Add an entry to the matching cuisine JSON file (copy an existing object
   as a template — mind the commas), run
   `node scripts/generate-recipes.mjs`, and find your dish in the app.
   Delete the `slug` field first and run the generator to see the validation
   fail — then put it back.
4. **Read the CSS.** Open `src/index.css` and find `.recipe-card`. Change
   `--accent` at the top of the file to `#2e7d4f` and watch the whole app
   re-theme. This is what CSS custom properties (variables) buy you. Revert.

## 5. Vocabulary you'll hear

- **SPA (single-page app):** the server sends one HTML file; JavaScript
  renders everything and swaps "pages" without real page loads. That's why
  `index.html` is nearly empty.
- **Static site:** no server-side code at all. The build output (`dist/`) is
  plain files any web host can serve.
- **Hash routing:** our URLs look like `/#/recipe/pad-thai`. The part after
  `#` never gets sent to the server, so any static host works without
  configuration. (Tradeoff discussion in 02-ARCHITECTURE.md.)
- **Codegen (code generation):** writing a program that writes code —
  our `generate-recipes.mjs` generating `recipes.ts`.
- **Hot reload / HMR:** Vite pushing your saved changes into the running
  browser page without a refresh.

Next: [02-ARCHITECTURE.md](02-ARCHITECTURE.md) — the *why* behind all of this.
