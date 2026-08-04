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
0.005/255 over the frame. The one measurable difference is a corner pixel:
`--probe 418,226`, on the 8 px arc, reads rgb(84, 88, 100) in Godot and
rgb(96, 106, 134) here — a different point on the same ramp, both blends, and the
"Known limitations (native only)" section below has the reading.

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

### Known limitations (native only)

- **The corner feather is one pixel narrower than Godot's.**
  `styleBoxFlatGeometry.ts` implements Godot's non-anti-aliased `StyleBoxFlat`
  branch, while Godot's actual default is `anti_aliased = true`, `aa_size = 1`.
  The arc is still soft here, because the canvas is multisampled — so the
  divergence is the ramp's WIDTH, not its absence. Measured across a 40 px arc
  on `unit-panel-styleboxes.tscn`, transect at y = 60: Godot ramps over two
  pixels (rgb(207, 209, 205) at x 74, rgb(69, 100, 141) at x 75) before the
  rgb(38, 76, 128) fill, ours over one (`--probe 75,60` → rgb(83, 112, 149),
  with the bare rgb(217, 217, 209) backdrop at x 74). On this sheet's own
  8 px arc, `--probe 418,226` reads rgb(84, 88, 100) against rgb(96, 106, 134)
  — the same pixel a fraction further along the same ramp. Tracked as its own
  decision (port the AA ring, or record the parity limitation), not fixed here.
