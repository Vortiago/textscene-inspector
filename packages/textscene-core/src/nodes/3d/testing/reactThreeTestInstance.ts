/**
 * `@react-three/test-renderer` types every `ReactThreeTestInstance.instance` as the bare
 * `THREE.Object3D`, since `findByType`/`findAllByType`/`find` return the default type parameter. A
 * call site knows the subclass from how it found the node, so these helpers narrow it once.
 * Build-excluded through the `src/**\/testing/**` tsconfig rule (test-only).
 */

import type * as THREE from 'three';
import type { ReactThreeTest } from '@react-three/test-renderer';

/** The library exports this only through its `ReactThreeTest` namespace, not at the top level. */
type ReactThreeTestInstance = ReactThreeTest.ReactThreeTestInstance;

/**
 * Narrow a test-renderer node's `.instance` to a concrete `THREE.Object3D`
 * subclass: `instanceAs<THREE.Mesh>(scene.findByType('Mesh'))`.
 */
export function instanceAs<T extends THREE.Object3D>(node: ReactThreeTestInstance): T {
  return node.instance as unknown as T;
}

/** Find the first node of `type` (default `'Mesh'`) and return it as `THREE.Mesh`. */
export function findMesh(scene: ReactThreeTestInstance, type = 'Mesh'): THREE.Mesh {
  return instanceAs<THREE.Mesh>(scene.findByType(type));
}

/**
 * Narrow a test-renderer node's `.instance` to a non-`Object3D` Three.js class. `findAllByType`
 * walks the fiber tree by JSX element name, so it finds `THREE.Material` instances too, which the
 * type parameter, bounded to `THREE.Object3D`, cannot express.
 */
export function materialInstanceAs<T extends THREE.Material>(node: ReactThreeTestInstance): T {
  return node.instance as unknown as T;
}

/**
 * The materials the scene's meshes draw, of three class `type` (`'MeshPhysicalMaterial'`). A
 * GeometryInstance3D surface mounts two materials and draws one, so a fiber search finds both.
 */
export function drawnMaterials<T extends THREE.Material>(scene: ReactThreeTestInstance, type: string): T[] {
  return scene
    .findAllByType('Mesh')
    .flatMap((node) => instanceAs<THREE.Mesh>(node).material)
    .filter((material): material is T => material.type === type);
}
