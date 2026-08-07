---
type: PointLight2D
category: 2D
fixture: unit-pointlight2d.tscn
image: unit-pointlight2d
status: limitation
group: Lighting
renders_as: the light's cookie multiplied into every CanvasItem beneath it
---

# PointLight2D

A 2D point light. It draws nothing on the canvas itself, as Godot's lights do not:
its `texture` cookie, tinted by `color × energy`, accumulates into an offscreen
buffer that every lit CanvasItem multiplies its albedo against. The fixture puts a
warm radial cookie over a dark `Polygon2D` surface so the glow reads against
something, mirroring Godot's own `lights_and_shadows` light texture.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `texture` | `ExtResource light2d` | the 1024×1024 radial cookie drawn as the light's shape |
| `color` | `Color(1, 0.8, 0.4, 1)` | warms the glow — the additive tint |
| `energy` | `2.0` | scales the emitted colour (unclamped, so the core over-brightens) |
| `texture_scale` | `0.5` | halves the cookie to a ~512 px pool centred on the surface |

## Blend modes

<!-- compare: image=unit-pointlight2d-blend status=done fixture=unit-pointlight2d-blend.tscn -->

Three identical warm lights over one mid-grey surface, one per `blend_mode`.
Every mode is applied against the surface rather than painted over it —
`albedo × (canvas_modulation ± light)` — so the left pool brightens the grey and
the middle one darkens it by the same cookie, in the same places as Godot.

Each mode is one fixed-function blend against the accumulator, so all three land
on Godot: `SrcAlpha/One` added for ADD, the same term reverse-subtracted for SUB,
and `SrcAlpha/OneMinusSrcAlpha` for MIX, which is `mix(dst, src, srcAlpha)`
exactly. Mean channel error 0.49/255 over the frame.

MIX is the one mode whose result depends on the ORDER lights are applied, since
it interpolates the accumulator rather than adding to it. The quads therefore
sort with three's transparent list, which is farthest-first and so replays them
in canvas draw order.

## An inline gradient cookie, a canvas tint, and an unshaded item

<!-- compare: image=unit-pointlight2d-gradient status=done fixture=unit-pointlight2d-gradient.tscn -->

Real scenes rarely ship a light cookie as an image: they describe it inline as a
`GradientTexture2D`, which is fully contained in the scene and rasterises
without a file. Both torches here share one such cookie — rasterised once and
shared, not once per light.

The frame also carries a `CanvasModulate`, which tints the CANVAS rather than a
subtree, and a right-hand panel whose `CanvasItemMaterial` sets `light_mode = 1`.
That panel keeps its authored colour while the floor around it goes blue, and the
torch beside it stops dead at its edge — Godot's base pass guards both the tint
and the light loop with the item's light mode, and an `Unshaded` item is excluded
from each. Mean channel error 0.09/255.

## Light Only items

<!-- compare: image=unit-pointlight2d-lightonly status=done fixture=unit-pointlight2d-lightonly.tscn -->

`CanvasItemMaterial.light_mode = 2` draws an item ONLY where a light reaches it.
Three identical warm panels sit on a dark backdrop under a blue `CanvasModulate`:
the left one is masked by an ADD torch, the middle by a MIX torch, and the right
one has no light on it at all and so renders as nothing.

The mask is an alpha, not a recolouring — a Light Only panel keeps its authored
colour where the cookie is opaque and fades out where it is not, which is why
the panels read orange rather than warm-white. The other Godot rule visible here
is that a Light Only item skips the canvas tint: the panels are not blue, while
the floor strip above them is.

Not shown, but measured against the engine: the coverage is the plain SUM of every
cookie alpha over the item, so overlapping lights saturate the mask instead of
screening into it (three cookies at alpha 0.3 mask to 0.9, not 0.657).

## Cull masks: which items a light reaches

<!-- compare: image=unit-pointlight2d-cull-mask status=done fixture=unit-pointlight2d-cull-mask.tscn -->

A Godot light does not reach every item beneath it. `RendererCanvasCull` applies
one to a CanvasItem only when
`light.range_item_cull_mask & item.light_mask != 0`, and both sides default to
`1`, which is why an untouched light lights an untouched item, and why the rule
is invisible until a scene sets either.

