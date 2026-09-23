/**
 * The material processor. The path is a `.tres` that is a material, or a
 * **Sub-resource path** into a `.tres` that carries one (a mesh's surface
 * materials). `shouldProcess` sees the owning file either way.
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
import { releaseBoundTexture } from '../materials/standardmaterial3d/textureBinding';

/**
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
 * `Material.dispose()` does not dispose its maps, and the per-material clones
 * among them have no other owner, so each would leak its GPU upload. Only clones
 * are freed: the shared source belongs to the loader's cache.
 */
function disposeMaterialAndOwnedTextures(material: THREE.Material): void {
  // A borrowed procedural texture (a `GradientTexture2D` the `.tres` declares) may
  // be lent elsewhere, so its pin is released, not the texture: eviction reclaims
  // it after the last borrower, and never while this material samples it.
  releaseProceduralTextures(material);
  // Walk the material's own values rather than a hand-listed set of slot names:
  // three assigns every map in its constructor, so this cannot go stale the day
  // a new one is wired, and the ownership tag is the real discriminator anyway.
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) releaseBoundTexture(value);
  }
  material.dispose();
}
