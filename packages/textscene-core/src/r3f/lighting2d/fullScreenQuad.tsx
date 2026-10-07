/**
 * The full-screen quad of the light pass: a unit plane the vertex shader stretches over the whole
 * target, so it covers the accumulator wherever the canvas camera is panned.
 */

import { useCallback } from 'react';
import type * as THREE from 'three';

/** Maps the unit plane onto NDC. A shader that needs the NDC position repeats `position.xy * 2.0`. */
export const FULL_SCREEN_VERTEX = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
}
`;

export function FullScreenQuad({
  layer,
  material,
  renderOrder,
  onMesh,
}: {
  /** The one camera layer the quad draws on. */
  layer: number;
  material: THREE.Material;
  renderOrder: number;
  /** Receives the mounted mesh, and null on unmount. */
  onMesh?: (mesh: THREE.Mesh | null) => void;
}) {
  const toLayer = useCallback(
    (mesh: THREE.Mesh | null) => {
      mesh?.layers.set(layer);
      onMesh?.(mesh);
    },
    [layer, onMesh]
  );

  return (
    <mesh
      ref={toLayer}
      material={material}
      renderOrder={renderOrder}
      // The quad ignores every matrix, so its bounds say nothing about where it lands, and culling
      // it against the panned camera would drop it.
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