Four panels under two lights, a warm one at the default cull mask and a cool one
at `2`. Both cookies are wide enough to cover the whole row, so every panel is
inside both and only the masks decide. The first panel leaves `light_mask` alone
and takes only the warm light. Its NEIGHBOUR sets `light_mask = 2`, sits under
the warm light's own centre, and still takes only the cool one. The third sets
`3` and takes both. The fourth sets `512`, sits right beside the cool light, and
stays at the bare canvas tint.

Two lights that share a cull mask are indistinguishable to every item, so the
lights partition into CLASSES by that mask and each class accumulates into its
own buffer. One class is the ordinary canvas, and an item then reads the classes
its own mask selects. Up to four classes are accumulated; past that the extra
lights are dropped with a warning, because the item-side lookup unrolls one
sampler per class and GLSL ES 1.00 cannot index a sampler by a runtime value.

An item that reads SEVERAL classes sums their contributions over one shared seed,
which is exactly Godot's loop for ADD and SUB lights (each contributes an
independent `± light·a` term). A MIX light in one class over a light in another
class reaching the same item is the one case that diverges, since MIX
interpolates the accumulator and does not commute across the split.

`shadow_item_cull_mask` parses and is reported, but nothing is shadowed yet.

## The z window: which z planes a light reaches
<!-- compare: image=unit-pointlight2d-range-z status=done fixture=unit-pointlight2d-range-z.tscn -->

The cull mask is one of three tests. Godot's GLES3 rasterizer applies a light to
an item only when

```
p_item->light_mask & light->item_mask
  && p_item->z_final >= light->z_min && p_item->z_final <= light->z_max
```

Both bounds are inclusive, and Godot never swaps an inverted pair: `Light2D`'s
setters assign and forward without clamping or reordering, so `min > max` is an
empty window and the light reaches nothing.

`z_final` is the ACCUMULATED `z_index`: `_cull_canvas_item` adds each node's own
onto its parent's (clamped to Godot's ±4096), and `z_as_relative = false` resets
it to the absolute value. Three panels under one `range_z_max = 4` light,
measured on Godot 4.6.3:

| Panel | `z_index` | Godot | Ours | Reached |
| --- | --- | --- | --- | --- |
| `InsideWindow` | 0 | rgb(141, 122, 138) | rgb(141, 123, 138) | yes |
| `AtWindowMax` | 4 | rgb(213, 173, 165) | rgb(214, 174, 165) | yes, the bound is inclusive |
| `AboveWindow` | 5 | rgb(55, 62, 106) | rgb(55, 62, 107) | no — albedo × CanvasModulate exactly |

The same scene authored with `range_z_min = 4` instead inverts it: `z_index` 0
falls to rgb(55, 62, 106) and `z_index` 4 stays at rgb(213, 173, 165). And with a
`Node2D` at `z_index = 2` between the light and the panels, a child at
`z_index 1` (effective 3) is lit at rgb(141, 122, 138), one at `z_index 3`
(effective 5) is not, and the same child with `z_as_relative = false` is lit
again at absolute 3.

The default window, -1024 to 1024, is wide enough to go unnoticed on a scene
whose z stays small — but it is a bound like any other. `z_index`'s own
-4096..4096 is an inspector hint rather than a setter guard, so an item can sit
outside a default light's window.

## The layer window: which canvases a light reaches
<!-- compare: image=unit-pointlight2d-range-layer status=done fixture=unit-pointlight2d-range-layer.tscn -->

The layer half is tested once per CANVAS rather than per item — the viewport
hands a light to a canvas at all only when
`canvas.layer >= light->layer_min && canvas.layer <= light->layer_max` — and it
is where the default bites. `range_layer_min` and `range_layer_max` both default
to `0`, the world canvas's layer, while `CanvasLayer.layer` defaults to `1`, so
an untouched light lights the world and never the HUD. One default light between
a world `Polygon2D` and an identical one inside a bare `CanvasLayer`:

| Panel | Canvas layer | Godot | Ours | Reached |
| --- | --- | --- | --- | --- |
| `WorldPanel` | 0 | rgb(181, 159, 145) | rgb(181, 159, 146) | yes |
| `HudPanel` | 1 | rgb(107, 107, 117) | rgb(107, 107, 117) | no — the raw albedo, untinted |

Widening the light to `range_layer_max = 1` lights the HUD panel to
rgb(164, 147, 139) and leaves the world panel exactly where it was.

