/**
 * The one resolver for a Texture3D slot: a `NoiseTexture3D` or `ImageTexture3D`, inline or saved as
 * its own `.tres`, or an image its **Import sidecar** imports as a 3D texture, named by an
 * `ExtResource`. Null while loading, for none, and for a form the previewer cannot build. The load
 * reports a missing image or `.tres` itself.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { SceneResources } from '../r3f/SceneResourcesContext.js';
import { isTexturePath } from './formats/image/textureProcessing.js';
import { resolveExtResourcePath } from './SubResourceResolver.js';
import { useProceduralTexture3D } from './useProceduralTexture.js';
import { useResource } from './useResource.js';
import { useParsedResourceSlot } from './useParsedResourceSlot.js';

export function useTexture3D(ref: string | undefined, pools: SceneResources): THREE.Data3DTexture | null {
  const slot = useParsedResourceSlot(ref, pools.externalResources, pools.internalResources);
  const procedural = useProceduralTexture3D(slot.ref, slot.internalResources);

  const imagePath = useMemo(() => {
    const extPath = resolveExtResourcePath(slot.ref, slot.externalResources);
    return extPath && isTexturePath(extPath) ? extPath : null;
  }, [slot.ref, slot.externalResources]);
  const loaded = useResource<THREE.Data3DTexture>(imagePath ?? '', 'texture3d');
  const texture = procedural.claimed ? procedural.texture : loaded.value;
  return texture instanceof THREE.Data3DTexture ? texture : null;
}
