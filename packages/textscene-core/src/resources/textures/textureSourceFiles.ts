/**
 * The saved files a procedural texture reads its Gradient and FastNoiseLite from, so a hook can
 * load them before the texture resolves (`resolveReference` reads them once loaded).
 */

import type { SceneResources } from '../../r3f/SceneResourcesContext';
import { findSubResource, parseResourceReference } from '../SubResourceResolver';
import { referencedFilePath } from '../resolveReference';

/** The properties of each procedural texture type that name a Gradient or a FastNoiseLite. */
const SOURCE_PROPERTIES: Readonly<Record<string, readonly string[]>> = {
  GradientTexture2D: ['gradient'],
  NoiseTexture2D: ['noise', 'color_ramp'],
  NoiseTexture3D: ['noise', 'color_ramp'],
};

/** The files the texture `ref` names reads its sources from. None for a ref that is not a SubResource. */
export function textureSourceFiles(ref: string | undefined, pools: SceneResources): string[] {
  const parsed = parseResourceReference(ref ?? '');
  const texture =
    parsed?.type === 'SubResource' ? findSubResource(pools.internalResources, parsed.id) : undefined;
  if (!texture) return [];
  return (SOURCE_PROPERTIES[texture.type] ?? []).flatMap(
    (property) => referencedFilePath(texture.data[property], pools) ?? []
  );
}
