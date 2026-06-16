# 2D/3D selection is a single viewport-mode seam, 3D-default with a 2D-UI hint

One `ViewportModeContext` holds `{ mode: '2D' | '3D', showCollisions }`. `mode` chooses whether the center viewport mounts the R3F `<Canvas>` (3D) or the Control overlay (2D); `showCollisions` drives the collision gizmo. The viewport **defaults to 3D** (matching Godot's own 3D editor viewport, which doesn't show CanvasLayers), overridable by the `<ViewportToolbar>` 3D/2D toggle.

So the 2D overlay stays discoverable without auto-switching, the shell floats a **"switch to 2D" hint over the 3D viewport whenever the scene carries any Control/CanvasLayer node** (`has2DUIContent` + `ViewportArea` in `TscnPreviewShell`); clicking it flips to 2D. (We considered auto-opening Control-rooted scenes in 2D, but a uniform 3D default + hint was chosen — simpler, and it never surprises the user.) The two modes never composite into one view.

Mode is per-session today (the `ViewportModeProvider` default); per-app persistence through a `usePersistedMode()` hook (`localStorage` web / webview state API) is a tracked follow-up.

Recorded because the no-composite decision and the 3D-default-with-hint choice are deliberate product choices a future reader would otherwise question, and both the overlay subsystem and the collision toggle depend on this single seam.

## Amendment (2026-05-31): 2D-canvas content + composited 2D mode

Adding 2D-**canvas** rendering (`Node2D` / `Sprite2D` / `Camera2D`, later `TileMap`) forces a refinement of the seam. Godot's 2D world (CanvasItems drawn by `Node2D` and friends) and its 2D **UI** (`Control`/`CanvasLayer`) are the same canvas — UI draws *above* the world. So a 2D-game scene needs both visible together, which the original "two modes never composite" rule forbade.

**Decision (staged):**
- The R3F `<Canvas>` renders ALL CanvasItem **world** content (`Node2D`, `Sprite2D`, `Camera2D`, …) through the existing `NodeDispatcher`, on the `z=0` plane using Godot 2D conventions: 1 world unit = 1 pixel, `+X` right, `+Y` **down** (each local transform conjugated by `diag(1,-1,1)` so it composes through nesting and renders right-side-up), and `z_index` + tree order driving draw order (a small `+z` step). Control/CanvasLayer UI stays in the mature DOM overlay (ADR-0003) — it is **not** re-rendered in the canvas.
- **V1 (shipped):** 2D-canvas content renders in the **shared** canvas alongside 3D. The default-camera fit detects a **flat** scene (z-extent ≈ 0) and frames it **front-on** (looks down `-Z`, `+Y` up) instead of the 3D isometric angle, so a 2D scene reads flat and upright (a far perspective camera viewing a plane is visually ortho-equivalent). "2D mode" is **unchanged** — still the Control DOM overlay only — so the original "two modes never composite" rule still holds. A 2D game's *world* shows in the default (canvas) view; its Control *HUD* shows via "switch to 2D".
- **Deferred refinements:** (a) a dedicated **orthographic** 2D viewport mode that composites the Control overlay *over* the 2D world (true ortho projection + UI-over-world; would relax "never composite" for that mode), optionally driven by a `Camera2D`'s position/zoom (the `Camera2D` Component already tags `userData.camera2d` for this); (b) widening the discoverability predicate `has2DUIContent` → `has2DContent` (only once 2D mode can show canvas content, else a canvas-only scene's hint would flip to a blank overlay); (c) `AnimatedSprite2D` (needs `SpriteFrames` sub-resource parsing); (d) `TileMap` best-effort.

**Why:** it matches Godot's CanvasItem model, reuses the existing Control overlay instead of duplicating UI rendering, and unlocks the entire 2D-game scene category — the largest breadth gap in the renderer (3D is ~100% for ld-58; 2D-canvas was structurally unrendered: the `node2d`/`sprite2d`/`camera2d` slices were linter-only). Front-on framing delivers most of the visual benefit at a fraction of the shell risk; the ortho-composite mode is layered on later.

## Amendment (2026-06-11): Godot-editor workspace parity

Vendoring the godot-demo-projects corpus surfaced how confusing the V1 staging was at scale: 2D game scenes rendered in the tab labeled "3D" while the "2D" tab stayed blank, and 3D scenes with Control HUDs were told to "switch to 2D". Researched against the actual Godot editor (CanvasItemEditorPlugin / Node3DEditorPlugin `handles()` rules, editor docs) and aligned with it:

- **The 3D workspace renders Node3D content only.** CanvasItem subtrees are dropped by the workspace-aware `NodeDispatcher` (`CanvasWorkspaceContext`, default `'3d'`; classification comes from the slice registrations' `canvasItem`/`container` flags + `TWO_D_UI_TYPES`). This supersedes V1's "2D world in the shared canvas"; the flat-scene front-on framing remains for genuinely flat 3D scenes.
- **The 2D workspace composites the whole CanvasItem world** — `Canvas2DStage` layers the project-viewport frame, a transparent **orthographic** `World2DCanvas` (sprites/tilemaps/Node2D trees; camera glued to the stage pan/zoom via `world2DCameraPose`), and the Control DOM overlay on top — Godot's 2D editor order. This delivers deferred refinement (a); "never composite" is fully retired.
- **The workspace auto-selects from the scene root's type** (`WorkspaceAutoSelect` + `workspaceForRoot`): CanvasItem root → 2D, Node3D root → 3D, plain `Node` root → keep current (Godot: no plugin claims it). A manual toggle holds until the next scene switch. This supersedes the original "no auto-switching" choice — with ~100 vendored 2D demos the uniform-3D default surprised users constantly.
- The hint widened per deferred refinement (b): `hasCanvasContent` (UI **or** 2D world nodes) → "Has 2D content — switch to 2D", shown only in the 3D workspace for mixed scenes (Godot has no such affordance; kept as a previewer nicety).

Out of scope, recorded: viewport picking inside the 2D world canvas (the stage's drag-to-pan owns pointer input; `pointer-events: none` on the world layer), and `Camera2D`-driven framing (the `userData.camera2d` tag still awaits a consumer).
