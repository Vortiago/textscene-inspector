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

/**
 * Godot's default 3D material — what a mesh with no material actually gets.
 *
 * It is NOT a `StandardMaterial3D` with default properties. Every backend
 * binds a hardcoded shader instead
 * (`scene_shader_forward_clustered.cpp`, and identically in the Mobile and
 * Compatibility renderers):
 *
 *     void vertex()   { ROUGHNESS = 0.8; }
 *     void fragment() { ALBEDO = vec3(0.6); ROUGHNESS = 0.8; METALLIC = 0.2; }
 *
 * so an unmaterialed mesh is a mid-grey, slightly metallic, mostly-rough
 * surface — not the white matte a default-constructed StandardMaterial3D
 * would give. Reading it as white made every such mesh reflect roughly 1/0.6
 * too much ambient, which is what blew out the ground plane in
 * `unit-preview-lighting` against Godot's own render of it.
 *
 * `ALBEDO` is a shader constant, so 0.6 is LINEAR. It has to be built with an
 * explicit colour space — three decodes a plain hex literal as sRGB, which
 * would land at 0.318 linear instead.
 */
const DEFAULT_MATERIAL_ALBEDO = new THREE.Color().setRGB(
  0.6,
  0.6,
  0.6,
  THREE.LinearSRGBColorSpace
);
const DEFAULT_MATERIAL_ROUGHNESS = 0.8;
const DEFAULT_MATERIAL_METALLIC = 0.2;

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
    return (
      <meshStandardMaterial
        attach={attach}
        color={DEFAULT_MATERIAL_ALBEDO}
        metalness={DEFAULT_MATERIAL_METALLIC}
        roughness={DEFAULT_MATERIAL_ROUGHNESS}
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
  // upgrade to <meshPhysicalMaterial> when a physical-only feature is active
  // (see needsPhysicalMaterial for the authoritative set), keeping the common
  // path on the lighter standard material so existing behaviour — and the
  // material type the component tests assert on — is unchanged.
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
