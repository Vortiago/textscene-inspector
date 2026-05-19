# Strict Verification Framework

Root-cause of the UV/texture gap: verifiers tested "scene loads and renders" rather than "each property produces the right THREE.js output". This document defines the three-layer response — automated regression tests, graph snapshots, and a strict verifier protocol — plus the process for applying them to the current branch.

---

## 1. Per-Property Regression Tests (automated, CI-blocking)

**Location**: co-located with the component they cover, named `Component.<category>.test.tsx`.  
**Tool**: Vitest + `@react-three/test-renderer`. Every test is synchronous — no `vi.waitFor`, no polling.  
**Rule**: one test file per property category per component. Each test parses a minimal inline TSCN string (or passes props directly), renders via test-renderer, and asserts the exact THREE.js value. A test that passes with the wrong value is worse than no test.

### Property inventory (94 properties, 6 categories)

#### A. Node3D transform — file: `node3d/Component.transform.test.tsx`
1. `position` x
2. `position` y
3. `position` z
4. `rotation` x (degrees → radians conversion)
5. `rotation` y
6. `rotation` z
7. `scale` x
8. `scale` y
9. `scale` z
10. All-default (omitted) → identity transform (position 0,0,0; scale 1,1,1; rotation 0,0,0)

#### B. MeshInstance3D — file: `meshinstance3d/Component.mesh-flags.test.tsx`
11. `mesh` resolved → geometry present on `<mesh>` child
12. `material_override` resolved → overrides surface material
13. `surface_material_override/0` → slot 0 overridden, other slots untouched
14. `surface_material_override/1` with slot 0 absent → slot 1 overridden
15. `visible = false` → `mesh.visible === false`
16. `cast_shadow = false` → `mesh.castShadow === false`
17. `cast_shadow = true` → `mesh.castShadow === true`

#### C. StandardMaterial3D scalars — file: `meshinstance3d/Component.material-scalars.test.tsx`
18. `albedo_color` RGB → `material.color` matches
19. `albedo_color` alpha < 1 → `material.opacity` < 1 and `material.transparent === true`
20. `metallic` 0.0 → `material.metalness === 0`
21. `metallic` 1.0 → `material.metalness === 1`
22. `metallic` 0.5 → `material.metalness === 0.5`
23. `roughness` 0.0 → `material.roughness === 0`
24. `roughness` 1.0 → `material.roughness === 1`
25. `opacity` < 1 → `material.opacity` matches and `material.transparent === true`
26. `emission_enabled = false` → `material.emissiveIntensity === 0`
27. `emission_enabled = true` + `emission` color → `material.emissive` matches
28. `emission_energy_multiplier` → `material.emissiveIntensity` matches
29. `transparency` flag (ALPHA mode) → `material.transparent === true`
30. `blend_mode` (ADD) → `material.blending === THREE.AdditiveBlending`
31. `cull_mode` DISABLED → `material.side === THREE.DoubleSide`

#### D. StandardMaterial3D textures — file: `meshinstance3d/Component.material-textures.test.tsx`
32. `albedo_texture` → `material.map` is a `THREE.Texture` (status loaded)
33. `albedo_texture` missing → `material.map === null`, material tinted magenta
34. `normal_texture` → `material.normalMap` is a `THREE.Texture`
35. `normal_scale` 2.0 → `material.normalScale.x === 2.0` and `.y === 2.0`
36. `roughness_texture` → `material.roughnessMap` is a `THREE.Texture`
37. `metallic_texture` → `material.metalnessMap` is a `THREE.Texture`
38. `emission_texture` → `material.emissiveMap` is a `THREE.Texture`
39. Multiple texture slots present simultaneously → all five map slots populated

#### E. StandardMaterial3D UV — file: `meshinstance3d/Component.material-uv.test.tsx`
40. `uv1_scale` x=2 → `material.map.repeat.x === 2`
41. `uv1_scale` y=3 → `material.map.repeat.y === 3`
42. `uv1_scale` z component ignored (THREE has no z repeat) — assert no error thrown
43. `uv1_offset` x=0.25 → `material.map.offset.x === 0.25`
44. `uv1_offset` y=0.5 → `material.map.offset.y === 0.5`
45. UV scale 0 → `repeat` is 0 (not default 1) and no divide-by-zero
46. Negative UV scale → `repeat` is negative (flip) — no error
47. UV applies to ALL active texture maps (not just albedo) — assert `normalMap.repeat.x`, `roughnessMap.repeat.x`, `metalnessMap.repeat.x`, `emissiveMap.repeat.x` all match `uv1_scale`

