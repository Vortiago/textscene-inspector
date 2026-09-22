/**
 * `@react-three/test-renderer` types every `ReactThreeTestInstance.instance` as
 * the bare `THREE.Object3D` — the class is generic
 * (`ReactThreeTestInstance<TObject extends THREE.Object3D = THREE.Object3D>`)
 * but `findByType`/`findAllByType`/`find` all return the default parameter, so
 * the concrete Three.js subclass a test found by name (`'Mesh'`, the canvas
 * root `Scene`) is lost. Every call site here already knows that subclass from
 * how it found the node — this narrows it once instead of re-asserting the
 * same cast at every `.instance.geometry` / `.instance.material` / `.instance.fog`.
 *
 * Build-excluded via the `src/**\/testing/**` tsconfig rule (test-only).
 */

import type * as THREE from 'three';
import type { ReactThreeTest } from '@react-three/test-renderer';

/** The library exports this only via its `ReactThreeTest` namespace, not at the top level. */
type ReactThreeTestInstance = ReactThreeTest.ReactThreeTestInstance;

/**
 * Narrow a test-renderer node's `.instance` to a concrete `THREE.Object3D`
 * subclass — `instanceAs<THREE.Mesh>(scene.findByType('Mesh'))`.
 */
export function instanceAs<T extends THREE.Object3D>(node: ReactThreeTestInstance): T {
  return node.instance as unknown as T;
}

/** Find the first node of `type` (default `'Mesh'`) and return it as `THREE.Mesh`. */
export function findMesh(scene: ReactThreeTestInstance, type = 'Mesh'): THREE.Mesh {
  return instanceAs<THREE.Mesh>(scene.findByType(type));
}

/**
 * Narrow a test-renderer node's `.instance` to a non-`Object3D` Three.js class —
 * `findAllByType('MeshBasicMaterial')` walks the fiber tree by JSX element name,
 * so it legitimately finds `THREE.Material` instances too, but
 * `ReactThreeTestInstance`'s type parameter is bounded to `THREE.Object3D` and
 * can't express that. Unlike `instanceAs`, this can't lean on Object3D-subtype
 * assignability, so it goes through `unknown` like the rest of this file's
 * mock-narrowing casts.
 */
export function materialInstanceAs<T extends THREE.Material>(node: ReactThreeTestInstance): T {
  return node.instance as unknown as T;
}
