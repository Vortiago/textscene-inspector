# A filtered 2D shadow ports Godot's polar shadow map; NONE keeps the stencil

- Status: Accepted (2026-07-29)
- Related: ADR-0008 (invisible render intent), ADR-0025 (ported Godot code carries
  Godot's MIT notice), `r3f/lighting2d/shadowPolarMap.ts`, `r3f/lighting2d/lightQuad.ts`,
  `r3f/lighting2d/shadowVolumes.ts`, `nodes/2d/pointlight2d/`.

## Context

`Light2D.shadow_filter` was parsed and then ignored. Every shadowed light rendered as if it
were `SHADOW_FILTER_NONE`: CPU-extruded shadow volumes stamped into a stencil buffer, and the
light's cookie quad drawing only where they did not (`shadowVolumes.ts`, `ShadowVolumeMask.tsx`).

That is exact for NONE and categorically wrong for anything else, and anything else is what
real scenes author. All 23 lights in the vendored isometric dungeon set `shadow_filter = PCF5`
at `shadow_filter_smooth = 5.0`; Godot's own lights-and-shadows demo uses PCF5 at 1.2. NONE is
only the property's default.

**A stencil cannot be made to express it.** Godot's shadow is a per-light 1D POLAR depth map
sampled with a PCF kernel (`drivers/gles3/shaders/canvas.glsl:458-503`):

```glsl
#define SHADOW_TEST(m_uv) { highp float sd = SHADOW_DEPTH(m_uv); shadow += step(sd, shadow_uv.z / shadow_uv.w); }
// NONE:  1 tap.
// PCF5:  taps at {-2,-1,0,+1,+2} * shadow_pixel_size;  shadow /= 5.0;
// PCF13: taps at {-6..+6}       * shadow_pixel_size;  shadow /= 13.0;
shadow_color.a *= light_color.a;
return mix(light_color, shadow_color, shadow);
```

`shadow` is a FRACTION with five (or thirteen) levels. A stencil test is one bit. So
`shadow_filter` is not a parameter of the existing mechanism — it is a second mechanism.

Three properties of that mechanism decide what can and cannot reproduce it, and all three were
MEASURED through `pnpm ref:godot` against Godot 4.6.3 rather than derived. Fixture: a 0.25-grey
surface, a PCF5 light at `shadow_filter_smooth = 8`, and an open occluder whose upper endpoint
sits at the light's own y, so the umbra boundary is a horizontal ray a vertical probe crosses
perpendicular.

1. **The ramp is STEPPED, not smooth.** A transect at axis distance 276 reads
   167 / 129 / 100 / 80 / 67 / 63 of 255 — six plateaus, one per `s ∈ {0, .2, .4, .6, .8, 1}`.
2. **The falloff is (1−s)², not (1−s).** With the lit term `L = 0.4049`,
   `255 · (0.25 + L·(1−s)²)` predicts 167.0 / 129.8 / 100.9 / 80.3 / 67.9 / 63.8 — every step
   within one level. A plain `(1−s)` would put the first step at 146. The square is structural:
   Godot's `mix` scales `light_color`'s rgb AND its alpha by `(1−s)` at the default transparent
   `shadow_color`, and `light_blend_compute` then multiplies the two together.
3. **The penumbra is TANGENTIAL and grows with distance.** `shadow_pixel_size` is an offset in
   the atlas's u axis, i.e. an ANGLE around the light (`rasterizer_canvas_gles3.cpp:182`). The
   same fixture's step boundaries sit 19.4 px either side of the geometric edge at axis distance
   276 and 40.5 px at 576 — a ratio of 2.087 for a distance ratio of 2.087.

## Decision

**Port Godot's own mechanism — the polar shadow map plus its PCF kernel — and gate it on
`shadow_filter != NONE`, so an unfiltered light keeps the stencil path byte for byte.**

- `shadowPolarMap.ts` builds the map on the CPU: 2048 bins of normalised AXIS distance
  (`canvas_occlusion.glsl:28,56` — not Euclidean), `min` over the occluder edges the light is
  allowed to see, clipped to Godot's `radius_cache / 1000` and `radius_cache * 1.1` planes. It
  addresses bins by Godot's own box mapping, which is provably the same indexing the rasteriser
  uses: quadrant 0's projection maps `(x, y, 0) → (y, 0, -x)` into a `size/4`-wide viewport, so
  a column lands at `(y/x)·(size/8) + (size/8)` — the identical texel `tex_ofs · size` reads.
- The map is uploaded as a 2048×1 half-float `DataTexture` with `LinearFilter` and
  `RepeatWrapping`, which is Godot's own atlas state (`rasterizer_canvas_gles3.cpp:1885-1888`),
  not a choice: the linear read is what rounds each step's corner, and the wrap is what lets a
  tap cross the seam between the last bin and the first.
- `lightQuad.ts` gains a shadow-sampling variant carrying the quadrant block and both tap
  kernels, selected by a `SHADOW_FILTER` define. The quads emit Godot's POST-shadow
  `light_color`, rgb and alpha both, so the existing fixed-function accumulator blends produce
  the (1−s)² falloff for free — no new pass, no new sampler on the item side.
- An authored `shadow_color` COMPOSES rather than falling back. Expanding Godot's
  `mix(light_color, shadow_color, s)` with the albedo already folded in (`canvas.glsl:814` runs
  first) splits with **no cross term** into an albedo-multiplied part and an albedo-free one —
  exactly the two accumulators that already exist, so the split is EXACT rather than an
  approximation, and at `s = 1` it reduces byte-identically to what the stencil path emits
  inside its umbra. The algebra itself stays in `lightQuad.ts`'s header, which is where it will
  be refined: an ADR is an immutable record, so restating a live derivation here would leave the
  wrong one in the document a newcomer reads first.
- A filtered light therefore draws NO stencil mask and carries NO stencil props: each quad
  computes its own fraction over the light's whole rect. The `Equal`/`NotEqual` pairing that
  `ShadowVolumeMask.tsx` documents applies to the unfiltered branch only.

**Why the gate rather than one unified mechanism.** Godot's NONE is itself a map lookup with a
single tap, so collapsing to one mechanism is the cleaner long-term shape. It is not taken here
because the eight `unit-lightoccluder2d-*` baselines currently sit at ~1/255 mean with 0.0% of
pixels over 16/255 against analytic volumes, and a 2048-bin map quantises the boundary to
0.18°. Re-rendering measured-at-parity fixtures through a coarser boundary to gain tidiness is
the wrong trade. Revisit only with probe evidence that it is byte-benign.

## Considered options

**Render the shadow volumes to a texture and blur them.** Rejected: wrong on both axes. A
screen-space blur is a fixed width where Godot's penumbra grows linearly with the box axis
distance, and isotropic where Godot's is purely tangential — and because the width follows the
axis distance, it is not even the same width in two different quadrants at the same radius. It
is also smooth where the measurement shows five hard steps, and it cannot resolve
occluder-behind-occluder depth, which the map does with a `min`.

**Penumbra wedge geometry.** Rejected: penumbrae emanate from silhouette endpoints, so wedges
get the ramp's shape wrong, double-count where two penumbrae overlap (the map resolves overlap
by `min`), cannot produce a five-level staircase, and cannot feed the tint quad the
complementary fraction. More geometry code than the port, for less parity.

