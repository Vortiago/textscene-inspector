/**
 * Factory for creating GLB mesh processors.
 * Uses createResourceProcessor with GLB-specific processing logic.
 */

import * as THREE from 'three';
import type { FileEventBus } from '../FileEventBus';
import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import {
  createGLBMesh,
  disposeMeshMaterials,
  gltfResourceDir,
  isGLBPath,
} from '../processing/glbProcessing';

/**
 * Dispose of a GLB mesh and all its resources. Unlike a per-consumer clone
 * (whose geometry is shared with this template — see
 * `disposeClonedMaterials`), the TEMPLATE owns its geometry too.
 */
function disposeGLBMesh(mesh: THREE.Object3D): void {
  mesh.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.geometry?.dispose();
      disposeMeshMaterials(node);
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
    process: async (path, data) => {
      // Text .gltf resolves external buffers/images against its own res://
      // directory through the bus's LoadingManager (host-mapped URLs).
      return createGLBMesh(data as ArrayBuffer, gltfResourceDir(path), eventBus.getThreeManager());
    },
    dispose: disposeGLBMesh,
  });
}
