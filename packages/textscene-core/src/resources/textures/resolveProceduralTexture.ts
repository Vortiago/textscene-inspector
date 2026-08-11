/**
 * "Is this texture reference generated rather than loaded?" — one answer for
 * every procedural texture slice.
 *
 * A procedural texture is described entirely by the file it lives in, so it
 * resolves synchronously where the slot is read, with no host-file round trip.
 * There are two such slices now (GradientTexture2D, NoiseTexture2D) and every
 * consumer needs the same walk, so the dispatch lives here rather than being
 * re-spelled per call site — the pattern where a third slice would silently
 * reach only whichever consumers remembered to add it.
 *
 * Each slice's resolver declines a reference that is not its own type, so this
 * is a first-match walk, not a type lookup the caller performs.
 *
 * The result is BORROWED from `proceduralTextureCache`: callers never dispose
 * it, and must pin `key` for as long as they hold `texture`.
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
