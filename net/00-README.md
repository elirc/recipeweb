# net/ — The Proposed C# / .NET Rewrite

This folder is a **planning package, not code**. It proposes rewriting
Sarap & Ngon on the .NET platform, and — like `docs/` — it's written to
upskill a junior engineer while doing it. Nothing here has been
implemented; that's deliberate. Reading, critiquing, and *then* executing a
plan is a different (and rarer) skill than jumping straight to code.

## Why rewrite at all?

Be suspicious of rewrites. "Let's rewrite it" is the most expensive
sentence in software, and the current React app *works*. There are exactly
two honest justifications here, and you should hold the plan accountable to
both:

1. **Learning.** The React app taught frontend fundamentals. A .NET rewrite
   teaches the other half of the profession: servers, databases, dependency
   injection, migrations, integration testing, deployment of stateful
   systems. Same familiar product, entirely new half of the stack — the
   product knowledge you already have becomes free working memory for the
   new material.
2. **The debts in `docs/IMPROVE.md` that the current architecture can't pay
   down.** A static SPA fundamentally cannot fix SEO-invisible recipe pages
   (#6), and it makes real persistence, migrations (#9), and stable
   ingredient identity (#1) awkward. A server-rendered app with a real
   database fixes those *by construction* — the rewrite is the payment
   plan.

If neither of those applied — if this were a production system with users
and no learning goal — the correct proposal would be "don't rewrite;
incrementally fix IMPROVE.md items in place." Write that sentence on your
hand. Knowing when *not* to rewrite is the senior half of this lesson.

## The documents

Read in order:

| Doc | What it is | The upskilling angle |
|---|---|---|
| [01-PRD.md](01-PRD.md) | Product requirements: what we're building, for whom, what's out of scope | How to write requirements that engineering can actually build from |
| [02-ARCHITECTURE.md](02-ARCHITECTURE.md) | The proposed stack and every major decision, with alternatives | Decision records; sizing tech to the problem |
| [03-DATA-MODEL.md](03-DATA-MODEL.md) | Entities, relationships, and how the schema fixes the IMPROVE.md bugs | Relational modeling; identity; migrations |
| [04-IMPLEMENTATION-PLAN.md](04-IMPLEMENTATION-PLAN.md) | Six phases, each with tasks, learning objectives, and a Definition of Done | Breaking a project into shippable increments |
| [05-CSHARP-FOR-REACT-DEVS.md](05-CSHARP-FOR-REACT-DEVS.md) | Rosetta stone: every TS/React concept you know → its C#/.NET equivalent | The actual language/framework upskilling |
| [06-TESTING-AND-QUALITY.md](06-TESTING-AND-QUALITY.md) | Test strategy, CI gates, and quality bars — designed in from day one | The discipline the React app skipped (IMPROVE.md #2) |

## The one-paragraph proposal

Rebuild Sarap & Ngon as a single **ASP.NET Core (.NET 10 LTS) Blazor Web
App**: recipe pages rendered on the server (fast, crawlable, sharable),
with small interactive islands (checklist, filters) where the UI needs to
be live. Data moves from a generated TypeScript file into **SQLite via EF
Core**, seeded from the same four JSON files, with a schema that gives
ingredients stable identities. The shopping list moves server-side, keyed
by an anonymous cookie — no login required, same UX, but persistence
becomes real and cross-feature. Testing (xUnit + bUnit + integration tests)
and CI exist from phase 1, not as an afterthought. One deployable unit, one
process, no client build pipeline.

## How to use this folder to upskill

1. Read the PRD and try to find a requirement that's ambiguous enough to
   build wrong. (There's at least one left in deliberately — see the PRD's
   open-questions section.)
2. Read the architecture doc *adversarially*: for each decision, write down
   the strongest case for the rejected alternative before reading on.
3. Only then start Phase 0 of the implementation plan — and keep a log of
   where reality diverges from the plan. Every divergence is either a
   planning lesson or a discovery; label which.

The React app's docs (`../docs/`) remain the prerequisite reading. This
folder assumes you've absorbed them — especially IMPROVE.md, which this
plan references constantly by number.
