# FileDialog geometry oracle

`oracle.gd` prints the window size, the title and the rect of each visible Control of a FileDialog, in
tree order, for each of its 30 cases. It runs in Godot 4.6.3 at the default theme scale. `oracle.out.json`
holds the printed result, and `body.test.ts` pins the previewer's layout to it.

- `godot --headless --path . main.tscn` runs every case and prints `ORACLE <json>` as its last line.
- `godot --headless --path . main.tscn -- open save` runs the cases `open` and `save` only.
