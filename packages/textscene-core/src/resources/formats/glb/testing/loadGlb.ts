/**
 * One instanced triangle GLB served by a one-file provider, and a load of it through a
 * `ResourceLoader`, for tests that check which glTF extension rules a loader applies.
 */
import * as THREE from 'three';
import type { ResourceLoader } from '../../../ResourceLoader';
import type { ResourceProvider } from '../../../ResourceProvider';
import { triangleGlb } from './triangleGlb';

const INSTANCED_GLB_PATH = 'res://props/crowd.glb';

export function instancedGlbProvider(): ResourceProvider {
  const asset = triangleGlb({ instanced: true });
  return { loadResource: async (path: string) => (path === INSTANCED_GLB_PATH ? asset : null) };
}

/** The GLB `instancedGlbProvider` serves, as `loader` builds it. */
export function loadInstancedGlb(loader: ResourceLoader): Promise<THREE.Object3D> {
  const loaded = loader.eventBus.once<THREE.Object3D>('glb', 'loaded', INSTANCED_GLB_PATH, 5000);
  loader.glbMeshes.request(INSTANCED_GLB_PATH);
  return loaded;
}

export function containsInstancedMesh(root: THREE.Object3D): boolean {
  let found = false;
  root.traverse((node) => {
    if ((node as THREE.InstancedMesh).isInstancedMesh) found = true;
  });
  return found;
}
