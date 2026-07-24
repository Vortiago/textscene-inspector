---
type: StandardMaterial3D
category: Resources
renders_as: a THREE.MeshStandardMaterial / MeshPhysicalMaterial
---

# StandardMaterial3D

Godot's default 3D surface. Its scalar PBR base (albedo, metallic, roughness,
emission) maps onto `MeshStandardMaterial`; the extra feature flags (clearcoat,
rim, anisotropy, refraction) upgrade the surface to `MeshPhysicalMaterial`. Each
section below drives one feature from its own fixture and shows the two engines
side by side.

## Metallic / roughness
<!-- compare: image=unit-material-metallic status=done fixture=unit-material-metallic.tscn -->

A `metallic = 1.0`, `roughness = 0.1` sphere reflects the preview sky. Both engines
render the same blue-grey mirror with a matching specular highlight.

Known edge: Godot reads the map channel named by `metallic_texture_channel` /
`roughness_texture_channel` (default RED); three.js reads fixed channels (blue for
metalness, green for roughness), so a dedicated map packed in RED is misread. The
common grayscale / ORM packings are faithful.

## Emission
<!-- compare: image=unit-material-emissive status=done fixture=unit-material-emissive.tscn -->

An emissive sphere at `emission_energy = 2.0` glows cyan in both. The editor
preview environment blooms it; ours blooms a little stronger and coarser than
Godot's glow. With the default ADD emission operator plus BOTH a colored emission
and an `emission_texture`, Godot computes `(emission + tex) * energy` — three.js's
emissive map is multiply-only, so that combination can't be reproduced.

## Clearcoat
<!-- compare: image=unit-material-clearcoat status=done fixture=unit-material-clearcoat.tscn -->

A red sphere with a glossy clear coat. `clearcoat` maps to
`MeshPhysicalMaterial.clearcoat`; both engines show the red body under a tight
glossy highlight.

## Rim
<!-- compare: image=unit-material-rim status=limitation fixture=unit-material-rim.tscn -->

Godot's `rim` is a Fresnel edge term on an otherwise dark sphere. three.js has no
rim, so it maps to `sheen` with a low `sheenRoughness` to keep the highlight at the
edge (a broad sheen washed the dark body out to bright grey — now fixed). The body
matches Godot, but the sheen is retroreflective — a crescent where view meets light
— rather than an even ring around the whole silhouette.

## Anisotropy
<!-- compare: image=unit-material-anisotropy status=limitation fixture=unit-material-anisotropy.tscn -->

`anisotropy` stretches the specular highlight directionally. Both show a brushed-
metal streak, but ours reads sharper and more radial where Godot's is a soft,
smoother lobe.

## Refraction
<!-- compare: image=unit-material-refraction status=limitation fixture=unit-material-refraction.tscn -->

Godot's refraction is a screen-space distortion of the background, so the sphere
reads bright (it samples the light sky). three.js has no screen-space refraction;
`refraction_enabled` maps to volumetric `transmission` + `thickness`, which reads
dark here (it transmits the dark ground). Same effect in kind, very different in
appearance.

## Height mapping
<!-- compare: image=unit-material-heightmap status=limitation fixture=unit-material-heightmap.tscn -->

Godot's `heightmap_*` is texture-space parallax — the silhouette stays a smooth
sphere. three.js has no parallax; it maps to `displacementMap`, which moves real
vertices, so the sphere deforms into a lumpy blob (and the depth scale is in world
units, a different space than Godot's).

## Known limitations

- **diffuse_mode** — Godot defaults to Burley; three's material is always Lambert. They agree near normal incidence; a rough sphere reads ~5/255 dark at grazing silhouette.
- **metallic_specular** — three hard-wires dielectric F0 at 0.04 (Godot's 0.5 default). Authoring it away from 0.5 has no effect.
- **uv1 V-anchoring** — Godot measures V from the image top, three from the bottom, so a non-integer `uv1_scale.y` or non-zero `uv1_offset.y` shifts V differently. Under `uv1_world_triplanar`, `uv1_offset` is in world units and is not converted.
- **billboard_mode** — orientation is faithful, but `billboard_keep_scale = false` (scale normalized away while billboarding) is not honored, and a billboarded mesh's child nodes inherit its rotation (Godot's per-surface effect does not turn children).
- **Triplanar on curved meshes** — tiling density is exact for planar meshes; curved / GLB geometry falls back to the mesh's own UVs.
