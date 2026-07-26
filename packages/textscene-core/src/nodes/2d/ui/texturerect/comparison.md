---
type: TextureRect
category: 2D
fixture: unit-texture-rect.tscn
image: unit-texture-rect
renders_as: an HTML img element
---

# TextureRect

A Control that displays a `Texture2D` inside its rect. The previewer loads the
texture into an `<img>` positioned to fill the control's box, with `object-fit`
and `object-position` set from `stretch_mode`.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `anchors_preset` | `15` | full-rect anchors — the control fills the whole viewport |
| `texture` | `ExtResource("1_tex")` | the blue "F" marker sprite is drawn |
| `expand_mode` | `1` (EXPAND_IGNORE_SIZE) | the control ignores the texture's natural minimum size |
| `stretch_mode` | `5` (KEEP_ASPECT_CENTERED) | square texture fits the frame height and centers — grey letterbox on the left and right |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin TextureRect -->
Strict parsing format-checks the inherited set (28 inherited from Control); `TextureRect` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

`TextureRect` has no strict counterpart for `expand_mode`, `stretch_mode`, `flip_h`,
or `flip_v`. `expand_mode` and `stretch_mode` use the optional-int reader, so an
absent or unparseable value becomes `undefined` and each falls through its own
switch's default case at render time. `flip_h` / `flip_v` behave differently: a
present-but-unparseable value collapses to `false` rather than `undefined`, since
`parseOptionalBool` only checks for the literal string `true`.

## Known limitations

- **expand_mode FIT_* axis** — the FIT modes take the right shape, but Godot names one axis as the driver from the control's current size, whereas CSS resolves whichever axis the layout leaves unconstrained; they differ only when the layout constrains both axes.
- **Absent stretch_mode → contain** — an absent `stretch_mode` defaults to `object-fit: contain` (a deliberate deviation from Godot's STRETCH_SCALE default) so a texture fits rather than stretch-distorts; an explicit `stretch_mode = 0` still maps to fill.
