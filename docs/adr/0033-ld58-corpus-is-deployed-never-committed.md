# The ld-58 corpus is deployed, never committed

- Supersedes ADR-0010.

The ld-58 scenes and their transitive `res://` closure are the richest real-world
content the hosted previewer shows. They reach users through the web deployment and
through nothing else.

## Decision

**The repository carries none of it.** `/scenes/ld58/` and
`apps/textscene-web/src/fixtures.ld58.ts` are gitignored. Nothing under them is
tracked, and no npm package, VS Code extension build or CI artefact contains a vendored
asset.

**The deployment carries all of it.** `pnpm build:site` vendors the corpus and the
open-source games corpora beside it, then regenerates the fixture manifests and builds
`apps/textscene-web/dist`. Everything it vendors stays gitignored.

**A contributor vendors it on purpose or not at all.** `pnpm vendor:ld58` fetches it
anonymously from the public source repository. It is manual and opt-in, never part of
`pnpm install` or CI, so a clone with no network and no interest in the corpus builds and
tests the same as one with it.

**Each vendored `.tscn` is script-stripped on the way in.** `scripts/vendor-ld58.mjs`
removes each `[ext_resource type="Script" …]` header and each `script = ExtResource(…)`
line, then recomputes `load_steps`. The strip is deterministic and mechanical, applied at
vendor time, not left to a human. The previewer never runs GDScript or C#, and the `.gd`
and `.cs` files are not fetched, so the scene graph, meshes, materials and transforms
survive verbatim while the game's code does not travel.

## Why the split

Ownership settles it. ld-58 is the author's own project, so to serve its assets from the
author's own deployment needs no third-party licence. To commit them is a different act:
it puts them in each clone, each fork and each published package, which is both a
redistribution question and a repository-size one.

The two rules are easy to merge into one and get wrong:

- Do not commit the corpus.
- Do not ship it in any artefact other than the web deployment.

## Consequences

Committed regression coverage cannot rest on the corpus. Synthetic fixtures in
`scenes/examples/` and `scenes/fixtures/` reproduce its structural shapes (wall
transforms, instance composition, 2D UI) and carry no vendored content.

A deployment that carries the corpus unstripped should be purged, not left to age out. The
replacement deploy carries the stripped form.

The music track is not vendored. The previewer has no audio.
