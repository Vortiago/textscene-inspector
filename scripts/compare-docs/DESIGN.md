# Godot comparison sheets: capture design

The capture renders a fixture here and in Godot from **the same camera** (3D) or
into **the same rectangle** (2D), so a pixel at (x, y) addresses the same surface
point in both images. A sheet is one terse markdown file per node or resource
type, built from the existing fixtures. `SHEET-STANDARD.md` sets the sheet's
shape. This document is about the capture.

## The 3D contract: both sides open where Godot's editor opens

The previewer opens every scene at Godot's editor camera
(`Node3DEditorViewport::Cursor()`: fixed orbit, distance 4, fov 70), and the
reference harness does the same, so:

    pnpm ref:godot scenes/fixtures/<scene>.tscn --out godot.png
    pnpm ref:ours  <scene>.tscn --out ours.png

produce the same frame with no camera arguments on either side.
`--probe x,y --patch 5` prints the per-channel median of a patch on either side,
in the same format.

A 2D scene needs no camera arguments either, but a different frame. See the 2D
contract below (`ref:godot` detects it, `ref:ours --2d`).

Two flags cover the rest:

- `--frame` (both harnesses) fits the scene's geometry bounds the way
  `frameSceneBounds.ts` does, the previewer's opt-in "frame on open", for a
  scene too large to read at distance 4.
- `--scene-camera` (Godot side) renders through a scene's own `Camera3D`. It is
  off by default, because the previewer ignores the scene camera too. Godot's
  editor keeps its free camera and draws the node as a frustum gizmo.

Bounds are geometry-first and load-bearing only for `--frame`. They exclude
`Light3D`, a `VisualInstance3D`, because a sun 5 units above a flat plane would
otherwise move the centre by 3 units.

The viewport navigates like Godot's editor rather than like a web viewer
(ADR-0029, `GodotEditorControls.tsx`, maths in `godotEditorCursor.ts`). Left-drag
stays free for selection, as in Godot. drei remains a dependency for `Text` only.

## What the matched frames depend on

Parity of the matched frames depends on four settings: the energy scale
(`LIGHT_INTENSITY_SCALE` is π, not 2), ambient that is not flat, the sky
shader's energy, and the default material that a mesh without a material gets.
Measure the remaining gap with `pnpm ref:godot`, not from a stored figure.

Two traps produce a confident wrong picture:

- A bare `Camera3D.new()` defaults to **fov 75**. The editor viewport uses
  `editors/3d/default_fov` = **70**. The difference is a silent zoom in every
  frame, and it makes the horizon look 25/255 off when the sky curve is right.
- `ref:ours` with `VISUAL_SKIP_BUILD=1` on a fixture that the bundle predates
  does not fail. The deep link falls back to another scene and renders something
  plausible. Build for every new fixture.

## The 2D contract: a rectangle, not a camera

A 2D scene has no camera to agree on. Godot draws it through the canvas
transform into the **project viewport** rectangle, and a `Control` resolves its
anchors against that rectangle. The frame size is part of the picture, not a
capture setting. Both sides therefore render that rectangle, 1:1:

- **Godot** instantiates the scene into a `SubViewport` the size of the project
  viewport (`display/window/size/viewport_*`, default
  `CANVAS_2D_WIDTH × CANVAS_2D_HEIGHT`, 1152×648, `viewport2d.ts`), with no
  `Camera3D`, no preview sun and no preview environment. Those belong to
  `Node3DEditor`, and 2D lighting is the scene's own business. `run.mjs` picks
  that path from the scene root (`is CanvasItem`, plus `CanvasLayer`), the rule
  that `workspaceForScene.ts` mirrors. `--mode 2d|3d` forces it.
- **Ours** opens the 2D stage at zoom 1, with the world origin at the stage
  origin (`tsi.fitOnOpen2D=false`, the 2D counterpart of frame-on-open). It
  paints out the stage's chrome (grid, viewport outline and dimension label,
  origin axes, the pan/zoom hint, the zoom HUD) and clips the screenshot to the
  frame element. Controls and a Node2D world both draw in the WebGL canvas
  (ADR-0037), so one capture holds the whole picture.