Two lights that agree on the whole cull TUPLE —
`(range_item_cull_mask, range_z_min, range_z_max, range_layer_min, range_layer_max)`
— are indistinguishable to every item, so that tuple, not the mask alone, is what
the accumulation classes partition by. Every light that leaves the four range
properties at their defaults carries the same tail, so a scene that authors no
window has exactly the classes it had before the windows existed; only an
authored window mints a new one.
## Soft shadows: shadow_filter and shadow_filter_smooth
<!-- compare: image=unit-pointlight2d-shadow-pcf5 status=done fixture=unit-pointlight2d-shadow-pcf5.tscn -->

`shadow_filter` is not a parameter of the shadow — it is a second MECHANISM, and the
default (`NONE`) is the only one a hard mask can express. Godot's 2D shadow is a per-light
1D polar depth map, and `light_shadow_compute` averages one, five or thirteen `step()` taps
offset along that map's ANGULAR axis:

```glsl
// PCF5:  taps at {-2,-1,0,+1,+2} * shadow_pixel_size;  shadow /= 5.0;
shadow_color.a *= light_color.a;
return mix(light_color, shadow_color, shadow);
```

with `shadow_pixel_size = (1 / 2048) * (1 + shadow_filter_smooth)`. So the boundary is a
STEPPED ramp with five (or thirteen) levels, not an edge — and it matters in practice
rather than in principle: every shadow-casting light in the vendored corpus overrides the
default, including all 23 in the isometric dungeon (PCF5 at `shadow_filter_smooth = 5`).

The fixture is a 0.25 surface under a PCF5 light at `shadow_filter_smooth = 8`, with the
occluder's upper endpoint on the light's own y so the umbra boundary is a horizontal ray a
vertical probe crosses perpendicular. Measured on Godot 4.6.3, `pnpm ref:godot --probe`,
transect at x = 676 (axis distance 276):

| y | 296–304 | 308–312 | 316–322 | 326–332 | 336–340 | 344+ |
| --- | --- | --- | --- | --- | --- | --- |
| shadow fraction | 0 | 0.2 | 0.4 | 0.6 | 0.8 | 1.0 |
| Godot | 167 | 129 | 100 | 80 | 67 | 63 |
| `0.25 + L(1−s)²`, L = 0.4049 | 167.0 | 129.8 | 100.9 | 80.3 | 67.9 | 63.8 |

The square is the whole story of the falloff: at the default transparent `shadow_color` the
`mix` scales `light_color`'s rgb AND its alpha by `(1 − s)`, and `light_blend_compute` then
multiplies the two. A plain `(1 − s)` would have put the first step at 146.

The taps step in ANGLE, so the penumbra widens with distance. Same fixture, transect at
x = 976 (axis distance 576): the same six levels read 115 / 96 / 82 / 72 / 65 / 63, with
step boundaries at 283.5 / 303.75 / 324 / 344.25 / 364.5 against 304.6 / 314.3 / 324 /
333.7 / 343.4 at 276 — 40.5 px of half-width against 19.4, a ratio of 2.087 for a distance
ratio of 2.087. Because the map's in-quadrant coordinate is a TANGENT, the growth is exactly
linear in the box axis distance rather than in the Euclidean radius.

We reproduce this by porting the mechanism: the polar map is built on the CPU
(`r3f/lighting2d/shadowPolarMap.ts`) and tapped in the light quad's own fragment shader,
gated so an unfiltered light keeps the analytic stencil path untouched (ADR-0030). PCF13 is
the same ramp over the wider kernel; an authored `shadow_color` under a filter splits into
the same two accumulators with no cross term.

## Divergences

The light is no longer a quad on the canvas. Lights accumulate into an offscreen
half-float buffer and every lit CanvasItem multiplies its own albedo by what that
buffer holds beneath it, which is the collapse `canvas.glsl` itself performs —
so falloff, tint, energy and all three blend modes come out of the same arithmetic
Godot runs, in the same sRGB space, clamped at the same point.

Measured mean channel error against the engine, over the whole frame:

| Sheet | Mean | Pixels off by > 16/255 |
| --- | --- | --- |
| `unit-pointlight2d` | 0.32/255 | 0.0% |
| `unit-pointlight2d-blend` | 0.49/255 | 0.0% |
| `unit-pointlight2d-gradient` | 0.09/255 | 0.0% |
| `unit-pointlight2d-lightonly` | 0.43/255 | 0.0% |
| `unit-pointlight2d-cull-mask` | 0.22/255 | 0.0% |

