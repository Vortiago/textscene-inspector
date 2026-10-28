/**
 * The texture a slot names, held in an atlas for as long as the component that reads it shows it.
 * The decal atlas and the area light atlas each pass their own hold and release.
 */

import { useEffect } from 'react';
import type * as THREE from 'three';
import { useTexture2DRid } from '../../resources/useTexture2D';
import { useSceneResources } from '../SceneResourcesContext';

/**
 * The texture that `reference` names by RID, held through `hold` and let go through `release` when
 * it changes or the component unmounts. Null while it has not loaded, or when none is named.
 *
 * @canonical A texture a component holds in an atlas while it shows it
 */
export function useHeldTexture(
  reference: string | undefined,
  hold: (texture: THREE.Texture) => void,
  release: (texture: THREE.Texture) => void
): THREE.Texture | null {
  const { externalResources, internalResources } = useSceneResources();
  const texture = useTexture2DRid(reference, externalResources, internalResources).texture ?? null;
  useEffect(() => {
    if (!texture) return undefined;
    hold(texture);
    return () => release(texture);
  }, [texture, hold, release]);
  return texture;
}
