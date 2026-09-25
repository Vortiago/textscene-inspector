/**
 * Cross-realm THREE narrowing for r3f tests. `@react-three/test-renderer` resolves its
 * own `three` copy, so `instanceof THREE.*` is false at runtime though it compiles:
 * three's `.isMesh`-style flags are the narrowing that works. Test-only: `testing/`
 * directories are excluded from the build.
 */

import type * as THREE from 'three';

export function isMesh(o: THREE.Object3D): o is THREE.Mesh {
  return (o as Partial<THREE.Mesh>).isMesh === true;
}

export function isBasicMaterial(m: THREE.Material): m is THREE.MeshBasicMaterial {
  return (m as Partial<THREE.MeshBasicMaterial>).isMeshBasicMaterial === true;
}
