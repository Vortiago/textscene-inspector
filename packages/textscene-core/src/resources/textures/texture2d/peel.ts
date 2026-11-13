/**
 * A decoded Texture2D peeled to what a slot draws: the source of its pixels, the AtlasTexture that
 * cuts a region of it, and the CanvasTextures on the way. No THREE and no React.
 */

import type { Read } from '../../reading';
import type { AtlasTextureData } from '../atlastexture/types';
import type { CanvasTextureMaps, Texture2D, Texture2DSource } from './types';

export interface PeeledTexture2D {
  /** `missing` for a resource this cannot draw, `loaded` once `source` is set. */
  readonly status: 'none' | 'pending' | 'missing' | 'loaded';
  readonly source: Texture2DSource | null;
  readonly atlas: AtlasTextureData | null;
  /** The first CanvasTexture above the AtlasTexture, or above the source when there is none. */
  readonly canvasTexture: CanvasTextureMaps | null;
  /** The first CanvasTexture between the AtlasTexture and its source. */
  readonly sheetCanvasTexture: CanvasTextureMaps | null;
  /** Whether a CanvasTexture sits anywhere on the way. */
  readonly namesCanvasTexture: boolean;
}

/**
 * Peels CanvasTextures to a fixed point, and one AtlasTexture. An AtlasTexture with no atlas, or
 * over another AtlasTexture, is missing.
 */
export function peelTexture2D(read: Read<Texture2D>): PeeledTexture2D {
  let canvasTexture: CanvasTextureMaps | null = null;
  let sheetCanvasTexture: CanvasTextureMaps | null = null;
  let atlas: AtlasTextureData | null = null;
  let current = read;
  const peeled = (status: PeeledTexture2D['status'], source: Texture2DSource | null): PeeledTexture2D => ({
    status,
    source,
    atlas,
    canvasTexture,
    sheetCanvasTexture,
    namesCanvasTexture: canvasTexture !== null || sheetCanvasTexture !== null,
  });
  while (current.status === 'loaded') {
    const layer = current.value;
    if (layer.form === 'canvas') {
      if (atlas) sheetCanvasTexture ??= layer.canvasTexture;
      else canvasTexture ??= layer.canvasTexture;
      current = layer.diffuse;
    } else if (layer.form === 'atlas') {
      if (atlas || layer.sheet.status === 'none') return peeled('missing', null);
      atlas = layer.atlas;
      current = layer.sheet;
    } else {
      return peeled('loaded', layer);
    }
  }
  return peeled(current.status === 'unavailable' ? 'missing' : current.status, null);
}
