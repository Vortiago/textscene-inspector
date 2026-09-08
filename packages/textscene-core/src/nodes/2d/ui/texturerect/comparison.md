---
type: TextureRect
category: 2D
status: unreviewed
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
| `stretch_mode` | `5` (KEEP_ASPECT_CENTERED) | square texture fits the frame height and centres — grey letterbox on the left and right |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin TextureRect -->
Strict parsing format-checks these `TextureRect` properties, plus 53 inherited from Control, 16 inherited from CanvasItem, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `expand_mode` | enum 0-5 (EXPAND_KEEP_SIZE/EXPAND_IGNORE_SIZE/EXPAND_FIT_WIDTH/EXPAND_FIT_WIDTH_PROPORTIONAL/EXPAND_FIT_HEIGHT/EXPAND_FIT_HEIGHT_PROPORTIONAL) | warning |
| `flip_h` | true or false |  |
| `flip_v` | true or false |  |
| `stretch_mode` | enum 0-6 (STRETCH_SCALE/STRETCH_TILE/STRETCH_KEEP/STRETCH_KEEP_CENTERED/STRETCH_KEEP_ASPECT/STRETCH_KEEP_ASPECT_CENTERED/STRETCH_KEEP_ASPECT_COVERED) | warning |
| `texture` | null, SubResource("id") or ExtResource("id") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-control-tooltip-mouse-filter` (type-family match) | `control-tooltip-ignored-by-mouse-filter` | warning |
<!-- lint:end -->

`expand_mode` and `stretch_mode` each warn (not error) outside their documented
enum range: `set_expand_mode` (texture_rect.cpp:207-215) and `set_stretch_mode`
(texture_rect.cpp:221-228) both assign straight through with no
`ERR_FAIL_INDEX`, so only the `ADD_PROPERTY` hint states the bound. `flip_h` and
`flip_v` are format-checked as booleans. None of the four carries a bound the
setter itself enforces, so no value listed here is ever an error.

At render time `expand_mode` and `stretch_mode` still use the optional-int
reader, so an absent or unparseable value becomes `undefined` and each falls
through its own switch's default case. `flip_h` / `flip_v` behave differently:
a present-but-unparseable value collapses to `false` rather than `undefined`,
since `parseOptionalBool` only checks for the literal string `true`.

## Known limitations

- **expand_mode FIT_* axis** — the FIT modes take the right shape, but Godot names one axis as the driver from the control's current size, whereas CSS resolves whichever axis the layout leaves unconstrained; they differ only when the layout constrains both axes.
- **Absent stretch_mode → contain** — an absent `stretch_mode` defaults to `object-fit: contain` (a deliberate deviation from Godot's STRETCH_SCALE default) so a texture fits rather than stretch-distorts; an explicit `stretch_mode = 0` still maps to fill.
