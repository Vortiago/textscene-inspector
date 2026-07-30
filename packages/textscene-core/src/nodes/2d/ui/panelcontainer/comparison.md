---
type: PanelContainer
category: 2D
fixture: unit-panel-container.tscn
image: unit-panel-container
renders_as: a StyleBox panel around its child
---

# PanelContainer

PanelContainer draws its `theme_override_styles/panel` StyleBox and fits its single
child inside the box's content margins. The previewer maps it to a flex-column
`<div>` carrying the StyleBox's fill, corner radius and padding, and stretches the
child to fill the content box — so a child Label's own alignment has room to act.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `anchors_preset` / `anchor_*` | `8` / `0.5` | anchors the panel to the viewport centre |
| `offset_left/top/right/bottom` | `-120 / -40 / 120 / 40` | a 240×80 box straddling the centre anchor |
| `theme_override_styles/panel` | `StyleBoxFlat` | supplies the panel's fill, corners and padding |
| `bg_color` | `Color(0.16, 0.16, 0.18, 0.95)` | dark near-opaque slate fill |
| `corner_radius_*` | `6` | rounded corners on all four sides |
| `content_margin_left/right` | `16` | horizontal padding between panel edge and label |
| `content_margin_top/bottom` | `12` | vertical padding between panel edge and label |
| child `Label.text` | `"Panel Container"` | the panel sizes around this label |
| child `Label` alignment | `horizontal_alignment = 1`, `vertical_alignment = 1` | label centred within the content box |

## Divergences

None visible in this fixture. The child now fills the content box, so the label's
`vertical_alignment = 1` centres it on the panel's midline as in Godot; panel
position, size, dark slate fill, 6 px corners, padding and both-axis centring match.

## Linting

<!-- lint:begin PanelContainer -->
Strict parsing format-checks the inherited set (33 inherited from Control); `PanelContainer` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

`PanelContainer` declares no validators of its own, and its parser performs no
substitution either: it delegates straight to `parseControl` and adds no properties,
so all lenient-fallback behaviour for this node lives in the Control slice.

## Native (WebGL canvas) painter

`NativeComponent.tsx` draws the SAME chrome `Panel`'s native painter draws —
the resolved `theme_override_styles/panel` override, or the default-theme
`panel` struct, across the node's whole solved rect. The container BEHAVIOUR
lives in `nativeSolver.ts`, a port of `PanelContainer::get_minimum_size` and
`PanelContainer::_notification`'s `NOTIFICATION_SORT_CHILDREN`
(`scene/gui/panel_container.cpp`) plus `Container::fit_child_in_rect`
(`scene/gui/container.cpp`): the content rect is the node's own rect inset by
the StyleBox's content margins on all four sides, and the container's own
minimum size is the per-axis MAX of every child's combined minimum size plus
those same margins — verified against this fixture's `16`/`12` px margins
with synthetic `custom_minimum_size` children in `nativeSolver.test.ts`.

### A DOM-vs-native default-margin divergence, found while wiring the native painter

The DOM component's `useDefaults` fallback pads with `theme.contentMargin`
(4px at scale 1) when no `theme_override_styles/panel` is set. Real Godot's
actual default (`scene/theme/default_theme.cpp:1274`) calls
`make_flat_stylebox(style_normal_color, 0, 0, 0, 0)` — explicit ZERO content
margins, the identical call `Panel`'s own default stylebox makes (`:134`).
The native painter/solver reproduce that zero-margin default verbatim
(`native/nativeTheme.ts`'s `widgets.panel`, shared with `Panel`); the DOM
component's 4px fallback padding is a pre-existing divergence from real
Godot that predates this native slice and is unchanged by it.

### Divergences from the DOM component

None for this fixture — it carries an explicit `theme_override_styles/panel`
override, so neither side's default-fallback path (see above) is exercised.
