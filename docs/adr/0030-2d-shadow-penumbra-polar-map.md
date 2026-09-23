# A filtered 2D shadow ports Godot's polar shadow map; NONE keeps the stencil

- Status: Accepted
- Related: ADR-0008 (invisible render intent), ADR-0025 (ported Godot code carries
  Godot's MIT notice), `r3f/lighting2d/shadowPolarMap.ts`, `r3f/lighting2d/lightQuad.ts`,
  `r3f/lighting2d/shadowVolumes.ts`, `nodes/2d/pointlight2d/`.

## Context

The stencil path renders a shadowed light as `SHADOW_FILTER_NONE`: CPU-extruded shadow
volumes stamped into a stencil buffer, and the light's cookie quad draws only where they
do not (`shadowVolumes.ts`, `ShadowVolumeMask.tsx`).

That is exact for NONE and wrong for each other filter, and real scenes author the other
filters. Each light in the vendored isometric dungeon sets `shadow_filter = PCF5` at
`shadow_filter_smooth = 5.0`. Godot's own lights-and-shadows demo uses PCF5 at 1.2. NONE
is only the property's default.

**A stencil cannot express it.** Godot's shadow is a per-light 1D polar depth map sampled
with a PCF kernel (`drivers/gles3/shaders/canvas.glsl:458-503`):

```glsl
#define SHADOW_TEST(m_uv) { highp float sd = SHADOW_DEPTH(m_uv); shadow += step(sd, shadow_uv.z / shadow_uv.w); }
// NONE:  1 tap.
// PCF5:  taps at {-2,-1,0,+1,+2} * shadow_pixel_size;  shadow /= 5.0;
// PCF13: taps at {-6..+6}       * shadow_pixel_size;  shadow /= 13.0;
shadow_color.a *= light_color.a;
return mix(light_color, shadow_color, shadow);
```

`shadow` is a fraction with five (or thirteen) levels. A stencil test is one bit. So
`shadow_filter` is not a parameter of the stencil mechanism. It is a second mechanism.

Three properties of that mechanism decide what can reproduce it. Each is measured
through `pnpm ref:godot` against Godot 4.6.3, not derived. The fixture is a 0.25-grey
surface, a PCF5 light at `shadow_filter_smooth = 8`, and an open occluder whose upper
endpoint sits at the light's own y, so the umbra boundary is a horizontal ray that a
vertical probe crosses perpendicular.

1. **The ramp is stepped, not smooth.** A transect at axis distance 276 reads
   167 / 129 / 100 / 80 / 67 / 63 of 255: six plateaus, one per
   `s ∈ {0, .2, .4, .6, .8, 1}`.
2. **The falloff is (1−s)², not (1−s).** With the lit term `L = 0.4049`,
   `255 · (0.25 + L·(1−s)²)` predicts 167.0 / 129.8 / 100.9 / 80.3 / 67.9 / 63.8, each
   step within one level. A plain `(1−s)` puts the first step at 146. The square is
   structural: Godot's `mix` scales both the rgb and the alpha of `light_color` by
   `(1−s)` at the default transparent `shadow_color`, and `light_blend_compute` then
   multiplies the two together.
3. **The penumbra is tangential and grows with distance.** `shadow_pixel_size` is an
   offset in the atlas's u axis, that is an angle around the light
   (`rasterizer_canvas_gles3.cpp:182`). The same fixture's step boundaries sit 19.4 px
   either side of the geometric edge at axis distance 276, and 40.5 px at 576: a ratio of
   2.087 for a distance ratio of 2.087.

## Decision

**Port Godot's own mechanism, the polar shadow map plus its PCF kernel, and gate it on
`shadow_filter != NONE`, so an unfiltered light keeps the stencil path byte for byte.**

- `shadowPolarMap.ts` builds the map on the CPU: 2048 bins of normalised axis distance
  (`canvas_occlusion.glsl:28,56`, not Euclidean), `min` over the occluder edges the light
  may see, clipped to Godot's `radius_cache / 1000` and `radius_cache * 1.1` planes. It
  addresses bins by Godot's own box mapping, which is provably the indexing the
  rasteriser uses. Quadrant 0's projection maps `(x, y, 0) → (y, 0, -x)` into a
  `size/4`-wide viewport, so a column lands at `(y/x)·(size/8) + (size/8)`, the same
  texel `tex_ofs · size` reads.
- The map is a 2048×1 half-float `DataTexture` with `LinearFilter` and `RepeatWrapping`.
  That is Godot's own atlas state (`rasterizer_canvas_gles3.cpp:1885-1888`), not a
  choice. The linear read rounds each step's corner, and the wrap lets a tap cross the
  seam between the last bin and the first.
- `lightQuad.ts` has a shadow-sampling variant that carries the quadrant block and both
  tap kernels, selected by a `SHADOW_FILTER` define. The quads emit Godot's post-shadow
  `light_color`, rgb and alpha both, so the existing fixed-function accumulator blends
  produce the (1−s)² falloff. There is no new pass and no new sampler on the item side.
- An authored `shadow_color` composes and does not fall back. Godot's
  `mix(light_color, shadow_color, s)`, expanded with the albedo already folded in
  (`canvas.glsl:814` runs first), splits with **no cross term** into an albedo-multiplied
  part and an albedo-free one. Those are the two accumulators that exist, so the split is
  exact, not an approximation. At `s = 1` it reduces byte-identically to what the stencil
  path emits inside its umbra. The algebra lives in `lightQuad.ts`'s header, where it can
  change. An ADR is an immutable record, so a live derivation here would go stale in the
  document a newcomer reads first.
- A filtered light therefore draws no stencil mask and carries no stencil props. Each
  quad computes its own fraction over the light's whole rect. The `Equal`/`NotEqual`
  pairing that `ShadowVolumeMask.tsx` documents applies to the unfiltered branch only.

**Why the gate and not one unified mechanism.** Godot's NONE is itself a map lookup with
a single tap, so one mechanism is the cleaner long-term shape. The previewer does not
take it, because the eight `unit-lightoccluder2d-*` baselines sit at about 1/255 mean,
with 0.0% of pixels over 16/255, against analytic volumes, and a 2048-bin map quantises
the boundary to 0.18°. To re-render fixtures measured at parity through a coarser
boundary for tidiness is the wrong trade. Revisit only with probe evidence that it is
byte-benign.

## Considered options

**Render the shadow volumes to a texture and blur them.** Rejected: wrong on both axes. A
screen-space blur has a fixed width, where Godot's penumbra grows linearly with the box
axis distance, and it is isotropic, where Godot's is purely tangential. Because the width
follows the axis distance, it is not even the same width in two quadrants at the same
radius. A blur is also smooth where the measurement shows five hard steps, and it cannot
resolve occluder-behind-occluder depth, which the map does with a `min`.

**Penumbra wedge geometry.** Rejected. Penumbrae come from silhouette endpoints, so
wedges get the ramp's shape wrong. They double-count where two penumbrae overlap (the map
resolves overlap by `min`), cannot produce a five-level staircase, and cannot feed the
tint quad the complementary fraction. It is more geometry code than the port, for less
parity.

