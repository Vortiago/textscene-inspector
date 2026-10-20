# Godot demo corpora

`pnpm vendor:demos` fetches [godotengine/godot-demo-projects](https://github.com/godotengine/godot-demo-projects)
at commit `419eae0c39be0234d5454ee491b16d938fa12d65` and writes two gitignored corpora:

- `scenes/demos/<top>/<project>/`: every project under `2d/`, `3d/`, `gui/` and `viewport/`, except
  `2d/isometric`.
- `scenes/isometric/`: the files that `2d/isometric/dungeon.tscn` reaches, beside the committed
  `previews/`.

`pnpm install`, the unit tests (`vitest.config.ts`), `generate:fixtures`, `copy-fixtures` and
`lint:scenes:only` run it. A `.vendor-key` file in each corpus holds a hash of the recipe: the
files that `RECIPE` in `vendor.mjs` lists. When the hash matches, the script fetches nothing. A
lock file lets one process vendor at a time, so a second process waits and then finds the corpora
current. CI caches both corpora under the hash that `node scripts/vendor-godot-demos.mjs --key`
prints.

`scripts/vendor-prune.mjs` removes the editor artefacts, the source art and each import sidecar the
previewer does not read (ADR-0028).

## Local changes

The script applies these to the checkout before the prune:

- `text-resources/` holds the Godot text copy of 38 binary resources (`.res`, `.mesh`, `.scn`).
  Each copy replaces the binary file of the same stem, because the only binary resource the
  previewer reads is a lightmap bake (`.lmbake`) (issue #110).
- `local-changes.patch` edits 17 upstream files:
  - 15 scenes and resources point their `ext_resource` paths at the text copies.
  - `3d/decals/decal.tscn` animates `Decal:size`, not the Godot 3 `Decal:extents`, with doubled
    keyframe values (ADR-0017).
  - `3d/truck_town/town/town_scene.tscn` gets a `PreviewCamera`, which frames the town for the
    comparison harness. The truck makes its own camera current at runtime.

## Change a local change

1. Run `git init` in a scratch folder.
2. Fetch the pinned commit into it with `git fetch --depth 1 <url> <commit>`.
3. Run `git checkout FETCH_HEAD`.
4. Copy `text-resources/` over the checkout.
5. Delete each binary resource that a text copy replaces.
6. Commit the result as the base.
7. Apply `local-changes.patch` with `git apply`.
8. Make the change.
9. Write the output of `git diff` to `local-changes.patch`.

To move to a new upstream commit, change `SOURCE.commit` in `vendor.mjs`, then run
`pnpm vendor:demos`. If the patch does not apply, the script names it. Fix the hunks against the
new commit.

## Licence

The code of godot-demo-projects is MIT, Copyright (c) 2014-present Godot Engine contributors,
Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur. The asset licences of each demo vary and are
often CC-BY. Each project keeps its own README.md for attribution. `THIRD-PARTY-NOTICES.md` holds the
full licence text.
