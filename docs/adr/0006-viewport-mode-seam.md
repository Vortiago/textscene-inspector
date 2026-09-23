# 2D/3D selection is a single viewport-mode seam, 3D-default with a 2D-UI hint

One `ViewportModeContext` holds `{ mode: '2D' | '3D', showCollisions }`. `mode` chooses whether the centre viewport mounts the R3F `<Canvas>` (3D) or the Control overlay (2D). `showCollisions` drives the collision gizmo. The overlay subsystem and the collision toggle both depend on this one seam. The viewport **defaults to 3D**, like Godot's own 3D editor viewport, which does not show CanvasLayers. The 3D/2D toggle in `<ViewportToolbar>` overrides it.

To keep the 2D overlay discoverable without an automatic switch, the shell floats a **"switch to 2D" hint over the 3D viewport when the scene carries a Control/CanvasLayer node** (`has2DUIContent` plus `ViewportArea` in `TscnPreviewShell`). A click on it flips to 2D. Rejected: opening Control-rooted scenes in 2D automatically. A uniform 3D default plus hint was simpler. The workspace-parity amendment below replaces this choice with auto-selection from the root type. The two modes never composite into one view.

The mode persists across sessions in `localStorage`. A typed scene root still wins over the persisted preference (see the workspace-parity amendment).

## Amendment: 2D-canvas content and a composited 2D mode

Godot's 2D world (CanvasItems drawn by `Node2D` and its subclasses) and its 2D **UI** (`Control`/`CanvasLayer`) share one canvas, and the UI draws *above* the world. A 2D-game scene needs both visible together, which the "two modes never composite" rule forbade.

**Decision:**

- CanvasItem **world** content (`Node2D`, `Sprite2D`, `Camera2D`, `TileMap`, …) renders through the `NodeDispatcher` on the `z=0` plane in Godot 2D conventions. One world unit is one pixel, `+X` is right and `+Y` is **down**: each local transform is conjugated by `diag(1,-1,1)`, so it composes through nesting and renders right side up. `z_index` plus tree order drive draw order (a small `+z` step). Control/CanvasLayer UI stays in the DOM overlay (ADR-0003) and is not rendered again in the canvas.
- The default-camera fit detects a **flat** scene (z-extent near 0) and frames it **front-on** (looking down `-Z`, `+Y` up) instead of at the 3D isometric angle, so a flat scene reads upright. A far perspective camera that views a plane looks orthographic.
- This first stage rendered 2D-canvas content in the shared 3D canvas and kept 2D mode as the overlay only. The workspace-parity amendment below replaces that with a composited orthographic 2D workspace and a hint predicate widened to all 2D content. `AnimatedSprite2D` came with ADR-0015. `TileMap` is best-effort.

**Why:** it matches Godot's CanvasItem model, reuses the Control overlay instead of a second UI renderer, and opens the whole 2D-game scene category, which was the largest breadth gap in the renderer. Front-on framing gives most of the visual benefit at a fraction of the shell risk.

## Amendment: Godot-editor workspace parity

The workspaces follow the Godot editor (the `handles()` rules of CanvasItemEditorPlugin and Node3DEditorPlugin, and the editor docs):

- **The 3D workspace renders Node3D content only.** The workspace-aware `NodeDispatcher` (`CanvasWorkspaceContext`, default `'3d'`) drops CanvasItem subtrees. Classification comes from the `canvasItem`/`container` flags of the slice registrations plus `TWO_D_UI_TYPES`. The front-on framing stays for flat 3D scenes.
- **The 2D workspace composites the whole CanvasItem world.** `Canvas2DStage` layers, in the order of Godot's 2D editor, the project-viewport frame and a transparent **orthographic** `World2DCanvas` (sprites, tilemaps and Node2D trees). The world camera follows the stage pan/zoom through `world2DCameraPose`. "Never composite" is retired.
- **The workspace selects itself from the type of the scene root** (`WorkspaceAutoSelect` plus `workspaceForRoot`). A CanvasItem root selects 2D, a Node3D root selects 3D, and a plain `Node` root keeps the current workspace (in Godot no plugin claims it). A manual toggle holds until the next scene switch. This replaces the "no automatic switch" choice: a uniform 3D default surprised users on every 2D scene.
- The hint predicate is the live-tree `useLiveSceneNodes(isCanvasItemNode)`: UI **or** 2D world nodes, instanced sub-scenes included. It shows the `Has 2D content — switch to 2D` hint only in the 3D workspace and only for mixed scenes. Godot has no such affordance. It is a previewer convenience.

Out of scope: viewport picking inside the 2D world canvas. The drag-to-pan of the stage owns pointer input, with `pointer-events: none` on the world layer.

`Camera2D`-driven framing has **one** consumer. The 2D pass of a **sub-viewport** frames through the current Camera2D in its own subtree (`selectViewportCamera2D` / `orthoFrameForCamera2D`, reusing `camera2DView`). The **stage** frames fit-to-content. There the pan/zoom pose belongs to the user, and a Camera2D must yield to a manual pan, which is a UX decision this ADR has not taken. So `userData.camera2d` is a live contract for the offscreen pass and a deferral for `Canvas2DStage`.

Which camera is current is the inverse of the 3D rule: `camera_2d.cpp`'s `NOTIFICATION_ENTER_TREE` claims the viewport only `if (!_is_editing_in_editor() && enabled && !viewport->get_camera_2d())`, so the first enabled Camera2D in tree order wins. `Viewport::_camera_3d_set` overwrites, so the last current Camera3D wins.

## Consequence of ADR-0037: the UI layer of the 2D workspace is inside the canvas

Control/CanvasLayer subtrees draw as native canvas items *inside* `World2DCanvas`, in the same tree-order draw as the 2D world, not as a DOM sibling stacked above it. `Canvas2DStage` layers the project-viewport frame around that one canvas. The 2D workspace composites like Godot: one CanvasItem tree, one draw order. The DOM/WebGL split could only approximate this: an opaque Control drawn *behind* world content covered the whole canvas whatever the tree order.
