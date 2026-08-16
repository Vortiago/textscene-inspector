/**
 * `<StandardMaterialSlot>` — renders a three.js `<meshStandardMaterial>` from
 * parsed StandardMaterial3D scalars plus optional texture maps. Shared by every
 * StandardMaterial3D-bearing node type (MeshInstance3D, CSGBox3D, CSGCylinder3D).
 *
 * Scalar-only callers (e.g. CSG nodes whose materials carry no textures) pass
 * just `scalars`; the texture-map props stay undefined and the slot renders a
 * plain scalar material. The texture maps themselves are resolved by the caller
 * via `useResource` (the async path lives in the node component, not here).
 */

import * as THREE from 'three';
import { resolveEmission } from '../../resources/materials/standardmaterial3d/emission';
import {
  GODOT_DEFAULT_ALBEDO,
  GODOT_DEFAULT_METALLIC,
  GODOT_DEFAULT_ROUGHNESS,
} from './godotDefaultMaterial';
import type { StandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/types';
import { materialBlendProps } from '../../resources/materials/standardmaterial3d/build';
import { materialProgramInputs } from '../materialProgramInputs';

/**
 * Every texture prop below must arrive ALREADY BOUND — put through
 * `bindSlotTexture` for its Godot slot by whoever resolved it
 * (`resources/materials/standardmaterial3d/textureBinding.ts`). That is what
 * carries the material's UV transform, sampler filter, wrapping and colour
 * space. This component re-decides none of it: the imperative adapter
 * (`build.ts`) binds at the same seam, and a slot that corrected textures on
 * arrival would be a second copy of the rule for the two to drift apart on.
 */
export interface StandardMaterialSlotProps {
  scalars: StandardMaterial3DScalars | null;
  albedoMap?: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  metalnessMap?: THREE.Texture;
  emissiveMap?: THREE.Texture;
  aoMap?: THREE.Texture;
  /** Godot `heightmap_texture` → three.js displacementMap (height mapping). */
  displacementMap?: THREE.Texture;
  /** Godot `anisotropy_flowmap` → three.js anisotropyMap (flowmap). */
  anisotropyMap?: THREE.Texture;
  /** Override for shadow-pass side culling (Godot DOUBLE_SIDED cast_shadow). */
  shadowSide?: THREE.Side;
  /**
   * The underlying mesh type (PlaneMesh, BoxMesh, etc.). Reserved for
   * per-mesh-type culling defaults; currently unused (see git history for the
   * reverted PlaneMesh DoubleSide default).
   */
  meshType?: string;
  /** R3F attach key — `material-0` for multi-surface meshes. */
  attach?: string;
}

/**
 * A StandardMaterial3D upgrades from <meshStandardMaterial> to
 * <meshPhysicalMaterial> when any physical-only feature is active: clearcoat
 * (FEATURE_CLEARCOAT), rim → sheen (FEATURE_RIM), anisotropy
 * (FEATURE_ANISOTROPY), or refraction → transmission (FEATURE_REFRACTION).
 * Declared in one place so a new physical-only flag extends exactly this set
 * rather than an inline OR chain that a future addition could forget.
 */
function needsPhysicalMaterial(scalars: StandardMaterial3DScalars): boolean {
  return (
    scalars.clearcoat > 0 ||
    scalars.rim > 0 ||
    scalars.anisotropy > 0 ||
    scalars.transmission > 0
  );
}

export function StandardMaterialSlot({
  scalars,
  albedoMap,
  normalMap,
  roughnessMap,
  metalnessMap,
  emissiveMap,
  aoMap,
  displacementMap,
  anisotropyMap,
  shadowSide,
  meshType: _meshType,
  attach,
}: StandardMaterialSlotProps) {
  if (!scalars) {
    // Literal-only, so the key is constant and this fallback never remounts.
    const fallback = materialProgramInputs({
      props: {
        attach,
        color: GODOT_DEFAULT_ALBEDO,
        metalness: GODOT_DEFAULT_METALLIC,
        roughness: GODOT_DEFAULT_ROUGHNESS,
        side: THREE.FrontSide,
        shadowSide: shadowSide ?? null,
      },
    });
    return <meshStandardMaterial key={fallback.key} {...fallback.props} />;
  }
  // normalScale is a THREE.Vector2; we materialize one matching the
  // parsed scalar so the meshStandardMaterial slot picks it up on render.
  const normalScale = new THREE.Vector2(scalars.normalScale.x, scalars.normalScale.y);
  // Respect the source material's cull_mode verbatim. Godot's default
  // when cull_mode is unset is BACK culling → THREE.FrontSide.
  const effectiveSide = scalars.side;
  // Godot's SUB and PREMULT_ALPHA have no three preset, so they arrive as
  // CustomBlending plus six factor fields. Omitted (never `undefined`) for the
  // preset modes — see `materialBlendProps`. Passing only `blending` would leave
  // a CustomBlending material on three's default factors, which is a different
  // operation entirely.
  const blendProps = materialBlendProps(scalars);

  // Godot SHADING_MODE_UNSHADED (0): albedo is output directly, unaffected by
  // lights/shadows. three.js MeshBasicMaterial is the unlit equivalent — no PBR
  // slots (metalness/roughness/normal/emissive/ao) apply.
  //
  // Dropping EMISSION here is PARITY, not an omission: Godot's unshaded branch
  // writes `frag_color = vec4(albedo, alpha)` and never reads the emission term
  // its own fragment code computed, so an unshaded material with emission enabled
  // is unlit in Godot too however bright the colour.
  if (scalars.shadingMode === 'unshaded') {
    // Only albedo of the eight slots reaches a MeshBasicMaterial.
    const basic = materialProgramInputs({
      props: {
        attach,
        color: scalars.color,
        vertexColors: scalars.useVertexColors,
        map: albedoMap ?? null,
        transparent: scalars.transparent,
        opacity: scalars.opacity,
        alphaTest: scalars.alphaTest,
        depthWrite: scalars.depthWrite,
        depthTest: scalars.depthTest,
        ...blendProps,
        side: effectiveSide,
      },
    });
    return <meshBasicMaterial key={basic.key} {...basic.props} />;
  }
  // Shared PBR props for the shaded path. MeshPhysicalMaterial is a strict
  // superset of MeshStandardMaterial, so the same props drive either; we only
  // upgrade to <meshPhysicalMaterial> when a physical-only feature is active
  // (see needsPhysicalMaterial for the authoritative set), keeping the common
  // path on the lighter standard material so existing behaviour — and the
  // material type the component tests assert on — is unchanged.
  const emission = resolveEmission(scalars, scalars.emissionOperator, !!emissiveMap);
  const pbrProps = {
    attach,
    color: scalars.color,
    vertexColors: scalars.useVertexColors,
    metalness: scalars.metalness,
    roughness: scalars.roughness,
    transparent: scalars.transparent,
    opacity: scalars.opacity,
    alphaTest: scalars.alphaTest,
    depthWrite: scalars.depthWrite,
    depthTest: scalars.depthTest,
    ...blendProps,
    side: effectiveSide,
    shadowSide: shadowSide ?? null,
    map: albedoMap ?? null,
    normalMap: normalMap ?? null,
    normalScale,
    roughnessMap: roughnessMap ?? null,
    metalnessMap: metalnessMap ?? null,
    emissiveMap: emissiveMap ?? null,
    aoMap: aoMap ?? null,
    // Godot's `emission_operator` only becomes observable once a texture is in
    // play, and whether one resolved is knowable here and not at parse time.
    // Read field-by-field rather than spread: `scalars` is far wider than
    // `EmissionScalars`, so a future pass-through inside `resolveEmission` would
    // otherwise splat every material scalar into the material props.
    emissive: emission.emissive,
    emissiveIntensity: emission.emissiveIntensity,
    // Godot heightmap (FEATURE_HEIGHT_MAPPING) → three.js vertex displacement.
    // PARITY LIMITATION: Godot uses texture-space parallax; three.js
    // displacement moves real vertices, so it needs a subdivided mesh and its
    // depth is in world units (a different space than Godot's heightmap_scale).
    // Faithful in kind (a height texture raises the surface), approximate in
    // exact depth. Both are inert for a non-heightmap material: heightmapScale
    // is 0 and there is no displacementMap, so no vertices move.
    displacementMap: displacementMap ?? null,
    displacementScale: scalars.heightmapScale,
  };
  // clearcoat (FEATURE_CLEARCOAT, a glossy coat), rim (FEATURE_RIM, a Fresnel
  // edge highlight), anisotropy (FEATURE_ANISOTROPY, a directional specular
  // stretch), and refraction (FEATURE_REFRACTION) live natively on
  // MeshPhysicalMaterial only — clearcoat as `clearcoat`, rim mapped to `sheen`
  // (three.js's Fresnel edge term, the closest native analog), anisotropy as
  // `anisotropy` / `anisotropyRotation` / `anisotropyMap`, and refraction as
  // `transmission` + `thickness`. `needsPhysicalMaterial` gates the upgrade;
  // rim_tint blends the highlight from the light colour (0) toward the albedo
  // (1) via sheenColor.
  if (needsPhysicalMaterial(scalars)) {
    const rimTint = scalars.rimTint;
    const sheenColor = new THREE.Color(
      1 + rimTint * (scalars.color[0] - 1),
      1 + rimTint * (scalars.color[1] - 1),
      1 + rimTint * (scalars.color[2] - 1)
    );
    const physical = materialProgramInputs({
      props: {
        ...pbrProps,
        clearcoat: scalars.clearcoat,
        clearcoatRoughness: scalars.clearcoatRoughness,
        sheen: scalars.rim,
        sheenColor,
        // A low sheenRoughness concentrates the sheen toward grazing angles, so
        // the effect reads as an edge rim rather than a broad fabric glow that
        // would wash a dark-albedo sphere out to bright grey.
        sheenRoughness: 0.1,
        anisotropy: scalars.anisotropy,
        anisotropyRotation: scalars.anisotropyRotation,
        anisotropyMap: anisotropyMap ?? null,
        transmission: scalars.transmission,
        thickness: scalars.refractionThickness,
      },
    });
    return <meshPhysicalMaterial key={physical.key} {...physical.props} />;
  }
  const standard = materialProgramInputs({ props: pbrProps });
  return <meshStandardMaterial key={standard.key} {...standard.props} />;
}
