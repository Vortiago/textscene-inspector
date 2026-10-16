---
type: Sky
category: Resources
renders_as: Godot's radiance layers as an octmap array + a THREE PMREM environment + background
---

# Sky

A `Sky` resource's `sky_material` is the source of the background and of the image-based ambient and reflection. Each of Godot's three material types renders here as a background and two light sources. Godot's radiance layers, baked as Godot bakes them into an octmap array with a mip chain per layer, give every reflection and the ambient light. Each read picks its mip from the screen derivatives of its direction, as Godot does. A small, strongly curved mirror reads a coarser mip than a large one. The radiance renders at the sky's `radiance_size`, so a small size blurs a mirror as in Godot. A size above 256 renders at 256, as Godot draws rough metal at 512 and at 256 alike.

## ProceduralSkyMaterial
<!-- compare: image=unit-sky-procedural status=done fixture=unit-sky-procedural.tscn -->

A gradient sky from top, horizon and ground colours. The warm-top, green-horizon gradient and the sphere and floor it lights match Godot. Godot multiplies each sRGB colour by its energy multiplier before the linear conversion, and so does the previewer. The sky carries Godot's debanding noise, up to 1/255 per pixel, and `use_debanding = false` turns it off.

## PanoramaSkyMaterial
<!-- compare: image=unit-sky-panorama status=done fixture=unit-sky-panorama.tscn -->

An equirectangular image wrapped onto the sky. The coloured calibration bands and the black grid confirm the U/V orientation matches Godot.

## PhysicalSkyMaterial
<!-- compare: image=unit-sky-physical status=done fixture=unit-sky-physical.tscn -->

An atmospheric-scattering sky. The grey-blue gradient, the horizon band, and the sphere and ground it lights match Godot's. It carries the same debanding noise as the procedural sky.

## Sun disc size
<!-- compare: image=unit-sky-sun-angular-distance status=done fixture=unit-sky-sun-angular-distance.tscn -->

A DirectionalLight3D's `light_angular_distance` sets the size of its sun disc in the sky, as Godot passes it to the sky shader in radians. This 3 degree sun draws a solid disc with a glow around it, as in Godot. A light with no angular distance draws a point sun.

## Radiance size 32
<!-- compare: image=unit-sky-radiance-size-32 status=done fixture=unit-sky-radiance-size-32.tscn -->

A sky with `radiance_size = 0` bakes from a radiance 32 texels wide, the smallest Godot allows. The mirror sphere reflects a coarse sky, and the rough sphere reads layers filtered from a 32-wide octmap and its short downsample chain. Both spheres and the ground they light match Godot's.

## Real-Time process mode
<!-- compare: image=unit-sky-realtime status=done fixture=unit-sky-realtime.tscn -->

A sky with `process_mode = 3` bakes its layers with Godot's fast filter, at a radiance size of 256 whatever `radiance_size` says. Its ambient reads layer 6, its roughest. The metallic sphere's reflection, the default sphere and the ground it lights match Godot's.

## Linting

<!-- lint:begin Sky -->
Strict parsing format-checks these `Sky` properties, plus 2 inherited from Resource. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `process_mode` | enum 0-3 (PROCESS_MODE_AUTOMATIC/PROCESS_MODE_QUALITY/PROCESS_MODE_INCREMENTAL/PROCESS_MODE_REALTIME) | warning |
| `radiance_size` | enum 0-6 (RADIANCE_SIZE_32/RADIANCE_SIZE_64/RADIANCE_SIZE_128/RADIANCE_SIZE_256/RADIANCE_SIZE_512/RADIANCE_SIZE_1024/RADIANCE_SIZE_2048) | error |
| `sky_material` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-sky` | `real-time-sky-radiance-size` | warning |
<!-- lint:end -->

The lenient parser never rejects. An unreadable Sky property falls back to Godot's default through the shared value decoders. An unresolvable material or panorama leaves the background at its fallback rather than failing the scene.

## Known limitations

- **Resource gap** A `ShaderMaterial` sky or a `CompressedCubemap` panorama is not resolved, so the background falls back to a mid-blue solid and metals reflect near-black.
