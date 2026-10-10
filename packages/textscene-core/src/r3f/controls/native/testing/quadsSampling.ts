/** Finds the quads a painter drew that sample a given texture, for tests on a test-renderer scene. */
import type ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';

type TestScene = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>['scene'];

/** Every mesh whose material's `map` is `texture`, in scene order. */
export function quadsSampling(scene: TestScene, texture: THREE.Texture): THREE.Mesh[] {
  return scene
    .findAll(() => true)
    .map((n) => n.instance as THREE.Mesh)
    .filter((m) => (m.material as THREE.MeshBasicMaterial | undefined)?.map === texture);
}
