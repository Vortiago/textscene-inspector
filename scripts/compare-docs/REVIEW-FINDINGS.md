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
