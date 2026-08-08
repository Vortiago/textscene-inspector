/**
 * The 2D canvas: polygons and lines, y-sorting, the PointLight2D surface with
 * its cull masks and occluder shadows, CPUParticles2D, 2D navigation and
 * parallax.
 */

export const CANVAS_2D_SCENES = [
  // 2D nodes render in the 2D view (with its zoom/pan chrome) — relax the
  // threshold like the other 2D goldens (marker2d/path2d).
  { name: 'polygon-2d', file: 'unit-polygon2d.tscn', maxDiffPct: 0.5 },
  { name: 'line-2d', file: 'unit-line2d.tscn', maxDiffPct: 0.5 },
  // A y-sorted node's OWN body, between the two children it merges into the
  // same sort. Godot probes: (200,330) yellow — the bar covers the red block;
  // (700,330) blue — the blue one covers the bar. Without the body the first
  // is red, which no other golden would notice.
  { name: 'ysort-own-body', file: 'unit-ysort-own-body.tscn', maxDiffPct: 0.5 },
  // The 2D light surface: ADD/SUB/MIX applied against a lit surface, and an
  // inline gradient cookie under a canvas tint with an unshaded item beside it.
  { name: 'pointlight2d-blend', file: 'unit-pointlight2d-blend.tscn', maxDiffPct: 0.5 },
  { name: 'pointlight2d-gradient', file: 'unit-pointlight2d-gradient.tscn', maxDiffPct: 0.5 },
  { name: 'pointlight2d-lightonly', file: 'unit-pointlight2d-lightonly.tscn', maxDiffPct: 0.5 },
  // Godot's light culling: `light.range_item_cull_mask & item.light_mask != 0`.
  // Four panels under two lights of different cull masks: one panel takes only
  // the warm light, its NEIGHBOUR only the cool one, the third both, and the
  // fourth sits right under the cool light and takes neither. Nothing else in
  // the goldens sets either mask, so without this a light that reached
  // everything under it would move no baseline at all.
  { name: 'pointlight2d-cull-mask', file: 'unit-pointlight2d-cull-mask.tscn', maxDiffPct: 0.5 },
  // The two range windows, which are the other half of the same cull test.
  // `range_z_max = 4` over panels at z_index 0, 4 and 5 pins the per-ITEM z
  // window and its inclusive upper bound; a default light over a world panel and
  // a bare CanvasLayer panel pins the per-CANVAS layer window, whose 0..0
  // default is why Godot never lights an untouched HUD.
  { name: 'pointlight2d-range-z', file: 'unit-pointlight2d-range-z.tscn', maxDiffPct: 0.5 },
  { name: 'pointlight2d-range-layer', file: 'unit-pointlight2d-range-layer.tscn', maxDiffPct: 0.5 },
  // LightOccluder2D shadows, one behaviour per fixture. A shadow withholds a
  // light from the geometry behind the occluder; it never darkens what the
  // light did not reach, so an unlit surface is the same grey either way.
  { name: 'lightoccluder2d-shadow-closed', file: 'unit-lightoccluder2d-shadow-closed.tscn', maxDiffPct: 0.5 },
  // These two had fixtures and comparison images but no baseline, so nothing
  // guarded them — including `unit-lightoccluder2d-shadow`, the single-edge case
  // the LightOccluder2D sheet leads with. Every other occluder behaviour was
  // pinned, which is exactly why the gap was easy to miss.
  { name: 'lightoccluder2d', file: 'unit-lightoccluder2d.tscn', maxDiffPct: 0.5 },
  { name: 'lightoccluder2d-shadow', file: 'unit-lightoccluder2d-shadow.tscn', maxDiffPct: 0.5 },
  // `cull_mode` 0/1/2: which winding of an occluder's edges casts. The reversed
  // pair is the same two occluders with the polygon wound the other way, so
  // CLOCKWISE and COUNTER_CLOCKWISE swap and DISABLED stays put — a cull test
  // that read winding-independently would leave one of the two baselines flat.
  { name: 'lightoccluder2d-cull-mode', file: 'unit-lightoccluder2d-cull-mode.tscn', maxDiffPct: 0.5 },
  { name: 'lightoccluder2d-cull-mode-reversed', file: 'unit-lightoccluder2d-cull-mode-reversed.tscn', maxDiffPct: 0.5 },
  // `shadow_color` is the light's, not the occluder's, and it REPLACES the light
  // term rather than withholding it. It is also the one light term Godot does not
  // multiply by the item's albedo, so it rides its own accumulator — a baseline
  // that folded it into the ordinary one would sit a whole albedo out.
  { name: 'lightoccluder2d-shadow-color', file: 'unit-lightoccluder2d-shadow-color.tscn', maxDiffPct: 0.5 },
  // `shadow_item_cull_mask & occluder.light_mask`: one occluder casts, its twin
  // is culled by the same light.
  { name: 'lightoccluder2d-shadow-mask', file: 'unit-lightoccluder2d-shadow-mask.tscn', maxDiffPct: 0.5 },
  // Two shadowed lights in one accumulation pass: each must clear the stencil
  // before it stamps, or the first light's volume also cuts the second's.
  { name: 'lightoccluder2d-two-lights', file: 'unit-lightoccluder2d-two-lights.tscn', maxDiffPct: 0.5 },
  // `shadow_filter`: the boundary is a STEPPED penumbra, not an edge, and every
  // occluder fixture above leaves the property at NONE — so without these three
  // the whole filtered mechanism is unpinned. The occluder's upper endpoint sits
  // at the light's own y, which puts the umbra boundary on the horizontal ray
  // and lets a vertical probe cross it perpendicular. Godot 4.6.3, transect at
  // x=676: 167 / 129 / 100 / 80 / 67 / 63 of 255 — the five PCF5 levels under
  // the (1-s)^2 falloff, with the step boundaries 19.4 px either side of the
  // geometric edge. PCF13 spreads the same ramp over the wider kernel, and the
  // colour fixture pins the fractional tint the two accumulators split.
  { name: 'pointlight2d-shadow-pcf5', file: 'unit-pointlight2d-shadow-pcf5.tscn', maxDiffPct: 0.5 },
  { name: 'pointlight2d-shadow-pcf13', file: 'unit-pointlight2d-shadow-pcf13.tscn', maxDiffPct: 0.5 },
  { name: 'pointlight2d-shadow-pcf-color', file: 'unit-pointlight2d-shadow-pcf-color.tscn', maxDiffPct: 0.5 },
  // CPUParticles2D renders a FROZEN pose, so these baselines are what prove it
  // settles: a live emitter would never produce two identical frames and the
  // harness would fail it as unstable rather than as changed. Each fixture pins
  // `use_fixed_seed`/`seed`/`fixed_fps`/`preprocess` so the pose is one exact
  // draw rather than a plausible one.
  { name: 'cpuparticles2d', file: 'unit-cpuparticles2d.tscn', maxDiffPct: 0.5 },
  { name: 'cpuparticles2d-emission-shapes', file: 'unit-cpuparticles2d-emission-shapes.tscn', maxDiffPct: 0.5 },
  { name: 'cpuparticles2d-curves', file: 'unit-cpuparticles2d-curves.tscn', maxDiffPct: 0.5 },
  { name: 'cpuparticles2d-color-ramp', file: 'unit-cpuparticles2d-color-ramp.tscn', maxDiffPct: 0.5 },
  // A scaled emitter whose particles must NOT scale with it: Godot's default
  // `local_coords = false` emits into world space, which the dungeon candle relies on.
  { name: 'cpuparticles2d-local-coords', file: 'unit-cpuparticles2d-local-coords.tscn', maxDiffPct: 0.5 },
  // `emitting = false` draws nothing. Script-triggered one-shot emitters ship
  // this way, so a regression that started drawing them would be widespread.
  { name: 'cpuparticles2d-not-emitting', file: 'unit-cpuparticles2d-not-emitting.tscn', maxDiffPct: 0.5 },
  // Baseline corrected in the Y-flip fix: a NavigationPolygon's vertices are
  // Godot canvas pixels (+Y DOWN), and this overlay was the one 2D geometry
  // path that skipped the negation — so the navmesh used to sit ABOVE the
  // region origin instead of below it.
  { name: 'navigation-region-2d', file: 'unit-navigation-region-2d.tscn', maxDiffPct: 0.5 },
  // A ParallaxBackground is a CanvasLayer: its subtree hangs off the VIEWPORT,
  // so the blue bar stays at the canvas origin while the red reference bar under
  // the same displaced parent moves with it. Every other 2D golden composes
  // transforms the ordinary way and would still match if that chain were
  // re-attached.
  { name: 'parallax-background', file: 'unit-parallax-background.tscn', maxDiffPct: 0.5 },
  // `motion_mirroring` draws the layer a SECOND time, 200 px right — the only
  // repeated canvas subtree in the corpus, and the only property of a
  // ParallaxLayer a camera-less still frame can show at all.
  { name: 'parallax-layer', file: 'unit-parallax-layer.tscn', maxDiffPct: 0.5 },
];
