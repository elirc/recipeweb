# Implementation Plan: Add Thai & Spanish Recipe Sections

**Handoff target:** Claude Opus 4.8
**Project:** `recipeweb` — "Sarap & Ngon" Filipino/Vietnamese cookbook companion (Vite + React 19 + TypeScript)
**Goal:** Extend the cookbook from 2 cuisines (32 recipes) to 4 cuisines (~64 recipes) by adding Thai and Spanish sections, keeping the existing architecture intact.

---

## Context: how the app works today

- All recipe data is static, typed, and generated. Researched recipes live as JSON in `scripts/filipino.json` and `scripts/vietnamese.json`; `scripts/generate-recipes.mjs` validates and merges them into `src/data/recipes.ts` (typed `Recipe[]`).
- `src/types.ts` defines `Cuisine` (currently `'filipino' | 'vietnamese'`), `Category`, `Recipe`, and label maps.
- UI: `HomePage` (search + cuisine/category filter chips + card grid), `RecipePage` (ingredient checklist, link to original source), `ShoppingListPage` (multi-recipe combined list, persisted in localStorage). Shopping-list state keys on recipe `slug`, so new recipes work automatically.
- **Design principle to preserve:** the app never copies recipe instructions — only complete ingredient lists (for shopping) plus a link to the original author's page. Keep it that way for the new cuisines.

## Phase 1 — Research & compile recipe data (largest phase)

Research ~16 Thai and ~16 Spanish recipes from reputable sites, matching the existing category spread (`main`, `noodles`, `soup`, `rice`, `appetizer`, `dessert` — note Spanish cuisine has no noodle tradition; substitute more mains/rice/tapas, the `noodles` category may be empty for Spanish and that's fine).

- Suggested Thai coverage: pad thai, pad see ew, green/red/massaman curry, tom yum goong, tom kha gai, khao soi, larb, som tum, satay, thai basil chicken (pad krapow), mango sticky rice, thai fried rice, spring rolls, thai iced tea. Sources: Hot Thai Kitchen, RecipeTin Eats, The Woks of Life, Serious Eats.
- Suggested Spanish coverage: paella valenciana/de mariscos, tortilla española, gazpacho, salmorejo, patatas bravas, gambas al ajillo, croquetas, albondigas, pollo al ajillo, pisto, fabada, churros con chocolate, crema catalana, flan, pan con tomate. Sources: Spain on a Fork, Spanish Sabores, RecipeTin Eats, Serious Eats.
- **Hard requirements (same bar as existing data):** for every recipe, WebFetch the actual page to verify the URL loads; extract the COMPLETE ingredient list with quantities, preserving ingredient groups (e.g. "For the sofrito"); never invent URLs; swap sources if a page fails to fetch. Parallel research subagents (one per cuisine) worked well last time — return raw JSON matching the schema below.
- Output: `scripts/thai.json` and `scripts/spanish.json`, same shape as the existing files:
  `{ slug, name, nativeName, cuisine: "thai" | "spanish", category, description, sourceName, sourceUrl, servings, prepTime, cookTime, difficulty, ingredients: [{group, quantity, item}], tags }`
- Watch for: duplicate slugs across all four files; `&amp;` HTML entities in fetched text (the generator normalizes these, but check); native names should use proper diacritics (Thai script optional — romanized is fine; Spanish names often equal the English name, use `null` then).

## Phase 2 — Type & data-pipeline changes (small, mechanical)

1. `src/types.ts`: extend `Cuisine` to `'filipino' | 'vietnamese' | 'thai' | 'spanish'`; add entries to `CUISINE_LABELS`.
2. `scripts/generate-recipes.mjs`: read the two new JSON files and include them in the merge (keep the existing validation: required fields, unique slugs, non-empty ingredients).
3. Run `node scripts/generate-recipes.mjs` → regenerates `src/data/recipes.ts`. TypeScript will now flag any UI spot that hardcodes cuisines — fix those (Phase 3).

## Phase 3 — UI changes

1. **HomePage cuisine chips** (`src/pages/HomePage.tsx`): the chip row currently hardcodes `(['all', 'filipino', 'vietnamese'] as const)`. Refactor to derive from `CUISINE_LABELS` (`['all', ...Object.keys(CUISINE_LABELS)]`) so future cuisines are automatic.
2. **CSS** (`src/index.css`): add `.cuisine-tag.thai` and `.cuisine-tag.spanish` color pairs consistent with the existing pattern (filipino = gold on gold-soft, vietnamese = green on green-soft). Suggest thai = a warm chili/orange pair, spanish = a terracotta/red-ochre pair — define new `--thai`/`--thai-soft`, `--spanish`/`--spanish-soft` variables. The `.chip.selected.thai/.spanish` selectors also need adding (or simplify: one `.chip.selected` accent rule for all cuisines).
3. **Copy/branding sweep:** hero paragraph, header `brand-sub` ("Filipino · Vietnamese"), `index.html` `<title>`/meta description, footer, and README all name the two cuisines. Update to reflect four (or generalize the wording). Optionally extend the brand name playfully ("Sarap & Ngon & Aroi & Rico") — or leave the name and just update subtitles; use judgment, keep it tasteful.
4. No changes needed to `RecipePage`, `ShoppingListPage`, `RecipeCard`, or `ShoppingListContext` — they're cuisine-agnostic.

## Phase 4 — Verification

1. `npm run build` must pass clean (tsc + vite).
2. Regeneration check: `node scripts/generate-recipes.mjs` reports ~64 recipes with correct per-cuisine counts.
3. Headless-browser smoke test (Playwright, chromium is preinstalled at `/opt/pw-browsers/chromium`): load home page, confirm 4 cuisine chips, filter by Thai and by Spanish, open one recipe from each, verify the source link href and ingredient checklist render, add to shopping list, check the combined list. Screenshot each state and review.
4. Spot-check 3–4 random new `sourceUrl`s actually resolve.
5. Update README recipe count, structure notes, and credits (add the new source sites).

## Constraints & non-goals

- Don't restructure the app (no routing changes, no backend, no CMS).
- Don't copy cooking instructions from source pages — ingredient lists + links only, per the app's credits policy.
- Keep bundle static; recipe data stays compiled into the app.
- Existing users' localStorage shopping lists must keep working (don't rename existing slugs or the storage key `recipeweb.shoppingList.v1`).

**Estimated effort split:** ~70% research/data quality, ~10% code, ~20% verification.
