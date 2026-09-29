/**
 * Whether a texture reference is generated rather than loaded, for every
 * procedural slice. A first-match walk: each resolver declines another type. A
 * gradient is ready at once. A noise texture is a build its holders start. A ready
 * texture is borrowed from `proceduralTextureCache`: never dispose it, and pin
 * `key` while holding it.
 */

import type { TscnInternalResource } from '../../parser/types.js';
import { resolveGradientTexture2D } from './gradienttexture2d/resolveGradientTexture.js';
import { resolveNoiseTexture2D } from './noisetexture2d/resolveNoiseTexture.js';
import type { ProceduralTextureLookup } from './proceduralBuilds.js';

export type { ProceduralTextureLookup } from './proceduralBuilds.js';

export function resolveProceduralTexture(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): ProceduralTextureLookup | null {
  const gradient = resolveGradientTexture2D(ref, internalResources);
  if (gradient) return { status: 'ready', ...gradient };
  return resolveNoiseTexture2D(ref, internalResources);
}
