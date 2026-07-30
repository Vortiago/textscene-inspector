---
type: Panel
category: 2D
fixture: unit-panel.tscn
image: unit-panel
renders_as: a StyleBox-painted <div>
---

# Panel

A `Panel` is a bare rectangular Control that paints its `theme_override_styles/panel`
StyleBox and holds free-anchored children. The previewer renders it as a positioned
`<div>` whose CSS is derived from that StyleBox.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| offsets (`-160..160`, `-100..100`) | centered | a 320×200 box in the middle of the frame |
| `bg_color` | `Color(0.16, 0.17, 0.22, 1)` | the dark navy fill |
| `corner_radius_*` | `8` | the rounded corners |
| `border_width_*` | `2` | the thin visible edge |
| `border_color` | `Color(0.4, 0.45, 0.6, 1)` | the light blue-grey of that edge |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin Panel -->
Strict parsing format-checks the inherited set (33 inherited from Control); `Panel` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
<!-- lint:end -->

Panel adds no properties of its own: it forwards straight to `parseControl`, so
there is no Panel-specific lenient fallback beyond what Control already covers.

## Known limitations

- **StyleBoxFlat.border_blend** — with `border_blend = true` Godot fades the border from `border_color` into `bg_color`; we map borders to a solid CSS border with a sharp edge. Defaults to false; no corpus fixture enables it.

## Native (WebGL canvas) painter

`NativeComponent.tsx` draws the resolved `theme_override_styles/panel`
StyleBox — or, absent one, the default-theme `panel` struct
(`native/nativeTheme.ts`'s `widgets.panel`) — across the node's whole solved
rect via `StyleBoxQuad`, the shared ring-tessellation geometry every native
StyleBox-painted Control uses. Not a container: `Panel` registers no
`ContainerLayoutFn`, so its children solve as free/anchored Controls against
its own rect, exactly like the DOM overlay's `ControlParentProvider
kind="free"`.

### Divergences from the DOM component

None for this fixture's colours/geometry — `resolveStyleBoxCss` (DOM) and
`parseStyleBox` (native) read the identical `StyleBoxFlat` fields.

### Known limitations (native only)

- **No anti-aliased corner feather** — `styleBoxFlatGeometry.ts` implements
  Godot's non-anti-aliased `StyleBoxFlat` branch, while Godot's actual default
  is `anti_aliased = true`, `aa_size = 1` (a ~1px soft edge on every rounded
  corner). Measured against this fixture (8px corner radius, 2px border) with
  `pnpm ref:godot scenes/fixtures/unit-panel.tscn --mode 2d --probe 418,226`:
  real Godot returns `rgb(84, 88, 100)` at that pixel, a blend between the
  panel's interior and the background straddling the nominal arc boundary —
  our renderer draws a hard, unblended edge there instead. Tracked as its own
  decision (port the AA ring, or record the parity limitation), not fixed
  here.
