# Commit the ld-58 fixture closure in the private repo; strip it before going public

A curated subset of ld-58 scenes plus their transitive `res://` resource closure
is committed under `scenes/ld58/` (mirroring the `res://` tree so paths resolve)
as visual-regression fixtures + showcase progress clips for both apps.

**Repo plan (load-bearing):** this is a PRIVATE development repository. When the
feature set + architecture are ready, the code will be moved to a PUBLIC repo
**with all ld-58 references and assets removed**. So while developing here we
commit the ld-58 scenes/assets as-is for fidelity and progress tracking; the
public-move step is responsible for stripping `scenes/ld58/`, the ld-58 showcase
clips, and any ld-58-specific fixtures. Asset redistribution licensing is
therefore NOT a blocker now (private), and downscaling textures is an optional
repo-size choice rather than a licensing requirement. The music track is still
omitted (not needed for the visual previewer).

Only raw `res://`-resolvable files are committed — no Godot `.import` files and
no `.godot/` remap directory are needed, because every `ext_resource` carries a
direct `path="res://…"` the renderer resolves itself. The web app resolves
`res://x` → `/fixtures/x`, so the closure is committed under `scenes/ld58/`
mirroring that structure and copied to `public/fixtures/` preserving subpaths.

**Scripts are stripped.** Vendored `.tscn` files have every
`[ext_resource type="Script" …]` entry and every `script = ExtResource(…)`
property line removed, and `load_steps` recomputed (`1 + ext_resources +
sub_resources`). The renderer ignores GDScript anyway, and stripping keeps game
*code* out of the (eventually public) repo while preserving the scene graph,
meshes, materials, and transforms verbatim. Harmless editor metadata such as
`metadata/_custom_type_script` is left as-is (it carries no resource reference
and is not a load step). The full `Hallway.tscn` closure — 286 nodes across 31
sub-scenes, 11 GLBs, 3 materials, and ~25 downscaled images — was vendored this
way and renders end-to-end from the in-repo fixtures (no upload cascade needed).

Recorded because the private-now / strip-before-public lifecycle is a deliberate
decision a future contributor must know (don't publish ld-58 assets), and the
`res://`-mirrored fixture layout is non-obvious.

## Amendment (2026-07-15): the strip has been executed

The public-move step described above has run. `scenes/ld58/` is no longer
committed — it is gitignored, and a contributor who wants the original vendored
corpus locally (e.g. to re-derive a fixture) can re-vendor it with
`pnpm vendor:ld58` (`scripts/vendor-ld58.mjs`), which is a manual, opt-in step
against the (public) source repo, not part of `pnpm install` or CI. The showcase
clips and screenshots that depended on `scenes/ld58/` content were removed or
re-recorded against synthetic/public fixtures.

Committed regression coverage that used to run against the vendored corpus
(wall-transform, instance-composition, and 2D-UI-overlay regression tests) now
rests on synthetic fixtures checked into `scenes/fixtures/` that reproduce the
same structural shapes (nested instance
transforms, rotated planes, Control-heavy UI trees) without carrying any
vendored asset or content. The `res://`-mirrored fixture layout described above
is preserved as the historical record of how the closure was committed while
this was a private repository; it no longer describes the current tree.

## Amendment (2026-07-18): deployed, not committed

The strip above governs the REPOSITORY only. The public web DEPLOYMENT
(Cloudflare Pages today; whatever hosts `apps/textscene-web/dist` tomorrow)
DOES carry the ld-58 corpus, alongside the vendored open-source games corpora —
the hosted previewer is the showcase, and ld-58 is its richest real-world
content. The decision rests on ownership: ld-58 is the author's own project, so
redistributing its (script-stripped, music-omitted, texture-downscaled) assets
on the author's own deployment needs no third-party licence. The earlier
"don't publish ld-58 assets" note therefore narrows to: don't COMMIT them, and
don't ship them in any artifact other than the web deployment (repo, npm
packages, the VS Code extension, CI artifacts all stay clean).

Mechanics: `pnpm build:site` vendors both corpora (`vendor:games`,
`vendor:ld58` — both public sources, anonymous fetch), regenerates the
fixture manifests, and produces the deployable `apps/textscene-web/dist`.
Everything vendored stays gitignored. Note the ld-58 SOURCE repo being
public doesn't change this repo's stance: the corpus stays repo-external
here (curated whitelist, script-strip) and reaches users only through the
web deployment. Old deployments made while the corpus was committed
UNSTRIPPED should still be purged — the replacement deploy carries the
script-stripped vendored form.
