/** A geometry built at its first use and kept until it is disposed, so a cache never hands out a disposed one. */

import type * as THREE from 'three';

/**
 * `build`'s geometry, built at the first call and handed out until it is disposed. The call after
 * that builds it again.
 */
export function geometryUntilDisposed(build: () => THREE.BufferGeometry): () => THREE.BufferGeometry {
  let built: THREE.BufferGeometry | undefined;
  return () => {
    if (built) return built;
    const geometry = build();
    geometry.addEventListener('dispose', () => {
      if (built === geometry) built = undefined;
    });
    return (built = geometry);
  };
}
