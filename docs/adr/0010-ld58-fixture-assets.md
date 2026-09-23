# Commit the ld-58 fixture closure in the private repo; strip it before going public

**Superseded by ADR-0033: the corpus is deployed, never committed.** ADR-0033 states what holds now. This record keeps the reasoning behind the `res://`-mirrored layout and the script-strip. Its two amendments below invert its own decision.

A curated subset of ld-58 scenes plus their transitive `res://` resource closure was committed under `scenes/ld58/`, mirroring the `res://` tree so paths resolve, as visual-regression fixtures and showcase clips for both apps. The repository was private, and the step that made it public had to strip `scenes/ld58/`, the ld-58 showcase clips and any ld-58-specific fixtures. Asset licensing was therefore no blocker, and texture downscaling was a repo-size choice, not a licensing requirement. The music track is omitted: the visual previewer does not need it.

Only raw `res://`-resolvable files are vendored. No Godot `.import` files and no `.godot/` remap directory are needed, because every `ext_resource` carries a direct `path="res://…"` that the renderer resolves itself. The web app resolves `res://x` to `/fixtures/x`, so the closure mirrors that structure under `scenes/ld58/` and is copied to `public/fixtures/` with its subpaths.

**Scripts are stripped.** A vendored `.tscn` file has every `[ext_resource type="Script" …]` entry and every `script = ExtResource(…)` property line removed, and `load_steps` recomputed (`1 + ext_resources + sub_resources`). The renderer ignores GDScript. The strip keeps game *code* out while it keeps the scene graph, meshes, materials and transforms verbatim. Editor metadata such as `metadata/_custom_type_script` stays: it carries no resource reference and is not a load step.

## Amendment: the strip is done

`scenes/ld58/` is not committed. It is gitignored. A contributor who wants the vendored corpus locally, for example to re-derive a fixture, runs `pnpm vendor:ld58` (`scripts/vendor-ld58.mjs`). That is a manual, opt-in step against the public source repository, not part of `pnpm install` or CI. The showcase clips and screenshots that used `scenes/ld58/` content were removed or recorded again against synthetic and public fixtures.

The wall-transform, instance-composition and 2D-UI-overlay regression tests rest on synthetic fixtures in `scenes/examples/` and `scenes/fixtures/`. They reproduce the same structural shapes (nested instance transforms, rotated planes, Control-heavy UI trees) with no vendored asset or content. The `res://`-mirrored layout above does not describe the current tree.

## Amendment: deployed, not committed

The strip governs the repository only. The public web deployment (Cloudflare Pages, or whatever hosts `apps/textscene-web/dist`) carries the ld-58 corpus beside the vendored open-source games corpora. The hosted previewer is the showcase, and ld-58 is its richest real-world content. The decision rests on ownership: ld-58 is the author's own project, so its script-stripped, music-omitted, texture-downscaled assets on the author's own deployment need no third-party licence. The rule is: do not commit ld-58 assets, and do not ship them in any artefact other than the web deployment. The repository, the npm packages, the VS Code extension and the CI artefacts stay clean.

Mechanics: `pnpm build:site` vendors both corpora (`vendor:games` and `vendor:ld58`, both public sources, anonymous fetch), regenerates the fixture manifests, and produces the deployable `apps/textscene-web/dist`. Everything vendored stays gitignored. The public ld-58 source repository does not change this stance: the corpus stays outside this repository (curated whitelist, script-strip) and reaches users only through the web deployment. A deployment made while the corpus was committed unstripped should be purged. Its replacement carries the script-stripped vendored form.
