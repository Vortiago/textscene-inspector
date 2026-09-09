# The ld-58 corpus is deployed, never committed

The ld-58 scenes and their transitive `res://` closure are the richest real-world
content the hosted previewer shows. They reach users through the web deployment
and through nothing else.

## Decision

**The repository carries none of it.** `/scenes/ld58/` and
`apps/textscene-web/src/fixtures.ld58.ts` are gitignored. Nothing under them is
tracked, and no npm package, VS Code extension build or CI artefact contains a
vendored asset.

**The deployment carries all of it.** `pnpm build:site` vendors the corpus, and
the open-source games corpora beside it, then regenerates the fixture manifests
and builds `apps/textscene-web/dist`. Everything it vendors stays gitignored.

**A contributor vendors it on purpose or not at all.** `pnpm vendor:ld58` fetches
it anonymously from the public source repository. It is manual and opt-in, never
part of `pnpm install` or CI, so a clone with no network and no interest in the
corpus builds and tests exactly as one with it.

**Every vendored `.tscn` is script-stripped on the way in.**
`scripts/vendor-ld58.mjs` removes each `[ext_resource type="Script" …]` header
and each `script = ExtResource(…)` line, then recomputes `load_steps`. The strip
is deterministic and mechanical, applied at vendor time rather than trusted to a
human. The previewer never executes GDScript or C#, and the `.gd` and `.cs`
files are not fetched, so the scene graph, meshes, materials and transforms
survive verbatim while the game's code does not travel.

## Why the split

Ownership settles it. ld-58 is the author's own project, so serving its assets
from the author's own deployment needs no third-party licence. Committing them
is a different act: it puts them in every clone, every fork and every published
package, which is both a redistribution question and a repository-size one.

The two rules that follow are worth stating plainly, because they are easy to
collapse into one and get wrong:

- Do not COMMIT the corpus.
- Do not ship it in any artefact other than the web deployment.

## Consequences

Committed regression coverage cannot rest on the corpus. The tests that once did
(wall transforms, instance composition, 2D UI overlays) run against synthetic
fixtures in `scenes/examples/` and `scenes/fixtures/` that reproduce the same
structural shapes and carry no vendored content.

A deployment made while the corpus was committed unstripped should be purged
rather than left to age out. The replacement deploy carries the stripped form.

The music track is not vendored. The previewer has no audio.

Superseded ADR-0010, which recorded the opposite decision for the period when
this was a private repository.
