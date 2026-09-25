/**
 * Whether a texture reference is generated rather than loaded, for every
 * procedural slice, resolved synchronously. A first-match walk: each resolver
 * declines another type. The result is borrowed from `proceduralTextureCache`:
 * never dispose it, and pin `key` while holding `texture`.
 */

import type { TscnInternalResource } from '../../parser/types.js';
import { resolveGradientTexture2D } from './gradienttexture2d/resolveGradientTexture.js';
import { resolveNoiseTexture2D } from './noisetexture2d/resolveNoiseTexture.js';
import type { ProceduralTextureResolution } from './resolveProceduralSubResource.js';

export type { ProceduralTextureResolution } from './resolveProceduralSubResource.js';

export function resolveProceduralTexture(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): ProceduralTextureResolution | null {
  return (
    resolveGradientTexture2D(ref, internalResources) ??
    resolveNoiseTexture2D(ref, internalResources)
  );
}
