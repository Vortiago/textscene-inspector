---
type: VBoxContainer
category: 2D
fixture: unit-vbox-container.tscn
image: unit-vbox-container
renders_as: children laid out down a column
---

# VBoxContainer

VBoxContainer stacks its children in a vertical column. The previewer runs Godot's own
`BoxContainer::_resort`: `separation` spaces the children, `alignment` packs
whatever is left over, and each child's `size_flags` decide its share of the
column and its cross-axis fill. Here `alignment = END` packs the two Labels ("Top", "Bottom")
to the bottom of the container, each carrying `size_flags_horizontal = 3`
(FILL|EXPAND) so it spans the container's full width.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `anchors_preset` | `15` | the container fills the parent rect (the whole viewport) |
| `alignment` | `2` (END) | main-axis packing — both labels sit at the bottom of the column |
| `theme_override_constants/separation` | `16` | 16px gap between "Top" and "Bottom" |

## Divergences

None visible in this fixture. Both images pack "Top" above "Bottom" at the
lower-left, at the same positions, with the same 16 px separation between them,
and both draw the labels in the same bundled theme font at the same weight —
`pnpm ref:godot scenes/fixtures/unit-vbox-container.tscn --mode 2d` against
`pnpm ref:ours unit-vbox-container.tscn --2d` differs at a mean channel error of
0.03/255 over the 1152x648 frame, all of it on glyph edges.

`unit-vbox-container-pitch.tscn` is the wider reading of the solve, as flat bands
with no text to blame an edge on. Every band edge in the `alignment = 1` column
matches Godot exactly (y 180..239, 264..303, 328..367, 392..481), and in the
expand column three of four do; the stretched `Green` band runs one pixel long
(y 274..487 against Godot's 274..486) and carries `Amber` one row down with it,
because Godot accumulates the truncated stretch shares in float32 where we use
float64 and the two fractions land either side of a whole pixel at 320/3.

## Linting

<!-- lint:begin VBoxContainer -->
Strict parsing format-checks the inherited set (35 inherited from Control); `VBoxContainer` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

`alignment` goes through `parseOptionalInt` (via the shared BoxContainer
parser): absent or unparseable, it becomes `undefined` with no warning, and
`alignmentJustify` maps that (or any value besides `1`/`2`) to `flex-start`,
Godot's BEGIN default. `theme_override_constants/separation` is collected
generically by the Control parser (`parseOptionalFloat`, same silent-fallback
contract); when it's missing the Component substitutes its own default of
`4`px, matching Godot's VBoxContainer default gap.