#### F. Mesh primitives — file: `meshinstance3d/Component.primitives.test.tsx`
48. `BoxMesh.size` x/y/z → `BoxGeometry.parameters.width/height/depth`
49. `SphereMesh.radius` → `SphereGeometry.parameters.radius`
50. `SphereMesh.height` → `SphereGeometry.parameters.heightSegments` (mapped via parser)
51. `SphereMesh.radial_segments` → `SphereGeometry.parameters.widthSegments`
52. `PlaneMesh.size` x/y → `PlaneGeometry.parameters.width/height`
53. `PlaneMesh.center_offset` → geometry translate applied
54. `PlaneMesh.orientation` FACE_Y / FACE_X / FACE_Z → rotation applied correctly
55. `CylinderMesh.top_radius` / `bottom_radius` / `height` → `CylinderGeometry.parameters`
56. `CapsuleMesh.radius` → `CapsuleGeometry.parameters.radius`
57. `CapsuleMesh.height` → `CapsuleGeometry.parameters.height` (THREE 0.184 — NOT `.length`)
58. `TorusMesh.inner_radius` / `outer_radius` → torus parameters
59. `PrismMesh.size` → prism geometry extents (or fallback if mapped)

#### G. Camera3D — file: `camera3d/Component.props.test.tsx`
60. `fov` → `PerspectiveCamera.fov`
61. `near` → `camera.near`
62. `far` → `camera.far`
63. `projection = 1` (ORTHOGRAPHIC) → `OrthographicCamera` is used, not `PerspectiveCamera`
64. `projection = 0` (PERSPECTIVE) → `PerspectiveCamera` is used
65. `size` (ortho) → `OrthographicCamera` frustum width
66. `keep_aspect` KEEP_WIDTH / KEEP_HEIGHT → aspect correction applied

#### H. Light components — file: `lights/Component.props.test.tsx`
67. `DirectionalLight3D.light_color` → `THREE.DirectionalLight.color`
68. `DirectionalLight3D.light_energy` → `THREE.DirectionalLight.intensity`
69. `DirectionalLight3D.shadow_enabled = true` → `light.castShadow === true`
70. `DirectionalLight3D.shadow_enabled = false` → `light.castShadow === false`
71. `OmniLight3D.light_color` → `THREE.PointLight.color`
72. `OmniLight3D.light_energy` → `THREE.PointLight.intensity`
73. `OmniLight3D.omni_range` → `THREE.PointLight.distance`
74. `OmniLight3D.shadow_enabled` → `light.castShadow`
75. `SpotLight3D.light_color` → `THREE.SpotLight.color`
76. `SpotLight3D.light_energy` → `THREE.SpotLight.intensity`
77. `SpotLight3D.spot_range` → `THREE.SpotLight.distance`
78. `SpotLight3D.spot_angle` degrees → `THREE.SpotLight.angle` radians
79. `SpotLight3D.spot_attenuation` → `THREE.SpotLight.penumbra`
80. `SpotLight3D.shadow_enabled` → `light.castShadow`

#### I. WorldEnvironment — file: `worldenvironment/Component.props.test.tsx`
81. `background_mode` SKY → scene background is set
82. `background_mode` COLOR → `scene.background` is `THREE.Color`
83. `background_color` → `scene.background` color value
84. `ambient_light_color` → ambient light color
85. `ambient_light_energy` → ambient light intensity
86. `fog_enabled = false` → `scene.fog === null`
87. `fog_enabled = true` → `scene.fog` is non-null
88. `fog_color` → `scene.fog.color`
89. `fog_density` → `scene.fog.density`

#### J. Label3D — file: `label3d/Component.props.test.tsx`
90. `text` → label text content rendered
91. `font_size` → scale or size applied
92. `modulate` color → color applied
93. `billboard = true` → billboard mode set
94. `no_depth_test = true` → `material.depthTest === false`

#### K. GenericNodeFallback — file: `genericnodefallback/Component.test.tsx`
95. Unregistered node type → `<GenericNodeFallback>` renders with `userData.nodeType` and `userData.nodeName`
96. Fallback is visible (non-zero bounding box or helper present)

