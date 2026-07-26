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
import { applyRootScale } from '../processing/rootScale';
import { importRootScale, parseImportFile } from '../../parser/importParser';
import * as logger from '../../logger';

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
 * Correct a freshly loaded asset by its **Import sidecar**'s root scale (ADR-0027).
 *
 * Done HERE, once per path, rather than in a consumer: the processor owns the cached
 * template, so every downstream reader — render, bounds, selection, the scene tree —
 * sees one already-correct object, and none of them can disagree about its size.
 *
 * A sidecar is found by convention (`scene.gltf` → `scene.gltf.import`), never declared
 * by a scene, so it is read with `tryLoad`: absent is the common case and means "Godot's
 * import defaults", not a **Missing resource**.
 */
async function applySidecarRootScale(
  object: THREE.Object3D,
  path: string,
  fileEventBus: FileEventBus | undefined
): Promise<void> {
  if (!fileEventBus) return;

  const raw = await fileEventBus.tryLoad(`${path}.import`);
  if (typeof raw !== 'string') return;

  const rootScale = importRootScale(parseImportFile(raw));
  if (!rootScale) return;

  logger.info(
    `[GLBProcessor] ${path}: import sidecar root_scale ${rootScale.scale} ` +
      `(${rootScale.bake ? 'baked into the asset' : 'on the root node'})`
  );
  applyRootScale(object, rootScale);
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
      const object = await createGLBMesh(
        data as ArrayBuffer,
        gltfResourceDir(path),
        eventBus.getThreeManager()
      );
      await applySidecarRootScale(object, path, fileEventBus);
      return object;
    },
    dispose: disposeGLBMesh,
  });
}
