# Godot comparison sheets — capture design

Per-node-type markdown showing how a fixture renders here versus in Godot, from
**the same camera**. One file per supported visual node type, terse, built from
the fixtures that already exist.

## The problem this solves first

Cross-renderer screenshots are worthless unless both sides frame identically.
Until both harnesses defaulted to the same camera, every measurement was
caveated — a pixel at (x, y) meant different things in each image, and only
view-independent quantities (the colour of a flat lit surface) survived.

## The approach — both sides open where Godot's editor opens

There is nothing to derive. The previewer opens every scene at Godot's editor
camera (`Node3DEditorViewport::Cursor()` — fixed orbit, distance 4, fov 70), and
the reference harness now does the same, so:

    pnpm ref:godot scenes/fixtures/<scene>.tscn --out godot.png
    pnpm ref:ours  <scene>.tscn --out ours.png

produce the same frame with no camera arguments on either side, and a probe at
(x, y) addresses the same surface point in both. `--probe x,y --patch 5` prints
the per-channel median of a patch on either side, in the same format.

Two flags cover the rest:

- `--frame` (both harnesses) fits the scene's geometry bounds the way
  `frameSceneBounds.ts` does — the previewer's opt-in "frame on open" — for a
  scene too large to read at distance 4.
- `--scene-camera` (Godot side) renders through a scene's own `Camera3D`. Off by
  default, because the previewer ignores it too: Godot's editor keeps its free
  camera and draws the node as a frustum gizmo.

An earlier design derived one camera from `--emit-bounds` and drove the
previewer's **Use This Camera** button to match it. That is no longer needed, and
it was fragile in a way worth remembering: two framing rules that must agree, and
no way to see when they stop agreeing. They did stop — `--emit-bounds` unioned
every `VisualInstance3D`, and `Light3D` is one, so a sun 5 units above a flat
plane moved the derived centre by 3 units. Bounds are geometry-first now, and are
only load-bearing for `--frame`.

## What the matched frames measured

Whole-frame mean difference, both sides at the default camera:

| Fixture | Mean Δ /255 |
| --- | --- |
| `unit-light-transport-direct` | 0.204 |
| `unit-light-transport-ambient` | 0.692 |
| `unit-light-transport-sky` | 0.319 |
| `unit-light-transport-sky-graded` | 1.142 |
| `unit-preview-lighting` (held out) | 1.455 |

Two traps this exposed, both of which produced confident wrong pictures:

- A bare `Camera3D.new()` defaults to **fov 75**; the editor viewport uses
  `editors/3d/default_fov` = **70**. A silent zoom difference in every frame, and
  it manufactured a false lead — the horizon looked 25/255 off and the sky curve
  was suspected, when the curve had been right all along.
- `ref:ours` with `VISUAL_SKIP_BUILD=1` on a fixture the bundle predates does not
  fail; the deep link falls back to another scene and renders something
  plausible. Always build for a new fixture.

## Order of work (decided)

1. ~~**`LIGHT_INTENSITY_SCALE`**~~ — done, and it was four defects rather than
   one: the energy scale (π, not 2), flat ambient, the sky shader's energy, and
   the default material an unmaterialed mesh gets. See the table above.
2. ~~**Capture harness**~~ — done, as `pnpm ref:ours` beside `pnpm ref:godot`.
3. **Fan out** the 3D sheets.
4. **2D capture path**, then the 2D sheets.

The viewport itself navigates like Godot's editor rather than like a web viewer
(`GodotEditorControls.tsx`, maths in `godotEditorControls.ts`): middle-drag
orbit, shift+middle pan, ctrl+middle and wheel zoom, right-drag freelook with
WASD/QE flying, numpad 1/3/7 view snapping and 5 for orthographic, no damping.
Left-drag is left free for selection, as Godot leaves it. drei remains a
dependency for `Text` only.

## Sequencing

**3D first.** Steps 1–4 work today for anything with a `VisualInstance3D` bound.

**2D after**, because it is a different capture problem, not a variation on this
one:

- Controls are an HTML/CSS overlay (ADR-0003), not canvas pixels — capturing
  them is the `verify-2d` browser path, not `canvas.screenshot()`.
- Our 2D world is a pannable/zoomable stage; Godot's is a `Camera2D` with `zoom`
  and an anchor mode. Matching those is its own derivation.

Building the 3D set first also settles the document format on the easier half.

## Document shape

One file per node type, terse, no narration:

- What the fixture exercises, in a sentence.
- The two images side by side.
- A short table of the properties the fixture sets.
- **Divergences** — only real ones, each with a reason, linking
  `docs/PARITY-LIMITATIONS.md` where one already covers it.

Corpus counts never justify an omission (see `docs/PARITY-LIMITATIONS.md`'s
header); "no fixture covers this property" is a gap to fill, not a note to write.
