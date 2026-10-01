# Concepts explained from first principles

[Course index](README.md)

## The central idea: React state ownership, storage validation and accessible controls

The cookbook is reference data; the shopping list is user state. Mutating the recipe’s ingredient array would mix those responsibilities and could change the recipe-detail screen unintentionally. A keyed override is smaller and preserves the source. Quantity strings are intentionally not automatically parsed or scaled because values can contain fractions, ranges, package sizes and phrases such as "to taste". The nullish-coalescing operator matters: override ?? original respects an empty string, while override || original would silently restore text the user cleared. TypeScript checks source code at compile time, but JSON from localStorage is unknown runtime data, so normalization is still required. A pure normalization function is easy to test without mounting React; interaction and keyboard checks then verify the wiring around it. Storage failure is disclosed rather than hidden behind a claim that progress was saved.

## Invariants: a precise way to describe correctness

An invariant is a rule that must remain true before and after an operation. “The app works” is too broad to test. “A failed import writes no records” or “editing preserves the record id” gives you something observable. For this project, derive your invariants from this behavior:

> Shoppers can edit quantities using labeled keyboard-accessible controls. Overrides persist, removal cleans up stale keys, and copied text uses the same effective quantities as the screen. Old saved selections/checkmarks are retained and malformed keys are removed.

Turn each sentence into a small state table. The columns are initial state, input, expected final state and expected feedback. Include one rejected input and one retry/repeated action where relevant. A useful invariant should be meaningful even if the implementation changes from an array to a database or from one UI component to another.

## Validation versus normalization

Validation rejects values the operation cannot accept. Normalization converts acceptable values to the representation the rest of the program expects. Trimming a comparison string is normalization; rejecting an empty required field is validation. Neither operation should silently invent facts. If a quantity is free-form text, do not guess a numerical interpretation. If an imported record is malformed, do not quietly save only the convenient subset unless that is the explicit product policy.

Apply this distinction to the data model:

Shopping state contains recipeSlugs, checked and quantities. Quantity overrides are strings keyed by slug:index. An absent override uses the source recipe quantity; an explicit empty string means the shopper intentionally removed the quantity text.

Which fields can be omitted? Which can be empty? Which have a bounded vocabulary? Which have stable identity? Write those answers down before adding another conditional. A schema is simply an explicit description of that expected shape and meaning.

## The same job on a server

`normalizeShoppingState` is a hand-written runtime schema. That phrase is worth unpacking, because it is the single idea in this project that transfers directly to CRUD API work.

TypeScript's `unknown` is the honest type for anything that crossed a boundary: JSON from `localStorage`, a `fetch` response body, an HTTP request body, a row from a database driver. The compiler checked your *source*; it did not check the bytes. `JSON.parse` returns `any`, which is worse than `unknown` because it silently disables the checks you think you have. Every one of those boundaries needs the same four steps this normalizer performs - shape guard, type check, domain check, bound - and the only question is whether you write them by hand or declare them.

On an Express API the boundary is the request body and the tool is usually a schema library:

```typescript
import { z } from 'zod';

const createRecipe = z.object({
  title: z.string().trim().min(1).max(200),
  ingredients: z.array(z.object({
    item: z.string().trim().min(1).max(100),
    quantity: z.string().max(100),
  })).max(50),
  isPublic: z.boolean().default(false),
});

app.post('/api/recipes', async (req, res) => {
  const parsed = createRecipe.safeParse(req.body);      // the boundary
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.issues });
  const recipe = await service.create(parsed.data, req.user.id);   // typed from here on
  res.status(201).json(recipe);
});
```

The parallels with this project are exact, line for line: `safeParse` is the `if (!value || typeof value !== 'object')` guard, the `z.string()` leaves are the `typeof v === 'string'` checks, `.max(100)` is `v.length <= 100`, and `parsed.data` being typed is what the `(slug): slug is string` type predicate buys you by hand. The differences are what to do on failure - the browser silently drops the bad key because there is no one to tell, while an API returns a 400 with the issue list - and *who* the untrusted party is: here it is the user's own browser storage, there it is an arbitrary caller.

Two courses in this path show the server half with real code. `newcodexJS/06-bookmark-manager` uses Zod at the route boundary. `newcodexJS/05-recipe-manager` hand-writes a nested validator for exactly this data shape and is worth reading next to `normalizeShoppingState`: it makes the *opposite* failure choice - where this function silently drops an invalid ingredient, that one rejects the whole request, because on a server dropping a child record turns a malformed request into a half-saved one. Neither choice is universally right, and being able to say why each project chose what it did is the point.

## State transitions and failure boundaries

Every change has an ordering. If memory changes first and persistence fails, the UI can show data that will disappear after reload. If persistence succeeds first and rendering fails, the stored data may be correct while the screen is stale. There is no universal answer for every feature, but the choice must be deliberate and observable. The worked change makes one specific promise; the tests check that promise.

A promise represents an operation that completes later. `await` does not make it infallible or atomic; it gives the caller a place to handle success and rejection. Similarly, calling several functions inside one `try` block does not create a database transaction. Atomicity must come from a storage operation or transaction boundary that actually provides it.

## Identity, representation and derived values

Keep a stable id when updating an existing record. Compute display-only values from authoritative data when feasible, so there are fewer independently mutable facts to keep synchronized. Be careful when converting between strings and numbers: `Number('')` is zero, JSON cannot faithfully represent Infinity, and a date string can have different semantics from a timestamp. The specific conversions in this lesson are visible in the worked source, so step through them with a concrete value.

## Small design decisions deserve explanations

Before extracting a new abstraction, explain what repeated responsibility it would own. A helper that merely renames one expression may add little. A pure validator or one transaction boundary can make an important guarantee easier to test. Prefer an explanation tied to this project’s behavior over a rule such as “all code must use a particular pattern.”

Write a short decision note: “We chose X because it preserves Y under Z. It does not yet solve W.” Use the limitations in the worked example to fill in those letters. This is the beginning of engineering judgment: choosing a bounded solution and accurately describing its limits.
