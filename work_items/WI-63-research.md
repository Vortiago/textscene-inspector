# WI-63 Research Report: Comprehensive Texture Enable Flags

**Research Date**: 2025-11-09
**Status**: Complete
**Researcher**: Claude Code

## Executive Summary

Research into Godot's BaseMaterial3D feature flag system reveals **13 texture-based features** that use enable flags, but **NOT all textures require enable flags**. Core PBR properties (albedo, metallic, roughness) are always active when textures are present.

**Key Finding**: Current implementation is **partially correct** - metallic and roughness textures should NOT have enable flags, but emission and AO textures currently lack required flag checks.

## Research Methodology

1. Analyzed Godot source code (`godot/scene/resources/material.h`)
2. Fetched official Godot documentation (BaseMaterial3D.xml)
3. Examined current codebase implementation
4. Searched repository fixtures for real-world usage patterns
5. Verified feature behavior through documentation cross-reference

## Complete Feature Flag Mapping

### Features with Enable Flags (13 Total)

Based on Godot's `Feature` enum in `material.h`:

| Feature Enum | TSCN Property | Texture Property | Priority | Status |
|--------------|---------------|------------------|----------|--------|
| `FEATURE_EMISSION` | `emission_enabled` | `emission_texture` | **HIGH** | ❌ Not implemented (WI-62) |
| `FEATURE_NORMAL_MAPPING` | `normal_enabled` | `normal_texture` | **HIGH** | ✅ Implemented (WI-59) |
| `FEATURE_AMBIENT_OCCLUSION` | `ao_enabled` | `ao_texture` | **HIGH** | ❌ Not implemented |
| `FEATURE_HEIGHT_MAPPING` | `heightmap_enabled` | `heightmap_texture` | MEDIUM | ❌ Not implemented |
| `FEATURE_CLEARCOAT` | `clearcoat_enabled` | `clearcoat_texture` | MEDIUM | ❌ Not implemented |
| `FEATURE_RIM` | `rim_enabled` | `rim_texture` | MEDIUM | ❌ Not implemented |
| `FEATURE_ANISOTROPY` | `anisotropy_enabled` | `anisotropy_flowmap` | LOW | ❌ Not implemented |
| `FEATURE_REFRACTION` | `refraction_enabled` | `refraction_texture` | LOW | ❌ Not implemented |
| `FEATURE_BACKLIGHT` | `backlight_enabled` | `backlight_texture` | LOW | ❌ Not implemented |
| `FEATURE_DETAIL` | `detail_enabled` | `detail_albedo`, `detail_normal`, `detail_mask` | LOW | ❌ Not implemented |
| `FEATURE_SUBSURFACE_SCATTERING` | `subsurf_scatter_enabled` | `subsurf_scatter_texture` | LOW | ❌ Not implemented |
| `FEATURE_SUBSURFACE_TRANSMITTANCE` | `subsurf_scatter_transmittance_enabled` | `subsurf_scatter_transmittance_texture` | LOW | ❌ Not implemented |
| `FEATURE_BENT_NORMAL_MAPPING` | `bent_normal_enabled` | `bent_normal_texture` | LOW | ❌ Not implemented |

### Core PBR Properties WITHOUT Enable Flags

**IMPORTANT**: These textures are **always active** when present (confirmed via Godot docs):

| Property | Texture Property | Current Implementation | Status |
|----------|------------------|------------------------|--------|
| Albedo/Diffuse | `albedo_texture` | Always applied | ✅ Correct |
| Metallic | `metallic_texture` | Always applied | ✅ Correct |
| Roughness | `roughness_texture` | Always applied | ✅ Correct |

**Documentation Confirmation**:
- `metallic_texture` is "multiplied by [member metallic]" with no enable flag
- `roughness_texture` is "multiplied by [member roughness]" with no enable flag
- These are core PBR properties, not optional features

## Current Implementation Analysis

### What's Implemented Correctly ✅

