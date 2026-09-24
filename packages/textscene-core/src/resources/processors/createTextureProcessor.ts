/**
 * Factory for creating texture processors, the image slice's loader-facing
 * adapter (`resources/formats/image/`, ADR-0031). Stays here because the
 * `ResourceLoader` constructs it alongside its peer factories.
 */

import * as THREE from 'three';
import type { FileEventBus } from '../FileEventBus';
import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import {
  createTextureFromBuffer,
  getMimeType,
  isTexturePath,
} from '../formats/image/textureProcessing';

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
