/**
 * The full-screen quad of the light pass: a unit plane the vertex shader stretches over the whole
 * target, so it covers the accumulator wherever the canvas camera is panned.
 */

import type * as THREE from 'three';

export function FullScreenQuad({
  meshRef,
  material,
  renderOrder,
}: {
  /** Receives the mounted mesh, and null on unmount: the place to set its layer. */
  meshRef: (mesh: THREE.Mesh | null) => void;
  material: THREE.Material;
  renderOrder: number;
}) {
  return (
    <mesh
      ref={meshRef}
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
