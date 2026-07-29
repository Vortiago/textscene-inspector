# Isometric Dungeon (vendored)

The `2d/isometric` demo from
[godotengine/godot-demo-projects](https://github.com/godotengine/godot-demo-projects)
(master), vendored as the real-game integration corpus for TileMapLayer
rendering (issue #74): four TileMapLayer nodes over an external `.tres`
TileSet with five atlas sources (ISOMETRIC shape, DIAMOND_DOWN layout,
128×64 tiles, authored alternative tiles with flip/transpose).

Vendored via BFS over `ext_resource` refs from `dungeon.tscn` — engine
editor metadata (`*.import`, `project.godot`, screenshots) is omitted.

Because `project.godot` is omitted, this directory is a `res://` root that
carries no marker saying so. `scripts/corpusRoots.mjs` is where that is
declared; anything resolving a `res://` path here reads it from there.

`previews/` is NOT vendored — it is ours. See `previews/README.md`.

License: MIT — Copyright (c) 2014-present Godot Engine contributors,
Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur
(https://github.com/godotengine/godot-demo-projects/blob/master/LICENSE.md).
