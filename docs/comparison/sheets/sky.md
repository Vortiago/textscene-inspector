---
type: Sky
category: Resources
renders_as: a THREE PMREM environment + background
---

# Sky

A `Sky` resource's `sky_material` — the source of the background and of the
image-based ambient and reflection. Godot ships three material types; each renders
here as a background plus a PMREM-filtered environment map.

## ProceduralSkyMaterial
<!-- compare: image=unit-sky-procedural status=done fixture=unit-sky-procedural.tscn -->

A gradient sky (top / horizon / ground colors and curves). The warm-top,
green-horizon gradient and the sphere and floor it lights match Godot.

## PanoramaSkyMaterial
<!-- compare: image=unit-sky-panorama status=done fixture=unit-sky-panorama.tscn -->

An equirectangular image wrapped onto the sky. The colored calibration bands and the
black grid confirm the U/V orientation matches Godot (measured to ~2% earlier).

## PhysicalSkyMaterial
<!-- compare: image=unit-sky-physical status=done fixture=unit-sky-physical.tscn -->

An atmospheric-scattering sky. The grey-blue gradient, the horizon band, and the
sphere and ground it lights match Godot's.
