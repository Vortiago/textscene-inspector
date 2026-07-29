/**
 * Factory for creating material processors.
 * Uses createResourceProcessor with material-specific processing logic.
 *
 * The path may be a whole `.tres` that IS a material, or a **Sub-resource
 * path** into a `.tres` that merely carries one (a mesh's own surface
 * materials). `shouldProcess` is asked about the owning file either way, so the
 * extension check reads the same; only the body to build differs.
 */

import * as THREE from 'three';
import type { FileEventBus } from '../FileEventBus';
import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import { createMaterialFromContent, isMaterialPath, type TextureLoaderFn } from '../processing/materialProcessing';
import { parseSubResourcePath } from '../subResourcePath';

/**
 * Create a material processor that handles loading and caching materials.
 * @param loadTexture - Function to load textures by resolved res:// path (for materials with texture references)
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
    addressesSubResources: true,
    process: async (path, data) => {
      const { subResourceId } = parseSubResourcePath(path);
      return createMaterialFromContent(data as string, loadTexture, subResourceId);
    },
    dispose: (material) => material.dispose(),
  });
}
