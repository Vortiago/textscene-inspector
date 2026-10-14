/**
 * Whether a texture reference is built from the scene's text rather than loaded, for every
 * procedural slice of each texture dimension. A first-match walk: each resolver declines another
 * type. A gradient or an inline image is ready at once. A noise texture is a build its holders
 * start. A ready texture is borrowed from `proceduralTextureCache`: never dispose it, and pin
 * `key` while holding it.
 */

import type { TscnInternalResource } from '../../parser/types.js';
import { resolveGradientTexture2D } from './gradienttexture2d/resolveGradientTexture.js';
import { resolveImageTexture } from './imagetexture/resolveImageTexture.js';
import { resolveImageTexture3D } from './imagetexture3d/resolveImageTexture3D.js';
import { resolveNoiseTexture2D } from './noisetexture2d/resolveNoiseTexture.js';
import { resolveNoiseTexture3D } from './noisetexture3d/resolveNoiseTexture.js';
import type { ProceduralTextureLookup } from './proceduralBuilds.js';

export function resolveProceduralTexture(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): ProceduralTextureLookup | null {
  const ready =
    resolveGradientTexture2D(ref, internalResources) ?? resolveImageTexture(ref, internalResources);
  if (ready) return { status: 'ready', ...ready };
  return resolveNoiseTexture2D(ref, internalResources);
}

/** {@link resolveProceduralTexture} for a Texture3D slot. */
export function resolveProceduralTexture3D(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): ProceduralTextureLookup | null {
  const image = resolveImageTexture3D(ref, internalResources);
  if (image) return { status: 'ready', ...image };
  return resolveNoiseTexture3D(ref, internalResources);
}
