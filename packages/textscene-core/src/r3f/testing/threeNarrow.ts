/**
 * Cross-realm THREE narrowing for r3f test suites.
 *
 * `@react-three/test-renderer` resolves its own `three` module copy, so
 * `instanceof THREE.*` is FALSE at runtime even for genuine three objects
 * (`instanceof THREE.Object3D` included) while compiling clean — a
 * tsc-green, suite-red trap. three's own `.isMesh`-style flags are the
 * library's cross-copy answer, so predicates over them are the only
 * narrowing that works across the renderer's realm.
 *
 * Test-only: the `testing/` directories under `src` are excluded from the
 * build, like `parser/testing` and `resources/testing`.
 */

import type * as THREE from 'three';

export function isMesh(o: THREE.Object3D): o is THREE.Mesh {
  return (o as Partial<THREE.Mesh>).isMesh === true;
}

export function isBasicMaterial(m: THREE.Material): m is THREE.MeshBasicMaterial {
  return (m as Partial<THREE.MeshBasicMaterial>).isMeshBasicMaterial === true;
}
