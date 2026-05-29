/**
 * Factory for creating GLB mesh processors.
 * Uses createResourceProcessor with GLB-specific processing logic.
 */

import * as THREE from 'three';
import type { FileEventBus } from '../FileEventBus';
import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import { createGLBMesh, isGLBPath } from '../processing/glbProcessing';

/**
 * Dispose of a GLB mesh and all its resources.
 */
function disposeGLBMesh(mesh: THREE.Object3D): void {
  mesh.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.geometry?.dispose();
      if (Array.isArray(node.material)) {
        node.material.forEach((mat) => mat.dispose());
      } else {
        node.material?.dispose();
      }
    }
  });
}

/**
 * Create a GLB mesh processor that handles loading and caching GLB/GLTF meshes.
 */
export function createGLBProcessor(
  fileEventBus: FileEventBus | undefined,
  eventBus: ResourceEventBus
): ResourceProcessor<THREE.Object3D> {
  return createResourceProcessor({
    fileEventBus,
    eventBus,
    resourceType: 'glb',
    shouldProcess: (path, data) => isGLBPath(path) && data instanceof ArrayBuffer,
    process: async (_path, data) => {
      return createGLBMesh(data as ArrayBuffer);
    },
    dispose: disposeGLBMesh,
  });
}
