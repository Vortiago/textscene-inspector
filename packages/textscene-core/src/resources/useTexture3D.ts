/**
 * The one resolver for a Texture3D slot: a `NoiseTexture3D` or `ImageTexture3D`, inline or saved as
 * its own `.tres`, or an image its **Import sidecar** imports as a 3D texture. The `TEXTURE_3D`
 * kind reads the resource, and this builds the GPU texture from the decoded value. Null while
 * loading, for none, and for a form the previewer cannot build. The read reports a missing image
 * or `.tres` itself.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useReferencedResource, type ScopedReference } from './reading';
import { proceduralTexture3D } from './textures/resolveProceduralTexture.js';
import { TEXTURE_3D } from './textures/texture3d/kind.js';
import { useProceduralTexture } from './useProceduralTexture.js';
import { useResource } from './useResource.js';

export function useTexture3D(reference: ScopedReference | null): THREE.Data3DTexture | null {
  const decoded = useReferencedResource(reference, TEXTURE_3D).value;
  const lookup = useMemo(() => proceduralTexture3D(decoded), [decoded]);
  const procedural = useProceduralTexture(lookup);
  const imagePath = decoded?.form === 'file' ? decoded.path : null;
  const loaded = useResource<THREE.Data3DTexture>(imagePath ?? '', 'texture3d');
  const texture = procedural.claimed ? procedural.texture : loaded.value;
  return texture instanceof THREE.Data3DTexture ? texture : null;
}
