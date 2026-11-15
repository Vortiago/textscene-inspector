# Menu geometry oracle

`oracle.gd` prints the window size, the panel, the scroll container, the item control, the vertical bar and the
contents minimum of a PopupMenu for each of its cases, from Godot 4.6.3 at the default theme scale in a 1152x648
embedder. `menuLayout.test.ts` pins the printed values.

- Run `VK_LOADER_DRIVERS_SELECT='*lvp*' xvfb-run -a -s "-screen 0 1152x648x24" godot --path . main.tscn`.
- Do not use `--headless`. A headless window has a usable rect of 64 px, which limits the menu height wrongly.
