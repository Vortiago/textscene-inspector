# 2D/3D selection is a single viewport-mode seam, 3D-default with a 2D-UI hint

One `ViewportModeContext` holds `{ mode: '2D' | '3D', showCollisions }`. `mode` chooses whether the center viewport mounts the R3F `<Canvas>` (3D) or the Control overlay (2D); `showCollisions` drives the collision gizmo. The viewport **defaults to 3D** (matching Godot's own 3D editor viewport, which doesn't show CanvasLayers), overridable by the `<ViewportToolbar>` 3D/2D toggle.

So the 2D overlay stays discoverable without auto-switching, the shell floats a **"switch to 2D" hint over the 3D viewport whenever the scene carries any Control/CanvasLayer node** (`has2DUIContent` + `ViewportArea` in `TscnPreviewShell`); clicking it flips to 2D. (We considered auto-opening Control-rooted scenes in 2D, but a uniform 3D default + hint was chosen — simpler, and it never surprises the user.) The two modes never composite into one view.

Mode is per-session today (the `ViewportModeProvider` default); per-app persistence through a `usePersistedMode()` hook (`localStorage` web / webview state API) is a tracked follow-up.

Recorded because the no-composite decision and the 3D-default-with-hint choice are deliberate product choices a future reader would otherwise question, and both the overlay subsystem and the collision toggle depend on this single seam.

## Amendment (2026-05-31): 2D-canvas content + composited 2D mode

Adding 2D-**canvas** rendering (`Node2D` / `Sprite2D` / `Camera2D`, later `TileMap`) forces a refinement of the seam. Godot's 2D world (CanvasItems drawn by `Node2D` and friends) and its 2D **UI** (`Control`/`CanvasLayer`) are the same canvas — UI draws *above* the world. So a 2D-game scene needs both visible together, which the original "two modes never composite" rule forbade.

**Decision:**
- The R3F `<Canvas>` renders ALL CanvasItem **world** content (`Node2D`, `Sprite2D`, …) through the existing `NodeDispatcher`, on the `z=0` plane using Godot 2D conventions: 1 world unit = 1 pixel, `+X` right, `+Y` **down** (negated into three.js's `+Y`-up), and `z_index` + tree order driving draw order (render order + a small `z` step). Control/CanvasLayer UI stays in the mature DOM overlay (ADR-0003) — it is **not** re-rendered in the canvas.
- **Viewport mode now selects the camera and the overlay composition**, not "canvas xor overlay":
  - **3D mode** — perspective orbit camera; canvas only. (unchanged)
  - **2D mode** — an **orthographic** camera framing the 2D world (fit-to-content, or driven by a `Camera2D` when present), with the Control DOM overlay **composited on top** of the canvas. This **supersedes** the original "two modes never composite" rule, but only for 2D mode, and only to layer UI over world (matching Godot). Control-only scenes are unaffected: the canvas simply renders no world content behind the overlay.
- The discoverability predicate widens from `has2DUIContent` → `has2DContent`: the "switch to 2D" hint (and the 2D path) now also fire for non-Control 2D content (`Node2D`/`Sprite2D`), so a 2D game opened in the default 3D view advertises 2D mode.
- **Deferred:** `AnimatedSprite2D` (needs `SpriteFrames` sub-resource parsing — larger and differently shaped than a static `Sprite2D` quad) ships as a follow-up; the first increment is `Node2D` + `Sprite2D` + `Camera2D`. `TileMap` is a later best-effort pass.

**Why:** it matches Godot's CanvasItem model (UI is 2D drawn over the 2D world), reuses the existing Control overlay instead of duplicating UI rendering in the canvas, and unlocks the entire 2D-game scene category — the largest breadth gap in the renderer (3D is ~100% for ld-58; 2D-canvas was structurally unrendered: the `node2d`/`sprite2d`/`camera2d` slices were linter-only, no render component).
