# Core's renderer code imports down its layers

- Status: Accepted.
- Related: ADR-0006 (the viewport mode), ADR-0091 (the editor camera is a node of the view).

## Context

Godot's editor stands on the engine. The 3D and 2D editors are in `editor/scene/`
(`node_3d_editor_plugin.cpp`, `canvas_item_editor_plugin.cpp`). A game build leaves `editor/` out,
so a `scene/` file includes an editor header only under `TOOLS_ENABLED` (`control.cpp:47-48`).

Core's `r3f/` held the editor's camera, its keys and its 2D stage beside the code that draws the
scene, with no folder of their own. A module that draws the scene could import the editor, and the
view's provider stack lived in the previewer's folder. Nothing stopped a new import that crosses
upward.

## Decision

**A module of core imports only from its own layer and from the layers below it.** The layers,
lowest first:

| Layer | Holds | Path in `packages/textscene-core/src/` |
| --- | --- | --- |
| Scene and View | The parse, the scene, the loader, and the code that draws a frame | Every path not below |
| Editor view | The editor camera and its navigation, Godot's view keys, the 3D and 2D editor stages | `r3f/editorView/` |
| Renderer entry | `TscnCanvas`, `mountScene` and the entry `@textscene/renderer` bundles | `r3f/TscnCanvas.tsx`, `r3f/mountScene.tsx`, `r3f/renderer.ts` |
| Previewer | The shell and its panels | The shell and panel folders in `r3f/components/` |
| Core entry | The entries of `@textscene/core` | `index.ts`, `r3f/index.ts` |

The ESLint rule `layers/import-down` (`scripts/layers/layers.mjs`) holds the table. It checks
each `import`, `export … from` and `import()` of a relative path, and reports one that names a
higher layer. A test, a testkit and a `testing/` folder mount any layer, so the rule skips them.

- The editor view reaches the drawing code through what that code takes: the 2D world takes the
  2D editor's parts as children, and the renderer entry gives the view's answers the editor camera.
- The view's provider stack is `r3f/viewProviders.tsx`. The shell mounts the same stack.
- A node's edit rect stays in its slice, as `_edit_get_rect` is a member of Godot's `CanvasItem`
  (`canvas_item.h:258`).
- A node's gizmo stays in its slice too, and the `show` keys turn it off. Godot's node holds its
  gizmos (`node_3d.h:164-165`), but the code that draws one is in `editor/scene/3d/gizmos/`.

## Consequences

- An import from the drawing code into the editor fails `pnpm lint`, with the two layers named.
- The Scene shares the lowest layer with the View, since `resources/` imports `r3f/`. The two
  become layers of their own when the loader moves to `@textscene/tscn`.
- The previewer folders move into their own package with the shell. The table then loses the
  Previewer row.