```typescript
// normal_enabled - CORRECT (WI-59)
if (properties.normal_enabled && properties.normal_texture) {
  materialOptions.normalMap = properties.normal_texture;
}

// metallic_texture - CORRECT (no enable flag needed)
if (properties.metallic_texture) {
  materialOptions.metalnessMap = properties.metallic_texture;
}

// roughness_texture - CORRECT (no enable flag needed)
if (properties.roughness_texture) {
  materialOptions.roughnessMap = properties.roughness_texture;
}
```

### What's Broken ❌

```typescript
// emission_texture - WRONG (missing emission_enabled check)
if (properties.emission_texture) {
  materialOptions.emissiveMap = properties.emission_texture;  // Should check emission_enabled!
}

// ao_texture - WRONG (missing ao_enabled check)
if (properties.ao_texture) {
  materialOptions.aoMap = properties.ao_texture;  // Should check ao_enabled!
}
```

**Impact**:
- `unit-material-emissive.tscn` has `emission_enabled = true` but flag is ignored
- If user sets `emission_enabled = false`, emission will still apply incorrectly
- Same issue will occur with AO textures when encountered

## Real-World Usage Analysis

### Repository Fixtures

Searched all `.tscn` files in `/home/user/Text-Scene-.tscn-File-Previewer/scenes`:

| Enable Flag | Found In | Usage |
|-------------|----------|-------|
| `emission_enabled` | `unit-material-emissive.tscn` | `emission_enabled = true` (line 13) |
| `normal_enabled` | `unit-material-normal-map.tscn` | `normal_enabled = true/false` |
| Others | Not found | No other enable flags in fixtures |

**Texture Usage Without Enable Flags**:
- `metallic_texture` found in `unit-material-textured.tscn` (no enable flag - correct)
- `roughness_texture` found in `unit-material-textured.tscn` (no enable flag - correct)

### ld-58 Corpus Analysis

**Note**: ld-58 game jam project referenced in TODO.md Phase 4 was not accessible in this environment. Based on TODO.md:
- Material override support is critical (207 instances)
- WorldEnvironment needed
- Normal maps expected (hence WI-59 implementation)

**Recommendation**: When ld-58 corpus becomes available, scan for additional enable flag usage.

## Priority Classification

### Tier 1: Critical (Implement Immediately) 🔴

**Rationale**: Already in use or breaks existing fixtures

1. **emission_enabled** - HIGH PRIORITY ⭐⭐⭐
   - Already used in `unit-material-emissive.tscn`
   - Fixture broken without implementation
   - WI-62 already exists for this
   - Three.js mapping: `emissiveMap`

2. **ao_enabled** - HIGH PRIORITY ⭐⭐⭐
   - Common in PBR workflows
   - Texture already parsed (`ao_texture`)
   - Three.js mapping: `aoMap`
   - Likely used in ld-58 scenes

### Tier 2: Important (Create Work Items) 🟡

**Rationale**: Common in 3D workflows, moderate usage expected

3. **heightmap_enabled** - MEDIUM PRIORITY ⭐⭐
   - Parallax mapping for depth effects
   - Three.js mapping: `displacementMap` or custom shader
   - Additional properties: `heightmap_scale`, `heightmap_deep_parallax`, etc.

4. **clearcoat_enabled** - MEDIUM PRIORITY ⭐
   - Glossy finish layer (car paint, plastic)
   - Three.js mapping: `clearcoat`, `clearcoatMap`, `clearcoatRoughnessMap`
   - Additional properties: `clearcoat`, `clearcoat_roughness`

5. **rim_enabled** - MEDIUM PRIORITY ⭐
   - Edge highlighting effect
   - Three.js mapping: Custom shader or `emissive` approximation
   - Additional properties: `rim`, `rim_tint`

### Tier 3: Specialized (Defer Until Requested) 🟢

**Rationale**: Advanced features, rare usage

