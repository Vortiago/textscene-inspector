/**
 * The attribute shell every MeshInstance3D render branch draws inside, and the
 * placeholder the unresolved branches fill it with.
 */

import type * as THREE from 'three';
import type { ReactNode, RefObject } from 'react';
import { visualLayersUserData } from '../../../r3f/visualLayers';

export interface MeshShellProps {
  name: string;
  /** Ref to the underlying THREE.Mesh, so `useBillboard` can turn it per frame. */
  meshRef: RefObject<THREE.Mesh | null>;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  visible: boolean;
  castShadow: boolean;
  /** `cast_shadow = SHADOWS_ONLY` (3): cast, but draw nothing. */
  shadowsOnly: boolean;
  /** `layers` — the VisualInstance3D render mask a Decal's `cull_mask` filters on. */
  godotLayers: number | undefined;
  /** The dispatched scene-tree subtree parented under this MeshInstance3D. */
  subtree: ReactNode;
  children: ReactNode;
}

/**
 * Shared attribute shell for every `<mesh>` branch in MeshInstance3D.
 * All five branches (placeholder, unavailable ArrayMesh, loading ArrayMesh,
 * missing-texture and fully-resolved) set the same props; this helper keeps
 * them in one place so a future prop rename or addition only changes one
 * definition.
 *
 * `children` is the geometry/material slot each branch fills; `subtree` is the
 * node's own scene-tree descendants, which render inside the mesh so they
 * inherit its transform (Godot draws children after, and relative to, the
 * node). Every branch — including the ones that draw a placeholder — must pass
 * it, or the descendants vanish with the mesh.
 */
export function MeshShell({
  name,
  meshRef,
  position,
  rotation,
  scale,
  visible,
  castShadow,
  shadowsOnly,
  godotLayers,
  subtree,
  children,
}: MeshShellProps) {
  return (
    <mesh
      ref={meshRef}
      name={name}
      position={position}
      rotation={rotation}
      scale={scale}
      visible={visible}
      castShadow={castShadow}
      receiveShadow
      // Godot's `layers`, carried for the consumers that filter on it — today
      // `Decal.cull_mask`. Set on every branch's mesh, including the placeholder
      // ones, so a decal's receiver test never depends on load order.
      userData={visualLayersUserData(godotLayers)}
    >
      {children}
      {/* SHADOWS_ONLY draws nothing but must still CAST, and its descendants
          must still render. `visible = false` gives neither: three's
          `WebGLShadowMap.renderObject` opens with
          `if (object.visible === false) return;`, which skips the shadow pass
          AND stops walking the subtree. Setting `material.visible = false` is
          no better — the same function gates the depth material on it. A
          material that writes neither colour nor depth is what separates the
          two passes: `getDepthMaterial` copies alphaMap/alphaTest/map and never
          `colorWrite`, so the shadow comes through untouched. Mounting after
          `children` makes this the material R3F attaches last. */}
      {shadowsOnly && (
        <meshBasicMaterial attach="material" colorWrite={false} depthWrite={false} />
      )}
      {subtree}
    </mesh>
  );
}

/**
 * What a mesh reference that resolves to nothing renders as. One value, because
 * three branches reach it: no mesh at all, an external `.tres` that failed, and a
 * scene sub-resource whose surfaces could not be read.
 */
export const UNRESOLVED_MESH = (
  <>
    <boxGeometry args={[1, 1, 1]} />
    <meshBasicMaterial color={0xff00ff} wireframe />
  </>
);
