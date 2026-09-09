# Godot comparison sheets: capture design

Per-node-type markdown showing how a fixture renders here versus in Godot, from
**the same camera** (3D) or into **the same rectangle** (2D). One file per node
or resource type, terse, built from the fixtures that already exist. The sheet's
shape is `SHEET-STANDARD.md`. This document is about the capture.

## The problem this solves first

Cross-renderer screenshots are worthless unless both sides frame identically.
Until both harnesses defaulted to the same camera, every measurement was
caveated. A pixel at (x, y) meant different things in each image, and only
view-independent quantities (the colour of a flat lit surface) survived.

## The approach: both sides open where Godot's editor opens

There is nothing to derive. The previewer opens every scene at Godot's editor
camera (`Node3DEditorViewport::Cursor()`: fixed orbit, distance 4, fov 70), and
the reference harness does the same, so:

    pnpm ref:godot scenes/fixtures/<scene>.tscn --out godot.png
    pnpm ref:ours  <scene>.tscn --out ours.png

produce the same frame with no camera arguments on either side, and a probe at
(x, y) addresses the same surface point in both. `--probe x,y --patch 5` prints
the per-channel median of a patch on either side, in the same format.

That is a 3D scene. A 2D one needs no camera arguments either, but a different
frame. See the 2D contract below (`ref:godot` detects it, `ref:ours --2d`).

Two flags cover the rest:

- `--frame` (both harnesses) fits the scene's geometry bounds the way
  `frameSceneBounds.ts` does, the previewer's opt-in "frame on open", for a
  scene too large to read at distance 4.
- `--scene-camera` (Godot side) renders through a scene's own `Camera3D`. Off by
  default, because the previewer ignores it too. Godot's editor keeps its free
  camera and draws the node as a frustum gizmo.

An earlier design derived one camera from `--emit-bounds` and drove the
previewer's **Use This Camera** button to match it. That is no longer needed, and
it was fragile in a way worth remembering: two framing rules that must agree, and
no way to see when they stop agreeing. They did stop. `--emit-bounds` unioned
every `VisualInstance3D`, and `Light3D` is one, so a sun 5 units above a flat
plane moved the derived centre by 3 units. Bounds are geometry-first now, and are
only load-bearing for `--frame`.

The viewport itself navigates like Godot's editor rather than like a web viewer
(ADR-0029, `GodotEditorControls.tsx`, maths in `godotEditorCursor.ts`). Left-drag
is left free for selection, as Godot leaves it. drei remains a dependency for
`Text` only.

## What the matched frames measured

Whole-frame mean difference, both sides at the default camera:

| Fixture | Mean Δ /255 |
| --- | --- |
| `unit-light-transport-direct` | 0.204 |
| `unit-light-transport-ambient` | 0.692 |
| `unit-light-transport-sky` | 0.319 |
| `unit-light-transport-sky-graded` | 1.142 |
| `unit-preview-lighting` (held out) | 1.455 |

Those figures came out of four defects rather than one: the energy scale
(`LIGHT_INTENSITY_SCALE` is π, not 2), flat ambient, the sky shader's energy, and
the default material an unmaterialed mesh gets.

Two traps this exposed, both of which produced confident wrong pictures:

- A bare `Camera3D.new()` defaults to **fov 75**. The editor viewport uses
  `editors/3d/default_fov` = **70**. A silent zoom difference in every frame, and
  it manufactured a false lead: the horizon looked 25/255 off and the sky curve
  was suspected, when the curve had been right all along.
- `ref:ours` with `VISUAL_SKIP_BUILD=1` on a fixture the bundle predates does not
  fail. The deep link falls back to another scene and renders something
  plausible. Always build for a new fixture.

## The 2D contract: a rectangle, not a camera

A 2D scene has no camera to agree on. Godot draws it through the canvas
transform into the **project viewport** rectangle, and a `Control` resolves its
anchors against that rectangle. The frame size is part of the picture, not a
capture setting. Both sides therefore render that rectangle, 1:1:

- **Godot** instantiates the scene into a `SubViewport` of exactly
  `CANVAS_2D_WIDTH × CANVAS_2D_HEIGHT` (1152×648, `viewport2d.ts`), with no
  `Camera3D`, no preview sun and no preview environment. Those are
  `Node3DEditor`'s, and 2D lighting is a scene's own business. `run.mjs` picks
  that path from the scene root (`is CanvasItem`, plus `CanvasLayer`), which is
  the rule `workspaceForScene.ts` mirrors. `--mode 2d|3d` forces it.
