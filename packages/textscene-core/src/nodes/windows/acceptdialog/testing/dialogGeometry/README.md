# Dialog geometry oracle

`oracle.gd` and `sceneOracle.gd` print the rect of each internal Control of an AcceptDialog and a
ConfirmationDialog in window space, from Godot 4.6.3 at the default theme scale. `dialogLayout.test.ts`
pins the printed rects.

- `godot --headless --path . main.tscn` runs `oracle.gd` over its built-in cases.
- `godot --headless --path . sceneOracle.tscn -- A C` runs `sceneOracle.gd` over the scenes `scn/A.tscn` and `scn/C.tscn`.
