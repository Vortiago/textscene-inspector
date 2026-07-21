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
import type { StandardMaterial3DScalars } from './standardMaterialScalars';

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
    // No material → Godot's default StandardMaterial3D: white, non-metallic,
    // fully-rough matte, BACK culling (= three.js FrontSide).
    return (
      <meshStandardMaterial
        attach={attach}
        color={0xffffff}
        metalness={0}
        roughness={1}
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
        blending={scalars.blending}
        side={effectiveSide}
      />
    );
  }
  // Shared PBR props for the shaded path. MeshPhysicalMaterial is a strict
  // superset of MeshStandardMaterial, so the same props drive either; we only
  // upgrade to <meshPhysicalMaterial> when Godot's clearcoat feature is active,
  // keeping the common (no-clearcoat) path on the lighter standard material so
  // existing behaviour — and the material type the component tests assert on —
  // is unchanged.
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
    blending: scalars.blending,
    side: effectiveSide,
    shadowSide: shadowSide ?? null,
    map: albedoMap ?? null,
    normalMap: normalMap ?? null,
    normalScale,
    roughnessMap: roughnessMap ?? null,
    metalnessMap: metalnessMap ?? null,
    emissiveMap: emissiveMap ?? null,
    aoMap: aoMap ?? null,
    emissive: scalars.emissive,
    emissiveIntensity: scalars.emissiveIntensity,
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
  // Godot clearcoat (FEATURE_CLEARCOAT, a glossy coat) and rim (FEATURE_RIM, a
  // Fresnel edge highlight) both live natively on MeshPhysicalMaterial only —
  // clearcoat as `clearcoat`, rim mapped to `sheen` (three.js's Fresnel edge
  // term, the closest native analog). A material carrying either renders as
  // <meshPhysicalMaterial>; rim_tint blends the highlight from the light colour
  // (0) toward the albedo (1) via sheenColor.
  if (scalars.clearcoat > 0 || scalars.rim > 0 || scalars.anisotropy > 0) {
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
        anisotropy={scalars.anisotropy}
        anisotropyRotation={scalars.anisotropyRotation}
        anisotropyMap={anisotropyMap ?? null}
      />
    );
  }
  return <meshStandardMaterial key={slotKey} {...pbrProps} />;
}
