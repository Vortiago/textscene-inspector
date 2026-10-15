---
type: FogVolume
category: 3D
status: unreviewed
fixture: unit-fog-volume.tscn
image: unit-fog-volume
renders_as: density, scattering and emission added to the volumetric fog
---

# FogVolume

A FogVolume adds a local region of fog to the Environment's volumetric fog. A negative-density `FogMaterial` removes fog instead. The previewer adds each volume's density, albedo and emission to the froxels its shape covers, as Godot's volume pass does. It draws nothing where the Environment's volumetric fog is off.

A `FogMaterial` `density_texture` shapes the density by its red channel. It can be a NoiseTexture3D or an ImageTexture3D, inline or saved as its own `.tres`. It can also be an image its import sidecar imports as a 3D texture. A float ImageTexture3D keeps a density above 1, as Godot does.

A `ShaderMaterial` without a shader, or with a shader of another `shader_type` than `fog`, fills the volume with Godot's default fog, as Godot does.

## Linting

<!-- lint:begin FogVolume -->
Strict parsing format-checks these `FogVolume` properties, plus 1 inherited from VisualInstance3D, 17 inherited from Node3D, 10 inherited from Node. A malformed value is always an **error**; a value that is merely outside a bound is an error only where Godot's setter refuses it, and a **warning** where only the property's inspector hint states the bound (ADR-0032).

| Property | Accepts | Out of range |
| --- | --- | --- |
| `material` | null, SubResource("id"), ExtResource("id") or Resource("path") |  |
| `shape` | enum 0-4 (ELLIPSOID/CONE/CYLINDER/BOX/WORLD) | warning |
| `size` | Vector3(x, y, z), each >= 0 (>= 0.01 recommended; 1024 ceiling is or_greater, so unbounded above) | warning below |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | info |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error |
| `valid-fogvolume-size` | `fogvolume-size-ignored-for-world-shape` | info |
<!-- lint:end -->

The lenient parser clamps each negative `size` component to 0, as `set_size` does. It keeps an out-of-range `shape`, which then has no surface, and the default size for a malformed one.

## Known limitations

- **Shader missing** A volume whose material is a fog `ShaderMaterial` adds no fog, where Godot runs its fog shader.
- **Shader missing** A fog shader with a compile error adds no fog, where Godot draws its default fog.
- **Resource gap** A `ShaderMaterial` whose shader is a `.gdshader` file, or whose shader code opens with a preprocessor directive, adds no fog, where Godot draws its default fog for a shader of another `shader_type` than `fog`.
- **Resource gap** An ImageTexture3D saved in a block-compressed image format or an integer format leaves the density even.
- **Approximated** An imported 3D texture reads its source image, so its density differs slightly from Godot's Lossy or VRAM-compressed copy.
- **Approximated** A NoiseTexture3D `density_texture` leaves the density even on first load until its build finishes, where Godot shapes the fog on its first frame.
- **Approximated** Past 2048 stacked slices of distinct density textures in one view, each further texture leaves its density even.
