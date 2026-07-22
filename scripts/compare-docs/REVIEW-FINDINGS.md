# Comparison-sheet review — findings to resolve

From the owner's first full-gallery review. Each item is investigated (subagent
reads both images + the code + the fixture, decides bug / fixture / capture /
expected), then fixed. `[ ]` open · `[~]` investigating · `[x]` done.

## Gallery / tooling (owned directly, not per-node)

- [ ] **Non-visual indicator + hide the gallery** for node types with no visual
      element. Showing an empty image pair implies something should be there.
      A `visual: false` sheet shows the indicator and NO image comparison.
- [ ] **Sub-categories**: under 2D and 3D, split **Visual** vs **Other**, so the
      nav is 2D-Visual / 2D-Other / 3D-Visual / 3D-Other.
- [ ] **Capture gated things ON, on both sides.** Anything not on by default —
      a navmesh overlay, collision shapes, in-viewport labels, a selection gizmo
      — should be captured with it shown, on BOTH renderers, so the sheet shows
      how each indicates it. Needs per-fixture capture options (toggle/select)
      AND, on the Godot side, the runtime debug equivalent where one exists
      (navigation/collision debug); pure editor-only gizmos may have no Godot
      runtime form — the investigation says which.
- [ ] **Label3D / labels default.** Godot draws Label3D at runtime always; ours
      gates it behind `showLabels` (off), so the sheet reads as "unsupported".
      Match Godot: labels on by default (or at least captured on).

## Node bugs / issues (investigate → fix)

- [ ] **MeshInstance3D — torus orientation** (also found pre-review). Godot's
      TorusMesh revolves around Y (XZ plane); three's torusGeometry around Z
      (XY plane), passed through unrotated → ours stands upright where Godot
      lies flat. Likely affects other primitives with an axis convention.
- [ ] **AnimationTree** — cube position differs; possible orientation/flip.
- [ ] **CollisionShape3D** — very different; needs a look. (Shares
      unit-rigidbody3d; also relates to the "show collisions ON" item.)
- [ ] **Camera3D** — uses the DECAL fixture. Needs its own fixture with multiple
      cameras.
- [ ] **DirectionalLight3D** — shadow difference; Godot looks like it has no
      shadow in that fixture. Investigate.
- [ ] **Path3D** — comparison looks like a bug.
- [ ] **PathFollow3D** — needs a better visual; currently shares Path3D's
      fixture/image. Give it a distinct fixture that shows the follower.
- [ ] **RigidBody3D** — comparison shows an issue/bug.
- [ ] **NavigationRegion3D** — change so both sides show the navmesh ON (see the
      gated-ON item); same default as Godot.
- [ ] **AnimatedSprite2D** — positioned wrong; does not look animated.
- [ ] **GridContainer** — rendered quite differently.
- [ ] **HBoxContainer** — check alignment.
- [ ] **OptionButton** — not 100% aligned with Godot.
- [ ] **PanelContainer** — positioned differently vs Godot.
- [ ] **PathFollow2D** — elements positioned differently vs Godot.
- [ ] **Sprite2D** — fixture/camera so the sprite is actually visible.
- [ ] **TileMap** — move camera/fixture so the map is legible.
- [ ] **TileMapLayer** — same.
- [ ] **2D styling in general** — bring closer to default Godot Control theme
      (spans GridContainer/HBox/OptionButton/Panel and the Control set).

## Investigation verdicts (2026-07-22)

**Code bugs (renderer):**
- MeshInstance3D torus — three's TorusGeometry is XY-plane (hole +Z), Godot's is
  XZ-plane (hole +Y). Fix: `geom.rotateX(Math.PI/2)` in meshGeometry.tsx. Check
  the other primitives for the same axis gap.
- GridContainer — missing `align-content`; grid stretches. Add `alignContent:'start'`.
- HBoxContainer — Labels pin to TOP; Godot vertical-centres them. Default the
  Label vertical size flag to SHRINK_CENTER(4) in label/parser.ts.
- OptionButton — dropdown chrome colours don't match Godot's default theme.

**Styling (systematic):** no shared default-theme module; each Control hardcodes
"default chrome" that misses Godot's default_theme. Introduce one
`godotDefaultTheme.ts` and have Controls consume it.

**Harness — the reference runs the GAME during `_settle()`** (6 process frames),
so physics bodies FALL and active AnimationTrees/autoplay ADVANCE. This is the
root of three "bugs": RigidBody3D (falls), CollisionShape3D (sibling falls),
AnimationTree (mid-anim pose). Fix: before settle, recursively freeze
RigidBody3D and deactivate AnimationTree/stop autoplay so the reference is the
static authored pose, matching our previewer.

**Capture-config (toggle ON):**
- Label3D — Godot draws it at runtime always; ours gates it (showLabels off).
  Default showLabels ON (user-requested), rebaseline.
- NavigationRegion3D — capture Godot with runtime nav debug so both show the
  navmesh; our overlay is already on.

**Fixture fixes:**
- Camera3D — wrong fixture (Decal). Own fixture; repoint plan.json.
- Path3D — own fixture (stops sharing PathFollow3D) with marker geometry.
- PathFollow3D — progress_ratio is a no-op at instantiation; place the follower
  visibly (script or transform).
- Sprite2D — no Camera2D; origin at viewport top-left. Centre it (576,324).
- TileMap / TileMapLayer — tiles tiny in the corner; enlarge + centre / fill frame.
- PanelContainer — anchors_preset without layout_mode=1 is inert; use explicit anchors.
- AnimatedSprite2D — position agrees; make it read as animated (frames/GIF).

**Expected-no-fix (documented):** DirectionalLight3D (shadow cast but occluded
from this camera), PathFollow2D (progress_ratio divergence is real + intended).
