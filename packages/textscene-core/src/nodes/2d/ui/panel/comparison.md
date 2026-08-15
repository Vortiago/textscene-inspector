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
--mode 2d` against `pnpm ref:ours unit-panel.tscn --2d` is a mean channel error
of 0.0001 over the frame, with 88 pixels differing at all and none by more than
3 counts. All 88 sit on the four 8 px arcs — `--probe 418,226` reads rgb(84, 88,
100) in Godot against rgb(83, 86, 97) here.

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

- **StyleBoxFlat.border_blend** — the ramp matches Godot's, to the count, everywhere
  but its last row. `unit-panel-styleboxes.tscn` sets the flag on one of two
  otherwise identical Panels, so it is the only variable. Measured across the 16 px
  top border with `pnpm ref:godot scenes/fixtures/unit-panel-styleboxes.tscn --mode
  2d --probe <x,y>` against `pnpm ref:ours unit-panel-styleboxes.tscn --2d --probe
  <x,y>`:

  | Probe | What it is | Godot | Ours |
  | --- | --- | --- | --- |
  | (850, 340) | the ramp's first row, at `border_color` | rgb(242, 191, 51) | rgb(242, 191, 51) |
  | (850, 348) | its midpoint | rgb(137, 132, 90) | rgb(137, 132, 90) |
  | (850, 356) | its last row, at `bg_color` | rgb(38, 76, 128) | rgb(38, 77, 128) |

  The one remaining count is on green at `bg_color`, whose 0.3 channel is fractional
  at 8 bit (0.3 x 255 = 76.5) — the reference tool's own ROP rounding floor, not a
  divergence: `--rendering-driver opengl3` reads 77 at that probe where the default
  vulkan reads 76, and 77 is ours. The unblended twin
  is exact: a transect across its own 16 px border reads rgb(242, 191, 51) for every
  border pixel and rgb(38, 76, 128) immediately inside, on both sides.

- **StyleBoxFlat.skew and the drop shadow** are drawn, and `unit-panel-stylebox-skew-shadow.tscn`
  pins them: whole-frame mean channel error 0.19 against Godot, nothing past 6
  counts. Nearly all of that mean is the same fractional-channel floor as above (the
  fill's 0.3 green, 76.5 at 8 bit); what is left sits on the one pane sheared on both
  axes, at most 6 counts on its diagonal edges.

  Every soft edge on this canvas is authored geometry, because a Godot 2D viewport
  does not multisample (`msaa_2d = MSAA_DISABLED`, `scene/main/viewport.h:309`). The
  2D canvas matches it (`World2DCanvas.tsx`'s `antialias: false`) — on
  @react-three/fiber's default it resolved coverage on top of the authored ramp.

## Native (WebGL canvas) painter

`Component.tsx` draws the resolved `theme_override_styles/panel`
StyleBox — or, absent one, the default-theme `panel` struct
(`native/nativeTheme.ts`'s `widgets.panel`) — across the node's whole solved
rect via `StyleBoxQuad`, the shared ring-tessellation geometry every native
StyleBox-painted Control uses. Not a container: `Panel` registers no
`ContainerLayoutFn`, so its children solve as free/anchored Controls against
its own rect.
