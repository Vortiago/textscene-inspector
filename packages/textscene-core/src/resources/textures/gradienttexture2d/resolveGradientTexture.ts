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

/**
 * The `width` and `height` of the inline GradientTexture2D `ref` names when it sets no `gradient`,
 * otherwise null. Its `_update` returns early, so the texture never gets an image and Godot
 * samples the 2D placeholder in its place (`gradient_texture.cpp:229-233,400`). A gradient that
 * names a missing resource is no such case.
 */
export function gradientTextureSizeWithoutGradient(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): { width: number; height: number } | null {
  const texture = findTypedSubResource(ref, internalResources, 'GradientTexture2D');
  if (!texture || (texture.data.gradient !== undefined && texture.data.gradient !== 'null')) return null;
  const { width, height } = decodeGradientTexture2D(texture.data);
  return { width, height };
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