**Keep the stencil and blur only its boundary band.** Rejected. Two mechanisms are then
active on one light, joined where Godot's ramp lives, and the seam is the error. The
chosen gate keeps two mechanisms in the code, but only one per light.

**Rasterise the map on the GPU as Godot does.** Rejected. The goldens compare bytes, and
a rasterised map carries the driver's fill-rule and interpolation variance. The map is a
pure function of settled inputs, so the CPU build is deterministic and cheaper than a
per-light render target.

## Consequences

- **`isometric-dungeon` moves toward Godot.** Each of its lights is filtered, so each shadow
  edge in it is the stepped penumbra. Three goldens (`pointlight2d-shadow-pcf5` /
  `-pcf13` / `-pcf-color`) pin the mechanism on single-behaviour fixtures.
- **The eight `unit-lightoccluder2d-*` goldens must not move by a pixel.** They are all
  filter-NONE, and the gate means they run no line of the filtered path. A diff there is
  a defect, not a re-baseline.
- **Cost is per light × quad pixels × taps**, in the class pre-pass. Items are
  untouched: there is no new sampler and no change to the injection, so
  `MAX_LIGHT_CLASSES` and its sampler ceiling are unaffected.
- **The light pose has two more fields** (`worldToLocal`, `radius`), because the map is
  stated in light-local space. That is also what makes a rotated or scaled light come out
  right, where the volumes needed only an origin and a rect.
- **MIX plus an authored `shadow_color` stays an approximation.** The base term's
  attenuation cannot be split across two buffers under an interpolating blend. The
  PointLight2D sheet's known limitations record it.