**Keep the stencil and blur only its boundary band.** Rejected: two mechanisms active on one
light, joined exactly where Godot's ramp lives — the seam would be the error. The chosen gate
keeps two mechanisms in the CODE but only ever one per light.

**Rasterise the map on the GPU as Godot does.** Rejected: the goldens compare bytes, and a
rasterised map rides the driver's fill-rule and interpolation variance. The map is a pure
function of settled inputs, so the CPU build is both deterministic and cheaper than a per-light
render target.

## Consequences

- **`isometric-dungeon` moves**, and it moves toward Godot: all 23 of its lights are filtered,
  so every shadow edge in it was hard and is now the stepped penumbra. Three new goldens
  (`pointlight2d-shadow-pcf5` / `-pcf13` / `-pcf-color`) pin the mechanism on single-behaviour
  fixtures.
- **The eight `unit-lightoccluder2d-*` goldens must not move by a pixel.** They are all
  filter-NONE, and the gate means they execute not one line of the new path. Any diff there is
  a defect, not a re-baseline.
- **Cost is per light × quad pixels × taps**, in the class pre-pass. Items are untouched: no new
  sampler, no change to the injection, so `MAX_LIGHT_CLASSES` and its sampler ceiling are
  unaffected.
- **The light pose grows two fields** (`worldToLocal`, `radius`) because the map is stated in
  light-local space — which is also what makes a rotated or scaled light come out right, where
  the volumes only ever needed an origin and a rect.
- **MIX plus an authored `shadow_color` remains the approximation it already was**: the base
  term's attenuation cannot be split across two buffers under an interpolating blend. Unchanged
  by this work, and recorded in the PointLight2D sheet's divergences.
- `shadowVolumes.ts`'s header claim that a hard mask is the right approximation was true only
  as a statement about cost; it is rewritten to describe the module's narrowed role.
