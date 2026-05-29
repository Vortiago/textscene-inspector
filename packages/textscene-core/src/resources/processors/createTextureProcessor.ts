/**
 * Factory for creating texture processors.
 * Uses createResourceProcessor with texture-specific processing logic.
 */

import * as THREE from 'three';
import type { FileEventBus } from '../FileEventBus';
import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import { createTextureFromBuffer, getMimeType, isTexturePath } from '../processing/textureProcessing';

/**
 * Create a texture processor that handles loading and caching textures.
 */
export function createTextureProcessor(
  fileEventBus: FileEventBus | undefined,
  eventBus: ResourceEventBus
): ResourceProcessor<THREE.Texture> {
  return createResourceProcessor({
    fileEventBus,
    eventBus,
    resourceType: 'texture',
    shouldProcess: (path, data) => isTexturePath(path) && data instanceof ArrayBuffer,
    process: async (path, data) => {
      const mimeType = getMimeType(path);
      return createTextureFromBuffer(data as ArrayBuffer, mimeType, eventBus.getThreeManager());
    },
    dispose: (texture) => texture.dispose(),
  });
}
