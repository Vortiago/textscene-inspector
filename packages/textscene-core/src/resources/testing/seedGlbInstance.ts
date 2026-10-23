/**
 * Test-only fixture: a `.glb` a scene can instance, seeded the way the loader holds one: the
 * synthesised scene whose only root is a `GLBSceneRoot`, and the loaded GLB object it names.
 */

import type * as THREE from 'three';
import { synthesiseGLBScene } from '../processors/createSceneProcessor';
import type { FakeResourceLoader } from './createFakeResourceLoader';

export function seedGlbInstance(fake: FakeResourceLoader, path: string, glb: THREE.Object3D): void {
  fake.scenes.seed(path, synthesiseGLBScene(path));
  fake.glbMeshes.seed(path, glb);
}
