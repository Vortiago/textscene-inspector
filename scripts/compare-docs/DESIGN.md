# Godot comparison sheets — capture design

Per-node-type markdown showing how a fixture renders here versus in Godot, from
**the same camera**. One file per supported visual node type, terse, built from
the fixtures that already exist.

## The problem this solves first

Cross-renderer screenshots are worthless unless both sides frame identically.
Every measurement taken before this was caveated: Godot renders through the
scene's own `Camera3D`, this previewer frames scene bounds or opens at Godot's
fixed orbit, so a pixel at (x, y) means different things in each image. Only
view-independent quantities (the colour of a flat lit surface) survived.

## The approach — one camera, derived once, handed to both

Proven this session; the pieces exist:

1. **Get the scene's world AABB from Godot.** `pnpm ref:godot <scene> --emit-bounds`
   writes `<out>.bounds.json` next to the render — Godot's own
   `VisualInstance3D.get_aabb()` union, not our estimate of it.
2. **Derive one camera from that AABB.** Godot's editor direction
   (`editorCameraDirection()`, `(0.4207, 0.4794, 0.7702)`), 70° FOV, distance
   fitted to the bounding sphere with a margin. Pure maths, one implementation,
   both consumers.
3. **Godot render:** `pnpm ref:godot <scene> --camera x,y,z --look-at cx,cy,cz`.
   Preview sun/environment inject per the yield rule (ADR-0025) exactly as the
   app applies them, so the lighting matches too.
4. **Our render:** write a temp copy of the fixture into
   `apps/textscene-web/public/fixtures/` with a `Camera3D` injected at that same
   transform, load it in the preview, then select that node in the scene tree and
   click **Use This Camera** — the same path `scripts/visual/run.mjs` already uses
   to click tree rows by `data-node-path`. Screenshot the canvas, delete the temp
   fixture.

   The UI click is required, not laziness: our `Camera3D` parses `current` but
   deliberately does not auto-activate it, because Godot's *editor* does not
   either — it keeps its own free camera and shows the node as a frustum gizmo.

## Validated on two scenes

Derived by hand for `unit-preview-lighting` and `unit-sky-physical`, rendered
both sides from it. Whole-frame mean difference **4.77/255** for
`unit-preview-lighting`.

Getting there exposed a harness bug worth remembering: a bare `Camera3D.new()`
defaults to **fov 75**, while the editor viewport — which is what this previewer
reproduces — uses `editors/3d/default_fov` = **70**. Rendering the reference at
75 against a previewer at 70 is a silent zoom difference in every frame, and it
accounted for most of the earlier mismatch (mean 17.1 → 4.8). It also produced a
false lead: the horizon transition looked 25/255 off and was suspected to be the
`inv_sky_curve` application. It was the FOV. With the FOV matched the sky is
pixel-exact at the zenith and mid-band.

| Region | Ours | Godot | Delta /255 |
| --- | --- | --- | --- |
| Sky at zenith | 184, 190, 198 | 184, 190, 198 | 0 |
| Sky, upper band | 183, 185, 188 | 183, 185, 187 | 0 |
| Horizon transition | 77, 69, 62 | 80, 66, 66 | −3 |
| Lit ground plane | 238, 241, 246 | 227, 229, 233 | **+11** |
| Rough sphere | 164, 170, 182 | 188, 192, 202 | **−24** |
| Inside a shadow | 141, 158, 179 | 107, 122, 143 | **+34** |

The sky itself is done. What remains is the **split between direct light and
IBL**: flat up-facing surfaces and shadowed areas read too bright, curved
surfaces too dark. Prime suspect is `LIGHT_INTENSITY_SCALE = 2` in
`r3f/lightConstants.ts` — an eyeballed constant from before any of this could be
measured, and now measurable. Chase it before writing the sheets, or every 3D
sheet repeats the same divergence.

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
