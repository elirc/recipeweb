# Start Here — The recipeweb Learning Path

Welcome. This folder is two things at once:

1. **Onboarding** — everything you need to work on this project confidently.
2. **A curriculum** — this codebase is small enough to hold in your head and
   real enough to teach you patterns you'll use for the rest of your career.
   The docs use the *actual code in this repo* as the teaching material.

You don't need to be a strong coder to start. The docs assume you know
roughly what variables, functions, and loops are, and build up from there.

## The path

Work through these in order. Don't skim — actually open the files referenced
and read the real code alongside the doc. Reading code is 80% of the job.

| Doc | What you'll learn | Time |
|---|---|---|
| [01-ONBOARDING.md](01-ONBOARDING.md) | Get the app running, tour every file, understand the data flow | ~1 hour |
| [02-ARCHITECTURE.md](02-ARCHITECTURE.md) | How the whole system works and **why** it was built this way | ~2 hours |
| [03-TYPESCRIPT.md](03-TYPESCRIPT.md) | Every TypeScript concept this repo uses, from zero | ~3 hours |
| [04-REACT.md](04-REACT.md) | Every React concept this repo uses, from zero | ~4 hours |
| [05-EXERCISES.md](05-EXERCISES.md) | Graded hands-on exercises: junior → mid → senior | days–weeks |
| [06-GROWTH.md](06-GROWTH.md) | The habits that separate juniors from seniors | ongoing |
| [IMPROVE.md](IMPROVE.md) | An honest critique of this codebase — how it *should* have been built | read last |

Read `IMPROVE.md` last, after you understand the code. Criticism only teaches
you something once you understand what's being criticized.

## Rules of engagement

- **Type the code, don't paste it.** When an exercise asks you to build
  something, write it by hand. Muscle memory is real.
- **Break things on purpose.** Delete a prop, rename a field, watch what
  errors appear and where. The error messages are the curriculum.
- **Use `npm run build` constantly.** TypeScript's compiler is a free senior
  engineer reviewing your work on every save.
- **When stuck for more than 30 minutes, write down the question precisely.**
  Half the time, phrasing the question precisely answers it. That's not a
  trick — it's the debugging skill itself.

## The 30-second project summary

This is a static cookbook site: 74 Filipino, Vietnamese, Thai, and Spanish
recipes. Users browse/search/filter, view a recipe's full ingredient list,
and build a combined shopping list that persists in their browser. Every
recipe links back to the original author's page — we never copy instructions,
only ingredient lists and credits.

There is **no backend**. The "database" is a TypeScript file generated from
JSON at build time. That single decision shapes almost everything else — see
02-ARCHITECTURE.md for why.
