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
import { useUndecodedTexture } from '../undecodedTexture';
import { resolveEmission } from '../../resources/materials/standardmaterial3d/emission';
import {
  GODOT_DEFAULT_ALBEDO,
  GODOT_DEFAULT_METALLIC,
  GODOT_DEFAULT_ROUGHNESS,
} from './godotDefaultMaterial';
import type { StandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/types';
import { materialBlendProps } from '../../resources/materials/standardmaterial3d/build';

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
  // Godot marks exactly three of BaseMaterial3D's samplers `source_color` —
  // `texture_albedo`, `texture_emission`, `texture_detail_albedo`
  // (`scene/resources/material.cpp:969,1066,1137`), which is what makes the
  // renderer bind their sRGB-typed GPU view and decode before every sample.
  // Every sampler below carries `hint_default_white` / `hint_roughness_*` /
  // `hint_normal` instead and is read RAW: a roughness value, a normal vector
  // and a height are data, not light.
  //
  // `textureProcessing.ts` tags every loaded texture `SRGBColorSpace`, so
  // without this each of these would be uploaded as `SRGB8_ALPHA8` and
  // hardware-decoded — a normal map whose vectors are bent toward the
  // surface, and roughness/metallic/AO/height read too dark. Hooks run
  // unconditionally, before the no-scalars early return below.
  const normalData = useUndecodedTexture(normalMap);
  const roughnessData = useUndecodedTexture(roughnessMap);
  const metalnessData = useUndecodedTexture(metalnessMap);
  const aoData = useUndecodedTexture(aoMap);
  const displacementData = useUndecodedTexture(displacementMap);
  // `anisotropyMap` is absent: `repackFlowmap.ts` builds it from decoded pixels
  // and already tags the result `NoColorSpace`.

  if (!scalars) {
    return (
      <meshStandardMaterial
        attach={attach}
        color={GODOT_DEFAULT_ALBEDO}
        metalness={GODOT_DEFAULT_METALLIC}
        roughness={GODOT_DEFAULT_ROUGHNESS}
        side={THREE.FrontSide}
        shadowSide={shadowSide ?? null}
      />
    );
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
  // The material's shader needs to be recompiled whenever the set of
  // active texture maps changes — three.js bakes `USE_MAP` / `USE_NORMALMAP`
  // / etc. into shader defines at first compile. Keying the material on which
  // slots are populated forces R3F to construct a fresh material when textures
  // arrive asynchronously via `useResource`, picking up the right defines.
  const slotKey =
    `${albedoMap ? 'a' : '-'}` +
    `${normalMap ? 'n' : '-'}` +
    `${roughnessMap ? 'r' : '-'}` +
    `${metalnessMap ? 'm' : '-'}` +
    `${emissiveMap ? 'e' : '-'}` +
    `${aoMap ? 'o' : '-'}` +
    // displacementMap MUST be keyed too: three.js bakes USE_DISPLACEMENTMAP at
    // compile time, so a coat/height texture arriving async needs a fresh
    // material or the vertices never move (the map is set but the shader ignores it).
    `${displacementMap ? 'd' : '-'}` +
    // 'f' for flowmap
    `${anisotropyMap ? 'f' : '-'}`;

  // Godot SHADING_MODE_UNSHADED (0): albedo is output directly, unaffected by
  // lights/shadows. three.js MeshBasicMaterial is the unlit equivalent — no PBR
  // slots (metalness/roughness/normal/emissive/ao) apply.
  //
  // Dropping EMISSION here is PARITY, not an omission: Godot's unshaded branch
  // writes `frag_color = vec4(albedo, alpha)` and never reads the emission term
  // its own fragment code computed, so an unshaded material with emission enabled
  // is unlit in Godot too however bright the colour.
  if (scalars.shadingMode === 'unshaded') {
    return (
      <meshBasicMaterial
        key={`basic-${albedoMap ? 'a' : '-'}`}
        attach={attach}
        color={scalars.color}
        vertexColors={scalars.useVertexColors}
        map={albedoMap ?? null}
        transparent={scalars.transparent}
        opacity={scalars.opacity}
        alphaTest={scalars.alphaTest}
        depthWrite={scalars.depthWrite}
        depthTest={scalars.depthTest}
        {...blendProps}
        side={effectiveSide}
      />
    );
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
    normalMap: normalData,
    normalScale,
    roughnessMap: roughnessData,
    metalnessMap: metalnessData,
    emissiveMap: emissiveMap ?? null,
    aoMap: aoData,
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
    displacementMap: displacementData,
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
    return (
      <meshPhysicalMaterial
        key={`physical-${slotKey}`}
        {...pbrProps}
        clearcoat={scalars.clearcoat}
        clearcoatRoughness={scalars.clearcoatRoughness}
        sheen={scalars.rim}
        sheenColor={sheenColor}
        // A low sheenRoughness concentrates the sheen toward grazing angles, so
        // the effect reads as an edge rim rather than a broad fabric glow that
        // would wash a dark-albedo sphere out to bright grey.
        sheenRoughness={0.1}
        anisotropy={scalars.anisotropy}
        anisotropyRotation={scalars.anisotropyRotation}
        anisotropyMap={anisotropyMap ?? null}
        transmission={scalars.transmission}
        thickness={scalars.refractionThickness}
      />
    );
  }
  return <meshStandardMaterial key={slotKey} {...pbrProps} />;
}
