# Godot demo projects (vendored)

The visual categories (2d/, 3d/, gui/, viewport/) of
[godotengine/godot-demo-projects](https://github.com/godotengine/godot-demo-projects),
vendored as a breadth corpus for previewer QA — every scene is selectable in
the web previewer under the "Godot Demos - …" categories, each project keeping
its own res:// namespace (see the fixture manifest's `root` field).

- Source commit: 419eae0c39be0234d5454ee491b16d938fa12d65
- Vendored by: `scripts/vendor-godot-demos.mjs` (re-run against a fresh
  checkout to update; editor artifacts (*.import, .godot/, screenshots/) and
  source art (*.psd, *.xcf, *.blend) are pruned)
- `2d/isometric` is intentionally absent — it lives at `scenes/isometric/`
  as the TileMapLayer integration corpus (issue #74).

## Local modifications

Kept minimal; a re-vendor must reapply these:

- `3d/decals/decal.tscn` — the `fade`/`RESET` animations targeted the removed
  Godot 3 `Decal:extents` property (this 4.6 demo was never updated after the
  4.0 `extents`→`size` rename, so its grow never plays in Godot 4 either).
  Retargeted both tracks to `Decal:size` and doubled the keyframe values
  (`size = 2 × extents`, half-extents→full size). We support Godot 4 `size`,
  not the legacy alias (ADR-0017).

License: code is MIT — Copyright (c) 2014-present Godot Engine contributors,
Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur
(https://github.com/godotengine/godot-demo-projects/blob/master/LICENSE.md).
Per-demo asset licenses vary (often CC-BY) — each project's README.md is kept
verbatim for attribution.
