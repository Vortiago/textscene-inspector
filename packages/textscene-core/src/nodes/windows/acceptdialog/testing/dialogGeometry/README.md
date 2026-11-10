# Dialog geometry oracle

`oracle.gd` and `oracle2.gd` print the rect of each internal Control of an AcceptDialog and a
ConfirmationDialog in window space, from Godot 4.6.3 at the default theme scale. `main.tscn` runs
`oracle.gd`, and `main2.tscn` runs `oracle2.gd`. `dialogLayout.test.ts` pins the printed rects.

Run `godot --headless --path . main.tscn` in this folder.
