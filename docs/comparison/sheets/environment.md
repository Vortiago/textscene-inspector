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
<!-- compare: image=unit-material-emissive status=limitation fixture=unit-material-emissive.tscn -->

The preview environment enables glow, which blooms emissive content. Ours reproduces
the bloom, but with a stronger, coarser blend than Godot's editor glow — the halo
spreads wider and reads brighter.
