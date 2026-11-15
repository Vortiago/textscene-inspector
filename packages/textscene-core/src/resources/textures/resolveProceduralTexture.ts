/**
 * The procedural texture a decoded source builds, for every procedural slice of each texture
 * dimension. A gradient or an image is ready at once. A noise texture is a build its holders start.
 * A ready texture is borrowed from `proceduralTextureCache`: never dispose it, and pin `key` while
 * holding it. Null for a source that is no procedural texture, or one that builds nothing.
 */

import { gradientTexture2D } from './gradienttexture2d/resolveGradientTexture.js';
import { imageTexture } from './imagetexture/resolveImageTexture.js';
import { imageTexture3D } from './imagetexture3d/resolveImageTexture3D.js';
import { noiseTexture2D } from './noisetexture2d/resolveNoiseTexture.js';
import { noiseTexture3D } from './noisetexture3d/resolveNoiseTexture.js';
import type { ProceduralTextureLookup } from './proceduralBuilds.js';
import type { ProceduralTextureResolution } from './rasterizedTexture.js';
import type { Texture2DSource } from './texture2d/types.js';
import type { Texture3D } from './texture3d/types.js';

export function proceduralTexture2D(source: Texture2DSource | null): ProceduralTextureLookup | null {
  switch (source?.form) {
    case 'gradient':
      return ready(gradientTexture2D(source));
    case 'image':
      return ready(imageTexture(source.image));
    case 'noise':
      return noiseTexture2D(source);
    default:
      return null;
  }
}

/** {@link proceduralTexture2D} for a Texture3D. */
export function proceduralTexture3D(source: Texture3D | null): ProceduralTextureLookup | null {
  switch (source?.form) {
    case 'image':
      return ready(imageTexture3D(source));
    case 'noise':
      return noiseTexture3D(source);
    default:
      return null;
  }
}

function ready(resolution: ProceduralTextureResolution | null): ProceduralTextureLookup | null {
  return resolution && { status: 'ready', ...resolution };
}
