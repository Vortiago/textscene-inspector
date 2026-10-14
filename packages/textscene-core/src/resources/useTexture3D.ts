/**
 * The one resolver for a Texture3D slot: a `NoiseTexture3D`, inline or saved as its own `.tres`, or
 * an image its **Import sidecar** imports as a 3D texture, named by an `ExtResource`. Null while
 * loading, for none, and for a form the previewer cannot build. The load reports a missing image
 * itself.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { ParsedResource } from '../parser/parsedResource.js';
import type { SceneResources } from '../r3f/SceneResourcesContext.js';
import { isTexturePath } from './formats/image/textureProcessing.js';
import { resolveExtResourcePath, resolveExtTextResourcePath } from './SubResourceResolver.js';
import { textResourceTexture } from './textures/textResourceTexture.js';
import { useProceduralTexture3D } from './useProceduralTexture.js';
import { useResource } from './useResource.js';

export function useTexture3D(ref: string | undefined, pools: SceneResources): THREE.Data3DTexture | null {
  // A `.tres` loads on the `resource` bus, since the texture3d bus decodes no text.
  const textResourcePath = useMemo(
    () => resolveExtTextResourcePath(ref, pools.externalResources),
    [ref, pools.externalResources]
  );
  const textResourceFile = useResource<ParsedResource>(textResourcePath ?? '', 'resource');
  const saved =
    textResourcePath && textResourceFile.value ? textResourceTexture(textResourceFile.value) : null;
  const procedural = useProceduralTexture3D(
    saved?.ref ?? ref,
    saved?.internalResources ?? pools.internalResources
  );

  const imagePath = useMemo(() => {
    const extPath = resolveExtResourcePath(ref, pools.externalResources);
    return extPath && isTexturePath(extPath) ? extPath : null;
  }, [ref, pools.externalResources]);
  const loaded = useResource<THREE.Data3DTexture>(imagePath ?? '', 'texture3d');
  const texture = procedural.claimed ? procedural.texture : loaded.value;
  return texture instanceof THREE.Data3DTexture ? texture : null;
}