- **Backgrounds** are pinned to the same grey. Godot clears a 2D viewport to
  `default_clear_color` (0.3, which lands as `#4c4c4c`, because 2D composites in
  sRGB with no transfer applied), and the capture flattens our editor background
  to it. Without that, every transparent pixel of the scene differs.
- **A scene's `Camera2D` is ignored** on both sides, for the same reason the 3D
  path ignores `Camera3D`: Godot's editor keeps its own view. The reference
  disables each `Camera2D` before the subtree enters the tree, because a camera
  that has already claimed the viewport leaves its offset behind.

**Godot decides whether a fixture is 2D or 3D**, because it knows its own class
hierarchy. Our side must agree. `capture.mjs` asks the page which workspace it
opened (`readViewportMode`) and fails the pair when the two differ, rather than
pair two differently framed images. `findCanvas2DFrame` rejects a frame that is not
its declared project-viewport rectangle at one uniform scale of 1 or less, a
frame whose origin is fractional, and a frame the stage clips. Each of those
failures otherwise still produces a plausible picture.

The 2D frame cannot show what the 3D one cannot either: **editor gizmos**. The
reference renders the game, so a fixture whose only content is a
CollisionShape2D outline, a Marker2D cross, a Path2D curve or an
AudioStreamPlayer2D icon comes back empty from Godot. It comes back empty from
us too, since those are selection-gated or toggle-gated here, so the pair is two
agreeing empty frames. `unit-navigation-region-2d` is the exception: it shows our
navmesh overlay (toolbar-toggled, on by default) against Godot's empty frame. A
gizmo comparison needs the editor, not a render, and is out of this tool's reach.

The 2D capture uses a **wider browser viewport** (1600×900) than the 3D one,
because the frame must fit inside the stage at zoom 1. A project viewport larger
than the default widens the window further, and the window never shrinks below
the default. Every part of the 2D capture is opt-in
(`createCaptureContext({ canvas2D: true })`), because the golden gate captures 2D
scenes with the chrome and at the fitted zoom.

## Document shape

`SHEET-STANDARD.md` is the authority. A sheet has three parts and nothing else:
an intro under the `#` heading (what the node is and what the previewer draws), a
generated `## Linting` block with hand-written lenient-parser prose below it, and
`## Known limitations` (tagged bullets, one per real divergence, omitted when
there is none). A sheet with several visually distinct features splits into `##`
sections, each with one fixture and one `<!-- compare: … -->` marker. There is no
property table, no pixel-by-pixel comparison and no engine explanation. The sheet
is the home for a limitation. Never link a separate file.

Corpus counts never justify an omission. "No fixture covers this property" is a
gap to fill, not a note to write.

## Fixture quality: the rule for a fixture that earns a sheet

A fixture that renders an empty frame documents nothing. Every fixture behind a
sheet must show the node doing its job, judged against real Godot. The policy,
in order of preference:

1. **Missing fixture**: create one. A visual node type with no fixture that
   demonstrates it gets one, in the house style of its sibling fixtures (6×6
   ground at y=−1, a 1×1 reference box, content within ±2 of origin).
2. **Fixture that shows the node poorly** (the AreaLight3D case, a light with
   nothing to light): rewrite it to demonstrate the effect, and mirror its
   siblings so the family stays comparable.
3. **Content that does not fit at the editor camera**: first move or scale the
   elements toward the origin, if that does not distort what the fixture tests.
   Only if that is not viable, author one or more `Camera3D` nodes and capture
   from them (Godot with `--scene-camera`, ours by activating that camera). A
   camera is the fallback, because both renderers ignore scene cameras by
   default and a camera makes the two sides depend on agreeing again.
4. **A node whose whole point is motion** (AnimationPlayer, and anything it
   drives): capture a short GIF of it on both sides rather than a still, so the
   sheet shows the animation playing.

A node with no runtime visual in Godot (Timer, RemoteTransform's own body, an
editor-only navmesh debug draw) is exempt. Its sheet says so in one line, and no
geometry is invented to fake a picture.
