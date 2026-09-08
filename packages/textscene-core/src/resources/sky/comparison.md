---
type: Sky
category: Resources
status: unreviewed
renders_as: a THREE PMREM environment + background
---

# Sky

A `Sky` resource's `sky_material` — the source of the background and of the
image-based ambient and reflection. Godot ships three material types; each renders
here as a background plus a PMREM-filtered environment map.

## ProceduralSkyMaterial
<!-- compare: image=unit-sky-procedural status=done fixture=unit-sky-procedural.tscn -->

A gradient sky (top / horizon / ground colours and curves). The warm-top,
green-horizon gradient and the sphere and floor it lights match Godot.

## PanoramaSkyMaterial
<!-- compare: image=unit-sky-panorama status=done fixture=unit-sky-panorama.tscn -->

An equirectangular image wrapped onto the sky. The coloured calibration bands and the
black grid confirm the U/V orientation matches Godot (measured to ~2% earlier).

## PhysicalSkyMaterial
<!-- compare: image=unit-sky-physical status=done fixture=unit-sky-physical.tscn -->

An atmospheric-scattering sky. The grey-blue gradient, the horizon band, and the
sphere and ground it lights match Godot's.

## Linting

<!-- lint:begin Sky -->
Strict parsing format-checks the inherited set (2 inherited from Resource); `Sky` declares none of its own. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
<!-- lint:end -->

The lenient parser never rejects: an unreadable Sky property falls back to Godot's default through the shared value decoders, and an unresolvable material or panorama leaves the background at its fallback rather than failing the scene.
## Known limitations

- **Shader / compressed-cubemap skies** — a `Sky` whose material is a user `shader_type sky` `ShaderMaterial`, or whose panorama is a binary `CompressedCubemap`, is not resolved (we neither run GDShaders nor decode compressed cubemaps). The background falls back to a mid-blue solid and metallic surfaces reflect near-black; AgX, fog, and flat ambient still apply, so diffuse surfaces are unchanged. `ReflectionProbe` is likewise unsupported.
- **Dielectric sky-specular split** — a metal reflects the sky at full strength under any ambient source, and a dielectric's diffuse takes `ambient_light_sky_contribution` exactly; only a dielectric's faint specular lobe (~4% of its response) is scaled with the diffuse rather than kept at full.
