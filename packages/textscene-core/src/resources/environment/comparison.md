---
type: Environment
category: Resources
renders_as: THREE scene.environment / background / tone mapping / fog
---

# Environment

The resource a `WorldEnvironment` holds — background and sky, ambient light,
tone mapping, glow, and fog. The editor injects a preview Environment on any scene
that declares none (ADR-0025). Each section drives one feature from its own fixture.

## Background sky
<!-- compare: image=unit-sky-procedural status=done fixture=unit-sky-procedural.tscn -->

A `ProceduralSkyMaterial` under `background_mode = BG_SKY`. The gradient — warm top,
green horizon band, ground below — and the sphere and floor it lights match Godot.

## Tone mapping
<!-- compare: image=unit-tonemap-agx-shadow status=done fixture=unit-tonemap-agx-shadow.tscn -->

`tonemap_mode = AGX`. Godot 4.6's AgX curve is ported (fixture-exact to within 2/255
on this scene), so the lit grass reads the same warm green and the shadow crushes to
the same near-black as Godot's.

## Ambient light + sky reflection
<!-- compare: image=unit-stage-ambient-ibl status=limitation fixture=unit-stage-ambient-ibl.tscn -->

`AMBIENT_SOURCE_COLOR` (flat grey) with `ambient_light_sky_contribution = 0`: the
grass is lit only by the flat ambient, while the metallic sphere still reflects the
gold sky at full strength (measured to 1/255). Faithful in the lighting — but the
`SHADOWS_ONLY` box's shadow projects a visibly different shape than Godot's.

## Glow (bloom)
<!-- compare: image=unit-material-emissive status=done fixture=unit-material-emissive.tscn -->

The preview environment enables glow, which blooms the emissive sphere. Both engines
draw the same tight halo hugging the sphere and leave the brown ground behind it
untouched; the sphere's own centre matches Godot's pixel for pixel.

Glow is a real port rather than a stock bloom, because the parts that decide what a
halo looks like are all specific to Godot. The bright pass gates on the PEAK RGB
channel, not Rec. 709 luminance — a saturated blue emissive is the dimmest surface in
the frame by luminance and still blooms — with a `smoothstep` knee across
`[glow_hdr_threshold, glow_hdr_threshold + glow_hdr_scale]`, `glow_bloom` as a FLOOR
on the result rather than a threshold reduction, and a per-channel
`glow_hdr_luminance_cap`. The pyramid's seven levels are weighted independently and
summed unnormalised, and the defaults (`[0, 0.8, 0.4, 0.1, 0, 0, 0]`) are what keeps
the halo local: an equal-weighted pyramid instead lays a haze over the whole frame.
`glow_normalized` divides those weights by their sum, and `glow_strength` multiplies
the buffer at every pyramid pass, so it compounds.

Where the blend happens depends on the mode, and Godot is not uniform about it:
SOFTLIGHT composites AFTER the tone curve with the glow buffer itself tonemapped,
while ADDITIVE, SCREEN, REPLACE and MIX composite into linear HDR before it. All five
are implemented, SCREEN being Godot's default. MIX reads `glow_mix` where the others
read `glow_intensity` — Godot fills one shader uniform from whichever the mode uses,
so they are never both live.

The editor preview environment only ever flips `glow_enabled`, which left every other
knob unreachable by measurement. Each now has a fixture that moves one thing, all
measured with `ref:godot` against Godot 4.6.3 (floor 0.011–0.069%): coarse level
weights under ADDITIVE 0.029%, `glow_strength` 0.000%, SOFTLIGHT over mid-grey
0.010%, MIX 0.025%, REPLACE 0.006%, `glow_bloom` as a feedback floor 0.015%,
`glow_normalized` 0.023%, and glow under AgX 0.143%. The AgX residual is the same
float-precision one its own row records — glow puts a wide dim halo exactly where
that curve's toe is steepest.

Two of those fixtures exist because a default-valued scene cannot fail: `glow_strength`
is inert at 1.0, and the level weights are unobservable while the halo is tight. The
strength fixture caught the pyramid starting an octave too fine while it was being
written.

## Known limitations

- **Volumetric fog** — screen-space fog (`fog_enabled`) maps to `THREE.FogExp2` and is supported; volumetric fog (`volumetric_fog_*`) has no three.js equivalent and is intentionally not approximated.
- **tonemap_exposure under LINEAR** — three emits the exposure uniform only when a tonemapper is active, so an exposure set under the default LINEAR tonemapper is ignored (faithful at the 1.0 default).
- **Switching tone curves at runtime** — three's program cache keys on the tonemapping enum, not the ported chunk text, so a second Environment with a different curve reaching live materials (a hot-reload edit, or a late-loading instanced WorldEnvironment) keeps rendering with the first curve.
- **AGX contrast** — the AgX curve contrast is fixed at Godot 4.6.3's built-in 1.25 (the engine exposes no per-Environment setter in this version); the ~2/255 residual on the controlled fixture is GPU float precision.
- **glow_map** — Godot modulates the glow buffer by a screen-stretched "lens dirt" texture at `glow_map_strength`. The strength is parsed and validated, but the map itself is not resolved, so a scene supplying one gets unmodulated glow. Godot zeroes the strength when no map is set, which is every scene in the corpus.
- **Glow blur kernel** — Godot's downsample is written against integer pixel coordinates and does not transplant onto a normalised-UV fullscreen pass, so the chain uses the standard 13-tap pyramid downsample with a 9-tap tent upsample. The per-level weighting and the pyramid's resolution are ported exactly, and those are what set the halo's shape and size.
