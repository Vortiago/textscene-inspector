import { useMemo } from 'react';
import * as THREE from 'three';
import { useReferencedResource, type ScopedReference } from './reading';
import { proceduralCubemap } from './textures/resolveProceduralTexture.js';
import { CUBEMAP } from './textures/cubemap/kind.js';
import { useProceduralTexture } from './useProceduralTexture.js';
import { useResource } from './useResource.js';

/** The cube a Cubemap slot reads. Null while it loads, for none, and for a form it cannot build. */
export function useCubemap(reference: ScopedReference | null): THREE.CubeTexture | null {
  const decoded = useReferencedResource(reference, CUBEMAP).value;
  const lookup = useMemo(() => proceduralCubemap(decoded), [decoded]);
  const procedural = useProceduralTexture(lookup);
  const imagePath = decoded?.form === 'file' ? decoded.path : null;
  const loaded = useResource<THREE.CubeTexture>(imagePath ?? '', 'cubemap');
  const texture = procedural.claimed ? procedural.texture : loaded.value;
  return texture instanceof THREE.CubeTexture ? texture : null;
}