6. **anisotropy_enabled** - LOW PRIORITY
   - Directional reflection (brushed metal)
   - Three.js mapping: `anisotropy`, `anisotropyMap` (requires extension)
   - Additional properties: `anisotropy`, `anisotropy_flowmap`

7. **refraction_enabled** - LOW PRIORITY
   - Glass/water materials
   - Three.js mapping: Custom shader (not in MeshStandardMaterial)
   - Additional properties: `refraction_scale`, `refraction_texture_channel`

8. **backlight_enabled** - LOW PRIORITY
   - Translucency effect
   - Three.js mapping: Custom shader or `transmission`
   - Additional properties: `backlight` color

9. **detail_enabled** - LOW PRIORITY
   - Texture layering (detail overlay)
   - Three.js mapping: Custom shader (blend two textures)
   - Additional properties: `detail_albedo`, `detail_normal`, `detail_mask`, `detail_blend_mode`

10. **subsurf_scatter_enabled** - LOW PRIORITY
    - Skin/wax materials
    - Three.js mapping: Custom shader (not in MeshStandardMaterial)
    - Additional properties: `subsurf_scatter_strength`, `subsurf_scatter_skin_mode`

11. **subsurf_scatter_transmittance_enabled** - LOW PRIORITY
    - Advanced subsurface effect
    - Three.js mapping: Custom shader
    - Additional properties: `subsurf_scatter_transmittance_depth`, `subsurf_scatter_transmittance_color`

12. **bent_normal_enabled** - LOW PRIORITY
    - Advanced indirect lighting
    - Three.js mapping: Custom shader (not standard)
    - Additional properties: `bent_normal_texture`

13. **proximity_fade_enabled** - LOW PRIORITY
    - Not a texture feature (distance-based fade)
    - Three.js mapping: Custom shader
    - Additional properties: `proximity_fade_distance`

## Implementation Roadmap

### Phase 1: Fix Critical Issues (WI-64, WI-65)

**Estimated Effort**: 2-3 hours per feature

1. **WI-64: Implement `emission_enabled` Support**
   - Replaces/completes WI-62
   - Types, parser, renderer, linter validators
   - 15 unit tests (6 renderer + 7 parser + 2 linter)
   - Fix `unit-material-emissive.tscn` fixture
   - **Dependencies**: WI-52 (External Texture Loading) ✅

2. **WI-65: Implement `ao_enabled` Support**
   - Same pattern as emission
   - Types, parser, renderer, linter validators
   - 15 unit tests
   - Create `unit-material-ao.tscn` fixture
   - **Dependencies**: WI-64 (establishes pattern)

### Phase 2: Add Common Features (WI-66, WI-67, WI-68)

**Estimated Effort**: 3-4 hours per feature (requires research into three.js mapping)

3. **WI-66: Implement `heightmap_enabled` Support**
   - Parallax/displacement mapping
   - Research three.js `displacementMap` vs custom shader
   - Additional properties: scale, flip flags, min/max layers
   - Create visual fixture

4. **WI-67: Implement `clearcoat_enabled` Support**
   - Three.js has native clearcoat support
   - Additional properties: `clearcoat`, `clearcoat_roughness`
   - Create visual fixture (glossy sphere)

5. **WI-68: Implement `rim_enabled` Support**
   - Requires custom shader or emissive approximation
   - Research Fresnel effect implementation
   - Additional properties: `rim`, `rim_tint`
   - Create visual fixture

### Phase 3: Defer Advanced Features

**Strategy**: Create work items but don't implement until:
- User requests feature
- Found in real-world TSCN files
- Community feedback indicates need

**Work Items to Create** (no implementation):
- WI-69: Anisotropy Support (low priority)
- WI-70: Refraction Support (low priority)
- WI-71: Backlight Support (low priority)
- WI-72: Detail Map Support (low priority)
- WI-73: Subsurface Scattering Support (low priority)
- WI-74: Subsurface Transmittance Support (low priority)
- WI-75: Bent Normal Mapping Support (low priority)

