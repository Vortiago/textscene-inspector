/** The 2D light surface: PointLight2D, DirectionalLight2D and LightOccluder2D. */

export const LIGHTING_2D_SCENES = [
  // The 2D light surface: ADD/SUB/MIX applied against a lit surface, and an
  // inline gradient cookie under a canvas tint with an unshaded item beside it.
  // Lights with no texture add nothing and draw no placeholder (measured with `pnpm ref:godot`).
  { name: 'pointlight2d-untextured', file: 'unit-pointlight2d-untextured.tscn' },
  { name: 'pointlight2d-blend', file: 'unit-pointlight2d-blend.tscn' },
  { name: 'pointlight2d-gradient', file: 'unit-pointlight2d-gradient.tscn' },
  // Opaque cookie edges with fractional quad edges: the outer half texel fades, as Godot's atlas does.
  { name: 'pointlight2d-cookie-edge', file: 'unit-pointlight2d-cookie-edge.tscn' },
  { name: 'pointlight2d-lightonly', file: 'unit-pointlight2d-lightonly.tscn' },
  // Godot's light culling: `light.range_item_cull_mask & item.light_mask != 0`.
  // Four panels under two lights take the warm light, the cool one, both, and
  // neither, the last right under the cool light. No other golden sets either
  // mask, so a light that reached everything moves no other baseline.
  { name: 'pointlight2d-cull-mask', file: 'unit-pointlight2d-cull-mask.tscn' },
  // The two range windows of the same cull test. `range_z_max = 4` over z_index
  // 0, 4 and 5 pins the per-item z window and its inclusive top. A default light
  // over a world panel and a bare CanvasLayer panel pins the per-canvas layer
  // window, whose 0..0 default is why Godot never lights an untouched HUD.
  { name: 'pointlight2d-range-z', file: 'unit-pointlight2d-range-z.tscn' },
  { name: 'pointlight2d-range-layer', file: 'unit-pointlight2d-range-layer.tscn' },
  // LightOccluder2D shadows, one behaviour per fixture. A shadow withholds a
  // light from the geometry behind the occluder; it never darkens what the
  // light did not reach, so an unlit surface is the same grey either way.
  { name: 'lightoccluder2d-shadow-closed', file: 'unit-lightoccluder2d-shadow-closed.tscn' },
  // `unit-lightoccluder2d-shadow` is the single-edge case the LightOccluder2D
  // sheet leads with.
  { name: 'lightoccluder2d', file: 'unit-lightoccluder2d.tscn' },
  { name: 'lightoccluder2d-shadow', file: 'unit-lightoccluder2d-shadow.tscn' },
  // `cull_mode` 0/1/2: which winding of an occluder's edges casts. The reversed
  // pair winds the polygons the other way, so CLOCKWISE and COUNTER_CLOCKWISE
  // swap and DISABLED stays put. A winding-blind cull test leaves one of the two
  // baselines flat.
  { name: 'lightoccluder2d-cull-mode', file: 'unit-lightoccluder2d-cull-mode.tscn' },
  { name: 'lightoccluder2d-cull-mode-reversed', file: 'unit-lightoccluder2d-cull-mode-reversed.tscn' },
  // `shadow_color` is the light's, not the occluder's, and it replaces the light
  // term rather than withholding it. Godot does not multiply it by the item's
  // albedo, so it rides its own accumulator: folded into the ordinary one, it
  // sits a whole albedo out.
  { name: 'lightoccluder2d-shadow-color', file: 'unit-lightoccluder2d-shadow-color.tscn' },
  // `shadow_item_cull_mask & occluder.light_mask`: one occluder casts, its twin
  // is culled by the same light.
  { name: 'lightoccluder2d-shadow-mask', file: 'unit-lightoccluder2d-shadow-mask.tscn' },
  // Two shadowed lights in one accumulation pass: each must clear the stencil
  // before it stamps, or the first light's volume also cuts the second's.
  { name: 'lightoccluder2d-two-lights', file: 'unit-lightoccluder2d-two-lights.tscn' },
  // `shadow_filter`, which every occluder fixture above leaves at NONE, gives a stepped penumbra.
  // The occluder's top sits at the light's y, so a vertical probe crosses the umbra edge square on.
  // Godot 4.6.3 transect at x=676: 167 / 129 / 100 / 80 / 67 / 63 of 255, the five PCF5 levels
  // under the (1-s)^2 falloff, with step boundaries 19.4 px either side of the geometric edge.
  { name: 'pointlight2d-shadow-pcf5', file: 'unit-pointlight2d-shadow-pcf5.tscn' },
  // PCF13 spreads the same ramp over the wider kernel.
  { name: 'pointlight2d-shadow-pcf13', file: 'unit-pointlight2d-shadow-pcf13.tscn' },
  // The colour fixture pins the fractional tint the two accumulators split.
  { name: 'pointlight2d-shadow-pcf-color', file: 'unit-pointlight2d-shadow-pcf-color.tscn' },
  // Godot 4.6.3 at x=800: 63 on the receiving panel, 132 on the escaping one, which
  // shadow_item_cull_mask leaves lit.
  { name: 'pointlight2d-shadow-item-mask', file: 'unit-pointlight2d-shadow-item-mask.tscn' },
  // A MIX light over an ADD light of another mask on one item mixes from what the ADD light left.
  // Godot 4.6.3 at x=575, where both reach: rgb(52,68,126).
  { name: 'pointlight2d-mix-order', file: 'unit-pointlight2d-mix-order.tscn' },
  // Six masks reach one item, and Godot draws every light. Godot 4.6.3 at x=136 and x=1016, the
  // first and the sixth light: rgb(160,97,81) and rgb(88,157,168).
  { name: 'pointlight2d-many-masks', file: 'unit-pointlight2d-many-masks.tscn' },
  // A MIX light's shadow_color mixes over the light under it. Godot 4.6.3 at x=610, in the MIX
  // light's shadow and the ADD light's reach: rgb(208,126,115).
  { name: 'pointlight2d-mix-shadow-color', file: 'unit-pointlight2d-mix-shadow-color.tscn' },
  // A MIX light over a tinted shadow mixes the tint too. Godot 4.6.3 at x=610: rgb(36,112,74).
  { name: 'pointlight2d-mix-over-shadow-color', file: 'unit-pointlight2d-mix-over-shadow-color.tscn' },
  // An item takes at most 15 positional lights whose rect meets its own. Godot 4.6.3 at the
  // panels' centres: Left rgb(185,234,191) without Red, Right rgb(227,180,177) with it.
  { name: 'pointlight2d-item-light-cap', file: 'unit-pointlight2d-item-light-cap.tscn' },
  // DirectionalLight2D reaches every lit item whatever its light_mask or z, and its shadow is a
  // parallel map across the project viewport's diagonal, so its PCF taps keep one width.
  { name: 'directionallight2d', file: 'unit-directionallight2d.tscn' },
  { name: 'directionallight2d-shadow', file: 'unit-directionallight2d-shadow.tscn' },
  { name: 'directionallight2d-shadow-pcf5', file: 'unit-directionallight2d-shadow-pcf5.tscn' },
  // A normal-mapped Sprite2D shades each light by its own angle. Godot 4.6.3 `--mode 2d`: at height 0,
  // rgb(201) at (100,324) and rgb(128) at (224,324); at height 50, rgb(226) at (852,324), rgb(168)
  // at (976,324) and rgb(160) at (952,224).
  {
    name: 'pointlight2d-normal-map-height',
    file: 'unit-pointlight2d-normal-map-height.tscn',
  },
  // specular_shininess 0.5 adds the highlight. Godot 4.6.3 `--mode 2d`: rgb(255) at (476,324),
  // rgb(244) at (552,324) and rgb(168) at (600,324).
  {
    name: 'pointlight2d-normal-map-specular',
    file: 'unit-pointlight2d-normal-map-specular.tscn',
  },
  // A DirectionalLight2D at height 0.5. Godot 4.6.3 `--mode 2d`: Plain rgb(255) at (200,324), Flat
  // rgb(193) at (576,324), Dome rgb(200), rgb(219) and rgb(200) at x=840, 952 and 1064.
  { name: 'directionallight2d-normal-map', file: 'unit-directionallight2d-normal-map.tscn' },
  // The eight-light cap leaves its canvas's loop only, so a CanvasLayer's sun is the ninth.
  // Godot 4.6.3 `--mode 2d`: rgb(178,168,221) everywhere, 64 more blue than the eight alone.
  {
    name: 'directionallight2d-canvas-layer-cap',
    file: 'unit-directionallight2d-canvas-layer-cap.tscn',
  },
  // The cap on directional lights alone: red markers 0, 100 and 200 and green markers 254 and 255
  // light, the rest do not. Godot 4.6.3 `--mode 2d`: rgb(69,59,51) at (500,20).
  {
    name: 'directionallight2d-render-budget',
    file: 'unit-directionallight2d-render-budget.tscn',
    settleTimeout: 120000,
  },
];
