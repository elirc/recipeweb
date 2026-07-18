# 03 — Data Model

The schema is where this rewrite earns its keep: two of the React app's
worst debts (IMPROVE.md #1 ingredient identity, #9 no migration story) are
*modeling* problems, and they get fixed here, on paper, before any code.

## Entities

```
Cuisine (reference data)          Category (reference data)
  Id        int PK                  Id        int PK
  Slug      "thai" (unique)         Slug      "noodles" (unique)
  Label     "Thai"                  Label     "Noodles"
  ColorHex  "#d35400"               SortOrder int
  SoftHex   "#fdeee1"
  SortOrder int

Recipe
  Id           int PK
  Slug         string, unique index   ← public URL identity, never changes (PRD N5)
  Name         string
  NativeName   string?
  CuisineId    FK → Cuisine
  CategoryId   FK → Category
  Description  string
  SourceName   string
  SourceUrl    string (validated absolute http/https on import)
  Servings     int?
  PrepMinutes  int?                   ← number, not "15 min" (fixes IMPROVE.md #8)
  CookMinutes  int?
  Difficulty   enum Difficulty { Easy=1, Medium=2, Hard=3 }
  IsRetired    bool                   ← soft delete; see "removal" below (PRD OQ2)

Ingredient
  Id           int PK                 ← THE fix for IMPROVE.md #1: durable identity
  RecipeId     FK → Recipe (cascade delete)
  GroupName    string?                ← "Marinade", "Peanut Sauce", null if ungrouped
  Quantity     string                 ← stays free-text: "1½ cup", "to taste" (honest)
  Item         string
  SortOrder    int                    ← display order, explicitly not identity
  ContentKey   string, computed       ← stable hash for import matching; see below

Tag                         RecipeTag (join table)
  Id    int PK                RecipeId  FK ↘ composite PK
  Name  string, unique        TagId     FK ↗

Shopper                              ← anonymous identity (Architecture Decision 4)
  Id         int PK
  Token      GUID, unique index      ← value in the HttpOnly cookie
  CreatedAt  DateTimeOffset
  LastSeenAt DateTimeOffset          ← enables eventual pruning of dead shoppers

ShoppingListEntry                    IngredientCheck
  Id         int PK                    Id           int PK
  ShopperId  FK → Shopper              ShopperId    FK → Shopper
  RecipeId   FK → Recipe               IngredientId FK → Ingredient (cascade)
  AddedAt    DateTimeOffset            CheckedAt    DateTimeOffset
  unique (ShopperId, RecipeId)         unique (ShopperId, IngredientId)
```

## The design arguments (read these, not just the boxes)

### Ingredient identity — the #1 fix, in detail

In the React app, "is this ingredient checked?" was answered by *position*:
`pad-thai:4`. Position lies the moment the list is edited. Here, a check is
a **row pointing at an ingredient's primary key**. Reorder ingredients all
you like — `SortOrder` changes, `Id` doesn't, checks stay correct. The PRD
F6 acceptance test (reorder data → redeploy → checks intact) passes by
construction.

The identity question doesn't vanish, though — it moves to **import time**
(Architecture Decision 3): when `thai.json` changes, which incoming
ingredient rows are "the same" as existing ones? The matching rule:

```
ContentKey = SHA-256( normalize(GroupName) + "|" + normalize(Quantity) + "|" + normalize(Item) )[..16]
(normalize = trim, collapse whitespace, lowercase)
```

- Incoming item matches an existing `ContentKey` in the same recipe →
  same ingredient: update `SortOrder`, **keep the Id** (checks preserved).
- No match → new ingredient row.
- Existing row with no incoming match → delete it (its checks cascade away).

**Consequence to state honestly:** *editing an ingredient's text* changes
its ContentKey, so it becomes delete + insert, and its checks drop. That is
the designed behavior — a check on "2 tbsp fish sauce" does not silently
apply to what is now "3 tbsp fish sauce". Dropping a stale check is honest;
migrating it to changed content would be the old bug in new clothes. (Two
*identical* lines in one recipe collide on ContentKey; the importer
disambiguates by appending an occurrence index before hashing.)

Alternative rejected: explicit `id` fields hand-written in the JSON. More
precise (survives text edits) but pushes bookkeeping onto every data PR
forever; hashes cost nothing and self-heal. If ingredient text edits turn
out to be frequent *and* check-loss annoys users, revisit — that's the
trigger condition.

### Reference tables vs enums — one of each, on purpose

`Difficulty` is a C# enum: three values, code branches on it, data never
adds a fourth without a code change anyway. `Cuisine`/`Category` are
**tables**: the PRD (§6) demands "add a cuisine = data change only," and a
cuisine carries presentation data (label, colors). The UI renders chips and
tags from these rows — the IMPROVE.md #5 hardcoding class dies here.
Teaching point: "is this an enum or a table?" ≈ "does adding one require
recompiling?" — answer it per case, not by habit.

### Time as numbers

`PrepMinutes int?` ends the `"15 min"` / `"14 minutes"` / `"2 hours"` mess
(IMPROVE.md #8). The importer parses the existing JSON strings once
(`"1 hour"` → 60; unparseable → null + import warning); display formatting
("1 h 30 min") becomes a view concern. This immediately unlocks the
natural features the old model made impossible: sort by total time,
"under 30 minutes" filter (both Phase 6 candidates).

`Quantity` stays a string **deliberately** — "to taste", "1 glass packed
full", "35 g (3 tbsp)" carry human meaning a decimal column would destroy.
Parsing quantities is the scale-servings problem (docs exercise 2.2), kept
out of the schema. Modeling maturity = knowing what *not* to normalize.

### Recipe removal: soft delete (answering PRD OQ2)

`IsRetired` instead of row deletion. A retired recipe: hidden from browse/
search, returns 410-style tombstone on its URL, **stays visible on
shopping lists that already contain it** (with a "no longer in the
cookbook" note). Rationale: the shopper's list is *their* data; the
cookbook editing schedule shouldn't punch holes in it mid-shop. Hard
deletes remain possible for legal/takedown cases and cascade cleanly.

### What indexes, and why these

- `Recipe.Slug` unique — the URL lookup, hottest read.
- `Ingredient (RecipeId, SortOrder)` — every recipe page renders this.
- `IngredientCheck (ShopperId, IngredientId)` unique — both the integrity
  rule (can't double-check) and the shopping-list join.
- `Shopper.Token` unique — every request with a cookie does this lookup.

Nothing else until a measured slow query exists. Indexes are not free
(write cost, storage); adding them speculatively is junior cargo cult.

## Sizing (why SQLite yawns at this)

74 recipes × ~15 ingredients ≈ 1,100 ingredient rows. Even 10,000 shoppers
with 5 recipes and 40 checks each ≈ 450k tiny rows — SQLite territory by
orders of magnitude. Numbers first, scaling anxiety never.

## Migration path from the React app

There isn't one, and that's a decision worth recording: localStorage lives
in browsers; the server can't reach it. Options considered: (a) a one-time
JS shim on the new site that reads old localStorage and POSTs it to the
server, (b) accept the loss. **Proposal: (b)** — a hobby app with unknown
users doesn't justify (a)'s effort; but (a) is the *kind* of migration a
senior should know exists (client-held data can only be migrated client-
side, by code you ship to the client). If this were production with real
users, (a) would be mandatory and Phase 3 would grow a task.

## Learning checklist for this doc

After Phase 1 implements this schema, you should be able to answer cold:

1. Why is `(ShopperId, IngredientId)` unique instead of letting duplicates
   exist and deduplicating in queries? (Integrity at the source vs
   integrity re-enforced in every consumer — the DB is the one place a
   rule can't be forgotten.)
2. What breaks if `ContentKey` collided across *different* recipes?
   (Nothing — matching is scoped per-recipe. Knowing your keys' scope is
   knowing your model.)
3. Why `DateTimeOffset` everywhere instead of `DateTime`? (An unambiguous
   instant vs a wall-clock reading that lies across time zones.)
4. Point at every place the old `${slug}:${index}` bug is now structurally
   impossible, and the one place its *cousin* still lives (import matching)
   and how it's handled.