## Three.js Mapping Reference

| Godot Property | Three.js MeshStandardMaterial | Implementation Complexity |
|----------------|-------------------------------|---------------------------|
| `emission_texture` | `emissiveMap` | ✅ Direct mapping |
| `ao_texture` | `aoMap` | ✅ Direct mapping |
| `normal_texture` | `normalMap` | ✅ Direct mapping (done) |
| `heightmap_texture` | `displacementMap` | ⚠️ Requires geometry vertices |
| `clearcoat_texture` | `clearcoatMap` | ✅ Direct mapping |
| `rim_texture` | Custom shader | ⚠️ Requires shader extension |
| `anisotropy_flowmap` | `anisotropyMap` | ⚠️ Requires extension |
| `refraction_texture` | Custom shader | ⚠️ Not in standard material |
| `backlight_texture` | `transmission` (approx) | ⚠️ Custom shader better |
| `detail_*` | Custom shader | ⚠️ Requires dual texture blending |
| `subsurf_scatter_texture` | Custom shader | ⚠️ Not in standard material |
| `bent_normal_texture` | Custom shader | ⚠️ Advanced lighting |

**Legend**:
- ✅ Direct mapping to three.js property
- ⚠️ Requires custom shader or extension

## Testing Strategy

### Per-Feature Testing Checklist

For each implemented feature (following WI-59/WI-62 pattern):

**Unit Tests** (15 per feature):
1. Apply texture when enabled=true and texture provided ✅
2. Do NOT apply when enabled=false ❌
3. Do NOT apply when enabled=undefined ❌
4. Do NOT apply when texture is null 🚫
5. Handle missing both flag and texture 🚫
6. Allow enabled=true without texture (no crash) 🛡️
7. Parse "true" as boolean true ✅
8. Parse "false" as boolean false ❌
9. Parse invalid value as false ⚠️
10. Leave undefined when not specified 🚫
11. Parse independently of texture presence 🔗
12. Handle enabled=true without texture 🚫
13. Handle enabled=false with texture present ⚠️
14. Validator accepts "true" ✅
15. Validator rejects invalid boolean ❌

**Integration Tests**:
- Create `.tscn` fixture for each feature
- Add to `apps/textscene-web/src/fixtures.ts`
- Visual verification in web app
- Test toggle enabled=true/false behavior

### Regression Testing

After each implementation:
- ✅ All 3,400+ existing tests still pass
- ✅ Type checking succeeds
- ✅ Linting passes
- ✅ Existing fixtures unchanged

## Recommendations

### Immediate Actions

1. **Complete WI-62 (emission_enabled)** - Fixture already broken
2. **Create WI-64 (ao_enabled)** - High usage likelihood
3. **Update WI-63 status** to "Research Complete"

### Pattern Consistency Rules

**Every new feature MUST**:
1. Add `<feature>_enabled?: boolean` to types
2. Parse flag: `result.<feature>_enabled = properties.<feature>_enabled === 'true'`
3. Check flag: `if (properties.<feature>_enabled && properties.<feature>_texture)`
4. Register validator: `<feature>_enabled: validateBoolean`
5. Add 15 unit tests (6 renderer + 7 parser + 2 linter)
6. Create visual fixture if effect is visible
7. Follow exact WI-59 pattern

### Scope Control

**DO implement**:
- Tier 1 (Critical) features immediately
- Tier 2 (Important) features as work items
- Create work items for Tier 3 (Specialized) but don't implement

**DON'T implement**:
- Features not found in any TSCN files
- Features requiring extensive custom shaders (until requested)
- All 13 features at once (scope too large)

### Documentation Updates

After Phase 1 completion:
- Update `ARCHITECTURE.md` with enable flag pattern explanation
- Update `CLAUDE.md` with feature implementation guidelines
- Add comment to `standardmaterial3d/renderer.ts` explaining pattern

## Success Metrics

