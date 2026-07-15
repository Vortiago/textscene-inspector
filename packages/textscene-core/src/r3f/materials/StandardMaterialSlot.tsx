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
    `${aoMap ? 'o' : '-'}`;

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
  return (
    <meshStandardMaterial
      key={slotKey}
      attach={attach}
      color={scalars.color}
      vertexColors={scalars.useVertexColors}
      metalness={scalars.metalness}
      roughness={scalars.roughness}
      transparent={scalars.transparent}
      opacity={scalars.opacity}
      alphaTest={scalars.alphaTest}
      depthWrite={scalars.depthWrite}
      blending={scalars.blending}
      side={effectiveSide}
      shadowSide={shadowSide ?? null}
      map={albedoMap ?? null}
      normalMap={normalMap ?? null}
      normalScale={normalScale}
      roughnessMap={roughnessMap ?? null}
      metalnessMap={metalnessMap ?? null}
      emissiveMap={emissiveMap ?? null}
      aoMap={aoMap ?? null}
      emissive={scalars.emissive}
      emissiveIntensity={scalars.emissiveIntensity}
    />
  );
}