**Total: 96 property assertions across 9 test files.**

Each assertion has three variants unless noted: default-omitted (parser default), explicit value, and one edge/extreme value.

---

## 2. Scene-Graph Snapshot Tests (semi-automated)

**Tool**: Vitest snapshot assertions on `renderer.scene.toGraph()` output.  
**Location**: `tests/__snapshots__/<fixture-name>.snap.json`  
**When to run**: CI on every push. Update snapshots intentionally with `pnpm test -- --update-snapshots`.

One snapshot per file in `scenes/fixtures/unit-*.tscn` and `scenes/examples/integration-*.tscn`. The snapshot records the THREE.js tree shape: node types, material types, geometry types, and the key scalar properties listed in Section 1.

**Snapshots catch regressions that property tests miss** — e.g., a node that disappears from the tree entirely, a geometry type swap (SphereGeometry → BoxGeometry), or a material being dropped. They do not replace Section 1 — property tests are faster to debug when a snapshot diff shows a wrong value.

**Pixel-diff is NOT pursued** in this WI. Cross-platform antialiasing and font rendering make pixel-diff flaky. The scene graph captures enough signal to detect the class of bugs we hit.

**Snapshot regeneration procedure**: when intentional rendering changes are made, run `pnpm test -- --update-snapshots`, review the diff in git before committing, and commit the updated `.snap.json` files alongside the source change.

---

## 3. Verifier Protocol (strict)

Verifiers may not mark a flow PASS unless every property check within it is either PASS or CANT-VERIFY with an accepted reason.

### Checklist template

```markdown
### WEB-XX: <flow name>

Fixture: `scenes/fixtures/<name>.tscn`
Commit: <sha>

Properties exercised:
| Property | Expected value | Observed value | Result |
|----------|---------------|----------------|--------|
| albedo_color | Color(1,0,0,1) → red mesh | red pixels at mesh center | PASS |
| uv1_scale | Vector3(2,2,1) → repeat.x=2 | repeat.x=1 | FAIL |
| normal_texture | normalMap set on material | material.normalMap = null | FAIL |

Overall: FAIL (2 failures above)
```

**Accepted CANT-VERIFY reasons**:
- Canvas pixel sampling blocked by cross-origin iframe restrictions
- drei `<Text>` content not accessible via DOM query (rendered to canvas)

**Not accepted**:
- "Looks fine to me"
- "I assume it works because the unit test passed" — unit tests cover parser output; the verifier checks the rendered result
- "It was working before" — each verification run is independent

**CANT-VERIFY escalation rule**: if a verifier marks a property CANT-VERIFY and no Section 1 regression test covers that property, they must escalate to team-lead before marking the flow PASS. The escalation is blocked — flow stays open.

---

## 4. Process for the Current Branch

1. **Implementer** completes WI-R3F-8 (UV + texture slots fix), then writes the Section 1 regression tests as **WI-R3F-9** before any re-verification starts. Tests must be green on the fixed code before verifiers re-run.
2. **Implementer** generates and commits Section 2 snapshots against the WI-R3F-9 baseline.
3. **Verifiers** re-run all flows using the strict protocol (Section 3 checklist). Expect new FAILs to surface — the strict protocol exists precisely because the previous pass was not thorough.
4. **Implementer** batch-fixes all new FAILs in a follow-up WI.
5. **Verifiers** re-run the affected flows only. Repeat until all flows are PASS or CANT-VERIFY-accepted.
6. Only then does `feat/r3f-migration → main` PR open.

---

## 5. CI Integration

- `pnpm test:unit` runs all Section 1 property tests and Section 2 snapshot tests.
- CI fails on any regression test failure or snapshot mismatch.
- PRs into `feat/r3f-migration` or `main` cannot merge with a red CI run.
- Bundle size check (added in WI-R3F-6) remains: `dist/webview.js` must not exceed baseline + 200 KB gzipped.

---

## Appendix: Why These Tests Didn't Exist Before

The original WI-R3F-3 acceptance criteria said "component test asserts THREE primitive structure synchronously" but left the list of properties to cover implicit. "The component test passes" and "every exposed property reaches the THREE object" are not the same thing — `useResource` can return a loaded texture but nothing in the component wires it to `material.map`. The Section 1 inventory makes the gap explicit and testable.