- **Ours** opens the 2D stage pinned at zoom 1 with world origin at the stage
  origin (`tsi.fitOnOpen2D=false`, the 2D counterpart of frame-on-open), paints
  out the stage's chrome (grid, viewport outline and dimension label, origin
  axes, the pan/zoom hint, the zoom HUD) and clips the screenshot to the frame
  element. A Control overlay is DOM (ADR-0003) and a Node2D world is WebGL. An
  element-clipped screenshot composites both, so one capture holds the whole
  picture.
- **Backgrounds** are pinned to the same grey. Godot clears a 2D viewport to
  `default_clear_color` (0.3, which lands as `#4c4c4c`, because 2D composites in
  sRGB with no transfer applied), and the capture flattens our editor background
  to it. Without that every transparent pixel of the scene would differ.
- **A scene's `Camera2D` is ignored** on both sides, for the same reason the 3D
  path ignores `Camera3D`: Godot's editor keeps its own view. The reference
  disables them before the subtree enters the tree. A camera that has already
  claimed the viewport leaves its offset behind.

**Which of the two a fixture is comes from Godot**, which knows its own class
hierarchy. Our side then has to agree. `capture.mjs` asks the page which
workspace it opened (`readViewportMode`) and fails the pair when it differs
rather than pairing two differently-framed images. `findCanvas2DFrame`
rejects a frame that is not exactly 1152×648 on whole pixels. Those are the
failures that otherwise still produce a plausible-looking picture.

What this frame cannot show is the same thing the 3D one cannot: **editor
gizmos**. The reference renders the GAME, so a fixture whose only content is a
CollisionShape2D outline, a Marker2D cross, a Path2D curve or an
AudioStreamPlayer2D icon comes back empty from Godot, and empty from us too,
since those are selection-gated or toggle-gated here. Such a pair is two agreeing
empty frames. `unit-navigation-region-2d` is the exception: it shows OUR navmesh
overlay (toolbar-toggled, on by default) against Godot's empty one. Comparing a
gizmo needs the editor, not a render, and is out of this tool's reach.

The 2D capture uses a **wider browser viewport** (1600×900) than the 3D one, for
the single reason that the frame must fit inside the stage at zoom 1. Every
piece of it is opt-in (`createCaptureContext({ canvas2D: true })`), because the
golden gate captures 2D scenes WITH the chrome and at the fitted zoom.

## Document shape

`SHEET-STANDARD.md` is the authority. A sheet has three parts and nothing else: an
intro under the `#` heading (what the node is and what the previewer draws), a
generated `## Linting` block with hand-written lenient-parser prose below it, and
`## Known limitations` (tagged bullets, one per real divergence, omitted when there
is none). A sheet with several visually distinct features splits into `##` sections,
one fixture and one `<!-- compare: … -->` marker each. There is no property table,
no pixel-by-pixel comparison, and no engine explanation. The sheet is the home for
a limitation. Never link a separate file.

Corpus counts never justify an omission. "No fixture covers this property" is a gap
to fill, not a note to write.

## Fixture quality: the rule for a fixture that earns a sheet

A fixture that renders an empty frame documents nothing. Every fixture backing a
sheet must actually *show the node doing its job*, judged against real Godot.
Decided policy, in order of preference:

1. **Missing fixture**: create one. A visual node type with no fixture that
   demonstrates it gets one, in the house style its sibling fixtures use (6×6
   ground at y=−1, a 1×1 reference box, content within ±2 of origin).
2. **Fixture that showcases the node poorly** (the AreaLight3D case, a light with
   nothing to light): rewrite it to demonstrate the effect, mirroring its
   siblings so the family stays comparable.
3. **Content that does not all fit at the editor camera**: first move or scale the
   elements toward the origin if that does not distort what the fixture tests.
   Only if that is not viable, author one or more `Camera3D` nodes and capture
   from them (Godot with `--scene-camera`, ours by activating that camera). A
   camera is the fallback, not the first move. Both renderers ignore scene
   cameras by default, and a camera reintroduces the two-sides-must-agree
   coupling the default-camera design removed.
4. **A node whose whole point is motion** (AnimationPlayer, and anything it
   drives): capture a short GIF of it running on both sides rather than a still,
   so the sheet shows the animation actually playing.

A node that genuinely has no runtime visual in Godot (Timer, RemoteTransform's
own body, an editor-only navmesh debug draw) is exempt. Its sheet says so in one
line, and no geometry is invented to fake a picture.
