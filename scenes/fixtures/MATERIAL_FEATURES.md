# Material Features Showcase

**Fixture**: `integration-material-features.tscn`

This fixture demonstrates all StandardMaterial3D features with various combinations to showcase the rendering capabilities and feature flag behavior.

## Layout

The scene contains 11 spheres arranged in 4 rows, each demonstrating different material properties:

### Row 1 (Y=2) - Basic Properties

| Sphere | Material | Properties | Description |
|--------|----------|------------|-------------|
| **AlbedoOnly** | `Mat_AlbedoOnly` | `albedo_color = (0.8, 0.2, 0.2)` | Simple red albedo color (baseline) |
| **MetallicRough** | `Mat_MetallicRough` | `metallic = 0.9`<br>`roughness = 0.2` | Shiny metal appearance |
| **NonMetallic** | `Mat_NonMetallic` | `metallic = 0.0`<br>`roughness = 0.8` | Matte plastic appearance |

### Row 2 (Y=0) - Feature Flags

| Sphere | Material | Properties | Description |
|--------|----------|------------|-------------|
| **EmissionEnabled** | `Mat_EmissionColor` | `emission_enabled = true`<br>`emission = (0.0, 1.0, 0.5)`<br>`emission_energy_multiplier = 3.0` | Green glow - **SHOULD emit light** |
| **EmissionDisabled** | `Mat_EmissionDisabled` | `emission_enabled = false`<br>`emission = (1.0, 0.0, 0.0)`<br>`emission_energy_multiplier = 5.0` | Red emission IGNORED - **SHOULD NOT glow** (tests WI-62) |
| **NormalEnabled** | `Mat_NormalEnabled` | `normal_enabled = true` | Placeholder for normal mapping (no texture attached) |

### Row 3 (Y=-2) - Advanced Combinations

| Sphere | Material | Properties | Description |
|--------|----------|------------|-------------|
| **NormalDisabled** | `Mat_NormalDisabled` | `normal_enabled = false` | Same as NormalEnabled without texture (control case) |
| **FullPBR** | `Mat_FullPBR` | `metallic = 0.7`<br>`roughness = 0.3`<br>`normal_enabled = true` | Complete PBR material setup |
| **EmissiveMetallic** | `Mat_Emissive_Metallic` | `metallic = 0.8`<br>`roughness = 0.1`<br>`emission_enabled = true`<br>`emission = (0.5, 0.5, 1.0)`<br>`emission_energy_multiplier = 2.0` | Glowing metallic sphere |

### Row 4 (Y=-4) - Transparency

| Sphere | Material | Properties | Description |
|--------|----------|------------|-------------|
| **Transparent** | `Mat_Transparent` | `albedo_color = (0.2, 0.8, 0.2, 0.6)` | Semi-transparent green (60% opacity) |
| **Glass** | `Mat_Glass` | `albedo_color = (0.9, 0.9, 1.0, 0.3)`<br>`metallic = 0.1`<br>`roughness = 0.05` | Glass-like material (30% opacity, very smooth) |

## What to Test

### WI-62: Emission Enable Flag
- **EmissionEnabled** sphere (Row 2, left) should glow green
- **EmissionDisabled** sphere (Row 2, center) should NOT glow despite having red emission color defined
- This validates that `emission_enabled = false` correctly prevents emission texture/color application

### PBR Workflow
- **MetallicRough** vs **NonMetallic** shows the difference between metallic and dielectric materials
- **FullPBR** demonstrates complete physically-based rendering setup
- **EmissiveMetallic** shows emission can combine with metallic properties

### Transparency
- **Transparent** and **Glass** demonstrate alpha blending
- Glass should appear more reflective due to low roughness

## Camera Setup

- **Position**: (0, 4, 8)
- **Rotation**: Looking down at the scene
- **FOV**: 60°

## Lighting

- **DirectionalLight3D** with shadows enabled for realistic material appearance
- Positioned to highlight metallic/roughness differences

## Notes

- All spheres use the same mesh (radius=0.8) for consistency
- Spacing: 2 units between spheres horizontally
- Demonstrates material override via `surface_material_override/0`
