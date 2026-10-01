# Verification: Recipeweb: editable shopping quantities

[Course index](README.md)

**Implementation date:** 2026-09-08. Checks below ran on isolated working copies before the reviewed files were applied to this project.

| Check | Result |
|---|---|
| tests | Passed (exit code 0) |
| build | Passed (exit code 0) |
| lint | Passed (exit code 0) |
| Real Chromium browser interaction | Passed |

**Automated test cases:** 4 (`test/shopping-state.test.ts`). Three were delivered with the original change; case 4 was added in the 2026-09-17 follow-up to cover a cookbook that lost an ingredient after the document was stored.

## What was exercised

The source ingredient says "1 cup". Change it to "2 1/2 cups" in the shopping list. Reload and copy the list: both still say "2 1/2 cups". The source recipe continues to say "1 cup". Remove the recipe and its override disappears.

Case 4: a stored document with `checked`/`quantities` keys for `soup:0`, `soup:1` and `soup:2`, normalized against a cookbook where `soup` now has two ingredients, keeps only the first two and drops both `soup:2` entries; the surviving `soup:1` override still reaches `ingredientsWithQuantities` and the source recipe still reads "1 tsp".

## Environment and scope

The verification environment used Node 22.16.0. Browser checks used the installed Chromium build.

Tests and builds ran in working copies with an isolated shared dependency harness; this project also used its own installed dependency tree for its production build. Source files were checked against the original content before application. Install this project’s declared dependencies locally to run its scripts; no running service or installed dependency tree is assumed merely because the source changes are present.

The tests target the implemented change and relevant existing behavior. They do not establish production readiness, every browser/version, multi-tab safety or every unrelated workflow. Practice extensions in chapter 5 are not completed features.

## Reproduce the checks

From this project folder: `npm install`, then `npm test`.

The central implementation report in AstraOrganized2/astrafinalplan/TEN_PROJECTS_IMPLEMENTED.md links all ten courses. Machine-readable check results and logs are retained with the implementation tooling in that repository.

Reading the diff: the files Astra touched were re-saved with CRLF line endings and Prettier formatting, so a plain `diff` shows whole files as changed. Compare with `git diff -w`, or `diff -r --strip-trailing-cr -w <backup> <project>` against the pre-change backup, to see only the real edits.
