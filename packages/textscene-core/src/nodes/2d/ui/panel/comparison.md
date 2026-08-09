---
type: Panel
category: 2D
fixture: unit-panel.tscn
image: unit-panel
renders_as: a StyleBox quad
---

# Panel

A `Panel` is a bare rectangular Control that paints its `theme_override_styles/panel`
StyleBox and holds free-anchored children. The previewer tessellates that StyleBox
into a quad on the canvas — fill, per-corner arcs and border ring from the resource's
own fields.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| offsets (`-160..160`, `-100..100`) | centered | a 320×200 box in the middle of the frame |
| `bg_color` | `Color(0.16, 0.17, 0.22, 1)` | the dark navy fill |
| `corner_radius_*` | `8` | the rounded corners |
| `border_width_*` | `2` | the thin visible edge |
| `border_color` | `Color(0.4, 0.45, 0.6, 1)` | the light blue-grey of that edge |

## Divergences

None visible in this fixture: `pnpm ref:godot scenes/fixtures/unit-panel.tscn
--mode 2d` against `pnpm ref:ours unit-panel.tscn --2d` differs on no pixel at
all under the visual harness's own tolerance, at a mean channel error under
0.005/255 over the frame. The closest thing to a measurable difference is a
corner pixel, `--probe 418,226`, on the 8 px arc: rgb(84, 88, 100) in Godot
against rgb(81, 84, 92) here — a few counts apart on the same AA ramp.

## Linting

<!-- lint:begin Panel -->
Strict parsing format-checks the inherited set (35 inherited from Control); `Panel` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `control-property-order` (type-family match) | `control-property-order` | warning |
<!-- lint:end -->

Panel adds no properties of its own: it forwards straight to `parseControl`, so
there is no Panel-specific lenient fallback beyond what Control already covers.

## Known limitations

- **StyleBoxFlat.border_blend** — the ramp is drawn, but interpolated in the wrong space. `unit-panel-styleboxes.tscn` sets it on one of two otherwise identical Panels, so the flag is the only variable. Measured across the 16 px top border with `pnpm ref:godot scenes/fixtures/unit-panel-styleboxes.tscn --mode 2d --probe <x,y>` against `pnpm ref:ours unit-panel-styleboxes.tscn --2d --probe <x,y>`:

  | Probe | What it is | Godot | Ours |
  | --- | --- | --- | --- |
  | (850, 340) | the ramp's first row, at `border_color` | rgb(242, 191, 51) | rgb(239, 189, 55) |
  | (850, 348) | its midpoint | rgb(137, 132, 90) | rgb(175, 145, 101) |
  | (850, 356) | its last row, at `bg_color` | rgb(38, 76, 128) | rgb(38, 77, 128) |

  Both ramps start and end on the same rows at the same two colours; Godot's runs
  through sRGB and ours through linear, which is why the midpoint sits 38 counts
  high on the red channel. The unblended twin is exact: a transect across its own
  16 px border reads rgb(242, 191, 51) for every border pixel and rgb(38, 76, 128)
  immediately inside, on both sides.

## Native (WebGL canvas) painter

`Component.tsx` draws the resolved `theme_override_styles/panel`
StyleBox — or, absent one, the default-theme `panel` struct
(`native/nativeTheme.ts`'s `widgets.panel`) — across the node's whole solved
rect via `StyleBoxQuad`, the shared ring-tessellation geometry every native
StyleBox-painted Control uses. Not a container: `Panel` registers no
`ContainerLayoutFn`, so its children solve as free/anchored Controls against
its own rect.
