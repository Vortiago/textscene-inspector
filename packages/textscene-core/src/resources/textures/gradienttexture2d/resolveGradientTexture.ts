/**
 * Resolves a `GradientTexture2D` sub-resource to a rasterised `THREE.DataTexture`,
 * synchronously: the scene and the saved Gradient file describe it fully.
 * `resolveProceduralSubResource` owns the walk, the cache and the pin key. This owns the
 * rasterisation, once per scene and sub-resource. React consumers use `useProceduralTexture`.
 */

import type * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import type { SceneResources } from '../../../r3f/SceneResourcesContext';
import { identityKey } from '../../../utils/identityKey';
import { referencedFilePath, resolveReferencedResource } from '../../resolveReference';
import type { LoadedFile } from '../../scopedResource';
import {
  findTypedSubResource,
  resolveProceduralSubResource,
  type ProceduralTextureResolution,
} from '../resolveProceduralSubResource';
import { decodeGradientResource, decodeGradientTexture2D } from './decode';
import { rasterizeGradientTexture2D } from './build';

/**
 * A saved Gradient is not part of the scene's table, so its resource keys the cache entry beside
 * the table: a reload parses a new resource and rasterises again. An inline Gradient needs no suffix.
 */
export function resolveGradientTexture2D(
  ref: string | undefined,
  pools: SceneResources,
  loadedFile: LoadedFile
): ProceduralTextureResolution<THREE.DataTexture> | null {
  const texture = findTypedSubResource(ref, pools.internalResources, 'GradientTexture2D');
  if (!texture) return null;
  const gradientRef = texture.data.gradient;
  const gradientResource = resolveReferencedResource(gradientRef, pools, loadedFile);
  const isSaved = referencedFilePath(gradientRef, pools) !== null;
  return resolveProceduralSubResource(
    ref,
    pools.internalResources,
    'GradientTexture2D',
    (properties) => rasterize(properties, gradientResource),
    isSaved && gradientResource ? `saved${identityKey(gradientResource)}` : undefined
  );
}

/** Texture properties and their Gradient resource to pixels. Null with no gradient. */
function rasterize(
  properties: Record<string, string>,
  gradientResource: TscnInternalResource | null
): THREE.DataTexture | null {
  const gradient = decodeGradientResource(gradientResource);
  if (!gradient) return null;
  return rasterizeGradientTexture2D(decodeGradientTexture2D(properties), gradient);
}
