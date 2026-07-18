# 06 — Growth: The Habits That Make You Senior

Technical knowledge (docs 03–04) is table stakes. What actually separates
levels is a set of *habits* — repeatable behaviors under uncertainty. This
doc names them and gives you concrete practice, using this repo where
possible.

## 1. Read code like a reviewer, not like a student

A student reads code to understand it. A reviewer reads code to find where
it's *wrong* — or where it will become wrong.

The questions a reviewer runs on every file:

1. **What happens on bad input?** (`RecipePage` handles a garbage slug.
   `loadState` handles corrupted JSON. Does `new URL(recipe.sourceUrl)`
   handle a malformed URL in the data? …check it. What would happen?)
2. **What happens at 10× the data?** (74 recipes → 740: search still fine.
   The 357KB bundle → not fine. Knowing *which* things break first is the
   skill.)
3. **What must a future change remember to touch?** Count the places adding
   a cuisine touches: `types.ts`, a JSON file, CSS variables, CSS rules.
   How many does the compiler remind you about? (types, labels.) How many
   fail silently if forgotten? (CSS — the tag renders unstyled.) Silent
   ones are review comments waiting to happen.
4. **What is the blast radius of this line?** Changing `STORAGE_KEY` logs
   every user out of their shopping list. Some one-line diffs are huge.

**Practice:** review one file of this repo per day with those four
questions. Write your findings as if commenting on a PR. Compare against
IMPROVE.md afterwards — treat it as the answer key, and note what you found
that it missed (there are things; no review is complete).

## 2. Debug systematically, not by flailing

The junior debugging loop is: change something, refresh, squint, repeat.
The senior loop is the scientific method:

1. **Reproduce** reliably. A bug you can't reproduce on demand isn't ready
   to be fixed.
2. **Locate** by bisection. The data pipeline here has clean cut points:
   is the bad value in the JSON? (look) In `recipes.ts`? (look) In the
   component's props? (log/breakpoint) In the render? Each check halves the
   search space. Never start "somewhere in the middle with a vibe."
3. **Hypothesize → test one variable at a time.** Two simultaneous changes
   teach you nothing when the behavior shifts.
4. **Fix the cause, not the symptom.** If a recipe renders `&amp;`, you can
   patch the component to replace it (symptom, and now every component
   needs the patch) or normalize at generation time like the repo does
   (cause, fixed once).
5. **Afterwards, ask: why did the system let this happen?** The best
   engineers convert bugs into guardrails — a test, a validator rule,
   a type. One bug, one systemic improvement.

**Practice:** have someone (or an AI) secretly break this app — wrong prop,
mutated state, off-by-one in the checklist keying — and time-box yourself
to find it via bisection only.

## 3. Make small, explainable changes

Look at this repo's git history pattern for the Thai/Spanish feature: data
files, then types, then generator, then UI, then docs. Each step compiles.
That's not ceremony — it's what makes review possible and reverts cheap.

Habits:
- **One intention per commit/PR.** "Add tag filtering" and "fix checklist
  bug" never travel together — a revert of one shouldn't drag the other.
- **Write commit messages explaining *why*.** "Fix bug" is noise.
  "Key checked state by item hash — index keys misattribute checks after
  data edits" teaches the next reader (usually future-you) something.
- **Leave the campsite cleaner, within scope.** Renaming one confusing
  variable you touched anyway: yes. Reformatting the whole file in a bugfix
  PR: no — you just buried the fix in 400 lines of noise.

## 4. Distinguish reversible from irreversible decisions

Most decisions are cheap to change: a component's internal structure, a CSS
approach, a helper's API. Some are expensive: **anything persisted**
(our localStorage schema — users' devices hold old data forever), **anything
public** (URLs people bookmarked), **anything about data shape at scale**.

The senior move is spending your care *proportionally*: agonize over the
storage key format, and just pick something for the button color. Juniors
often invert this — bikeshedding names for an internal helper while
casually persisting an index-keyed map to thousands of browsers (…exhibit
A: IMPROVE.md #1).

Ask of every design: "if this is wrong, what does fixing it cost in six
months?" If the answer is "a refactor," proceed. If it's "a migration of
data we don't control," slow down, write the design note, get review.

## 5. Write things down

Every senior engineer is, functionally, a writer. The artifacts that carry
weight: design notes (like exercise 3.1 requires), honest READMEs, PR
descriptions that explain tradeoffs, postmortems without blame.

The forcing function: **if you can't write the design down clearly, you
don't understand it yet.** Writing isn't documenting your thinking; it *is*
the thinking.

**Practice:** for exercise 2.1 (tag filtering), write the half-page design
note *before* coding — where state lives, why, what you rejected. Then
compare what you built against what you wrote. The gap is your calibration
error; it shrinks with reps.

## 6. Estimate, scope, and say the uncertain part out loud

"How long will scaling servings take?" A junior says "two days" and means
"I have no idea." Practice the honest version:

- Decompose: parse quantities (unknown difficulty — messy strings), UI
  (small), state (small), edge cases (unknown until parsing is understood).
- Give a spike first: "half a day to survey the quantity formats in the
  data, then I can estimate the rest credibly." (You can literally do this:
  `grep -o '"quantity": "[^"]*"' scripts/*.json | sort | uniq -c | sort -rn`)
- Name your risk: "the unknown is quantity parsing; everything else is
  routine."

Uncertainty stated up front is professionalism, not weakness. Surprises
reported late are the actual credibility killer.

## 7. Know what you don't know (and manage it)

Mid-level engineers are dangerous in a specific way: enough skill to build
anything, not enough scar tissue to know what will hurt later. Antidotes:

- Before building, search: "how do others solve shopping-list ingredient
  merging?" Someone has. Their failure modes are free lessons.
- Prefer designs you can *verify* over designs you must *trust*. (Why the
  test exercises come before the architecture exercises in the ladder.)
- Keep a "things that surprised me" log. Reread it monthly. Patterns in
  your own surprise are your growth map.

## 8. The mid → senior line, concretely

You're operating at mid level when: you can take a scoped feature (tag
filtering) and deliver it correctly without hand-holding, including edge
cases and tests.

You're operating at senior level when:

- You **find the problem**, not just solve the given one (nobody filed a
  ticket for the checked-index bug — a review found it).
- Your changes make *other people's* future changes safer (the CI exercise,
  the derived-chips refactor).
- You can argue both sides of your own design and name what evidence would
  change your mind (every "when it would be wrong" section in
  02-ARCHITECTURE.md).
- People with less context can follow your written reasoning.

None of that requires a big company or a distributed system. All of it is
practicable in this 10-file repo — that's why the exercise ladder ends
where it does.

Final assignment: read [IMPROVE.md](IMPROVE.md) now, then re-review the
codebase yourself and find one issue it doesn't mention. There is always
one more.