What is left unimplemented:

- `shadow_item_cull_mask` selects which occluders cast, which this sheet
  documents — but in Godot the SAME mask is tested against each item's
  `light_mask` a second time (`shadow_mask |= 1 << light_count` in the GLES3
  rasterizer's light collection), deciding which ITEMS receive the shadowed
  version of the light. The accumulator cannot express per-item shadow on/off
  inside one class, so an item that Godot would exclude from the shadow still
  sees it here.
- A `CanvasLayer`'s own transform semantics are not reproduced: Godot draws a
  CanvasLayer through its own canvas transform, which does not follow the 2D
  camera. The layer WINDOW is applied (above); the parallax-free placement is
  not.
- A MIX light in one cull-mask class over a light in another class, both
  reaching the same item, is summed rather than interpolated in Godot's order.
  That is the one case the per-class split cannot reproduce, since MIX does not
  commute. ADD and SUB across classes are exact.
- Past four distinct cull TUPLES on one canvas the extra classes are dropped with
  a `logger.warn`; nothing in the corpus reaches three, and no scene that leaves
  the range windows alone can add one.
- `shadow_enabled` casts nothing, and `shadow_item_cull_mask` is parsed and
  reported but selects nothing. `LightOccluder2D` and `OccluderPolygon2D`
  parse and render their outline, but no light is occluded by them.
- Normal-mapped and specular response (`Light2D` against a
  `CanvasTexture.normal_texture`) is not computed; every surface takes the light
  head-on.
- A `Control` draws in the DOM overlay rather than on the WebGL canvas
  (ADR-0024), so no 2D light reaches one. Godot's own `light2d_as_mask` demo
  masks a `TextureRect` this way.

## Linting

<!-- lint:begin PointLight2D -->
Strict parsing format-checks these `PointLight2D` properties, plus 15 inherited from Light2D, 12 inherited from Node2D, 16 inherited from CanvasItem, 10 inherited from Node. Every validator failure is an **error**.

| Property | Accepts |
| --- | --- |
| `height` | float >= 0 |
| `offset` | Vector2(x, y) |
| `texture` | SubResource("id") or ExtResource("id") |
| `texture_scale` | float 0.01-50, never exactly 0 |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-canvasitem-clip-ancestry` (type-family match) | `canvasitem-ancestor-clips-children` | warning |
|  | `canvasitem-ancestor-is-canvasgroup` | warning |
| `valid-pointlight2d-ranges` | `pointlight2d-requires-texture` | warning |
|  | `pointlight2d-inverted-z-range` | warning |
|  | `pointlight2d-inverted-layer-range` | warning |
<!-- lint:end -->

`enabled` falls back to `true`, `energy` and `texture_scale` to `1.0`, `offset` to
`(0, 0)`, and `blend_mode` to `0` (ADD) for both an absent value and an out-of-range
one. `color` also falls back to opaque white `(1, 1, 1, 1)`, but silently:
`colorOr` skips the warn-then-fallback of the other `*Or` helpers, so a malformed
color leaves no trace in the log. `texture` is stored as whatever string is
present, with no resource-reference format check.

## Known limitations

The light term itself (falloff, tint, energy, all three blend modes, the canvas
tint, both light modes, the item cull masks and both range windows) is Godot's
own arithmetic in Godot's own space, measured above. What the pass still does
not do:

- **No per-item shadow gating.** `shadow_item_cull_mask` selects which OCCLUDERS
  a light sees, which is honoured. Godot also tests it against each lit ITEM's
  `light_mask`, and that half is not reproduced: the accumulator is a
  screen-space sum, so one light's shadow cannot be turned off for one item
  inside a class without splitting the class.
- **No normal-mapped or specular response.** A `CanvasTexture.normal_texture`
  under a light is not read; every surface takes the light head-on.
- **MIX across two classes** on one item is summed rather than applied in Godot's
  order (see Divergences).
- **A `CanvasLayer` is not placed as its own canvas.** Its layer decides which
  lights reach it (above), but it still follows the 2D camera, where Godot draws
  it through a canvas transform of its own.
- **A `Control` draws in the DOM overlay** rather than on the WebGL canvas
  (ADR-0024), so no 2D light reaches one.
