/**
 * The one resolver for a Texture3D slot: an inline `NoiseTexture3D`, or an image its **Import
 * sidecar** imports as a 3D texture, named by an `ExtResource`. Null while loading, for none, and
 * for a form the previewer cannot build. The load reports a missing image itself.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { SceneResources } from '../r3f/SceneResourcesContext.js';
import { isTexturePath } from './formats/image/textureProcessing.js';
import { resolveExtResourcePath } from './SubResourceResolver.js';
import { useProceduralTexture3D } from './useProceduralTexture.js';
import { useResource } from './useResource.js';

export function useTexture3D(ref: string | undefined, pools: SceneResources): THREE.Data3DTexture | null {
  const procedural = useProceduralTexture3D(ref, pools.internalResources);
  // Only an image loads: a `.tres` would wait forever on a bus that decodes no text.
  const path = useMemo(() => {
    if (procedural.claimed) return null;
    const extPath = resolveExtResourcePath(ref, pools.externalResources);
    return extPath && isTexturePath(extPath) ? extPath : null;
  }, [procedural.claimed, ref, pools.externalResources]);
  const loaded = useResource<THREE.Data3DTexture>(path ?? '', 'texture3d');
  const texture = procedural.claimed ? procedural.texture : loaded.value;
  return texture instanceof THREE.Data3DTexture ? texture : null;
}