**Research Phase Success** ✅:
- [x] All 13 Godot feature flags identified
- [x] TSCN property names documented
- [x] Confirmed which textures need enable flags
- [x] Repository fixtures analyzed
- [x] Priorities classified (Tier 1/2/3)
- [x] Implementation roadmap created

**Next Steps**:
1. Create work items WI-64 through WI-75
2. Implement WI-64 (emission_enabled) immediately
3. Implement WI-65 (ao_enabled) next
4. Defer Tier 2/3 features until Phase 2

## References

### Godot Documentation
- **Source Code**: [godot/scene/resources/material.h](https://github.com/godotengine/godot/blob/master/scene/resources/material.h)
- **XML Documentation**: [BaseMaterial3D.xml](https://github.com/godotengine/godot/blob/master/doc/classes/BaseMaterial3D.xml)
- **Official Docs**: https://docs.godotengine.org/en/stable/classes/class_basematerial3d.html

### Three.js Documentation
- **MeshStandardMaterial**: https://threejs.org/docs/#api/en/materials/MeshStandardMaterial
- **Material Properties**: https://threejs.org/docs/#api/en/materials/Material

### Internal Code
- **Pattern Reference**: `packages/textscene-core/src/resources/materials/standardmaterial3d/renderer.ts:42-44`
- **Parser Reference**: `packages/textscene-core/src/resources/materials/standardmaterial3d/parser.ts:69-71`
- **Test Reference**: `packages/textscene-core/src/resources/materials/standardmaterial3d/renderer.test.ts:135-180`

## Appendix: Full Property List

### Properties Discovered from BaseMaterial3D.xml

**Enable Flags** (14 total):
- `anisotropy_enabled`
- `ao_enabled`
- `backlight_enabled`
- `bent_normal_enabled`
- `clearcoat_enabled`
- `detail_enabled`
- `emission_enabled`
- `heightmap_enabled`
- `normal_enabled`
- `proximity_fade_enabled`
- `refraction_enabled`
- `rim_enabled`
- `subsurf_scatter_enabled`
- `subsurf_scatter_transmittance_enabled`

**Texture Properties**:
- `albedo_texture` (no enable flag)
- `metallic_texture` (no enable flag)
- `roughness_texture` (no enable flag)
- `normal_texture` (requires `normal_enabled`)
- `emission_texture` (requires `emission_enabled`)
- `ao_texture` (requires `ao_enabled`)
- `heightmap_texture` (requires `heightmap_enabled`)
- `clearcoat_texture` (requires `clearcoat_enabled`)
- `rim_texture` (requires `rim_enabled`)
- `anisotropy_flowmap` (requires `anisotropy_enabled`)
- `refraction_texture` (requires `refraction_enabled`)
- `backlight_texture` (requires `backlight_enabled`)
- `detail_albedo` (requires `detail_enabled`)
- `detail_normal` (requires `detail_enabled`)
- `detail_mask` (requires `detail_enabled`)
- `subsurf_scatter_texture` (requires `subsurf_scatter_enabled`)
- `subsurf_scatter_transmittance_texture` (requires `subsurf_scatter_transmittance_enabled`)
- `bent_normal_texture` (requires `bent_normal_enabled`)

**Additional Properties** (non-texture):
- `ao_light_affect`, `ao_texture_channel`
- `heightmap_scale`, `heightmap_deep_parallax`, `heightmap_flip_*`, `heightmap_min/max_layers`
- `clearcoat`, `clearcoat_roughness`
- `rim`, `rim_tint`
- `anisotropy`
- `refraction_scale`, `refraction_texture_channel`
- `backlight` (Color)
- `detail_blend_mode`, `detail_uv_layer`
- `emission`, `emission_energy_multiplier`, `emission_intensity`, `emission_on_uv2`, `emission_operator`
- `subsurf_scatter_strength`, `subsurf_scatter_skin_mode`
- `subsurf_scatter_transmittance_*` (boost, color, depth)
- `proximity_fade_distance`
