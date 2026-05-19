/**
 * Factory for creating material processors.
 * Uses createResourceProcessor with material-specific processing logic.
 */

import * as THREE from 'three';
import type { FileEventBus } from '../FileEventBus';
import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import { createMaterialFromContent, isMaterialPath, type TextureLoaderFn } from '../processing/materialProcessing';

/**
 * Create a material processor that handles loading and caching materials.
 * @param loadTexture - Function to load textures by ID (for materials with texture references)
 */
export function createMaterialProcessor(
  fileEventBus: FileEventBus | undefined,
  eventBus: ResourceEventBus,
  loadTexture?: TextureLoaderFn
): ResourceProcessor<THREE.Material> {
  return createResourceProcessor({
    fileEventBus,
    eventBus,
    resourceType: 'material',
    shouldProcess: (path, data) => isMaterialPath(path) && typeof data === 'string',
    process: async (_path, data) => {
      return createMaterialFromContent(data as string, loadTexture);
    },
    dispose: (material) => material.dispose(),
  });
}
