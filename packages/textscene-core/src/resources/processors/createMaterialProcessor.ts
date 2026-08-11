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
import {
  createMaterialFromContent,
  isMaterialPath,
  releaseProceduralTextures,
  type TextureLoaderFn,
} from '../materials/standardmaterial3d/loadMaterial';
import { parseSubResourcePath } from '../subResourcePath';
import { isMaterialOwnedTexture } from '../textures/applyTextureState';

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
    dispose: disposeMaterialAndOwnedTextures,
  });
}

/**
 * `Material.dispose()` does NOT dispose its maps, and this material's maps may
 * include per-material clones that nothing else owns — so without this every
 * clone leaks its GPU upload for the life of the session. Only clones are
 * freed: the shared source belongs to the loader's cache and may still be in
 * use by other materials.
 *
 * Its BORROWED textures are handed back rather than freed. A procedural texture
 * (a `GradientTexture2D` the material's own `.tres` declares) belongs to the
 * procedural cache and may still be lent to another material or a mounted
 * component; releasing the pin is what lets capacity eviction reclaim it once
 * the last borrower is gone, and holding the pin until here is what stops an
 * eviction from disposing a texture this material is still sampling.
 */
function disposeMaterialAndOwnedTextures(material: THREE.Material): void {
  releaseProceduralTextures(material);
  // Walk the material's own values rather than a hand-listed set of slot names:
  // three assigns every map in its constructor, so this cannot go stale the day
  // a new one is wired, and the ownership tag is the real discriminator anyway.
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture && isMaterialOwnedTexture(value)) value.dispose();
  }
  material.dispose();
}
