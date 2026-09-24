/**
 * AtlasTexture decode: which sheet, which window, the rectangle it samples and
 * the size it reports. The atlas ref stays raw, so this is a leaf module that the
 * Texture2D resolvers import with no cycle. A malformed Rect2 component leaves
 * Godot's zero default, not NaN. No THREE.
 */

import { boolSlotValue } from '../../../godot/index.js';
import { parseOptionalRect2 } from '../../../parser/valueParsers';
import { type AtlasRect, type AtlasTextureData, type AtlasTextureLayout } from './types';

const ZERO_RECT: AtlasRect = { x: 0, y: 0, width: 0, height: 0 };

/**
 * Read an `AtlasTexture` block's properties. Every default is the one Godot's
 * own member initialisers install (`atlas_texture.h:42-45`): a zero `region`, a
 * zero `margin`, `filter_clip = false`.
 */
export function decodeAtlasTexture(properties: Record<string, unknown>): AtlasTextureData {
  return {
    atlas: typeof properties.atlas === 'string' ? properties.atlas : null,
    region: rect(properties.region, 'AtlasTexture region'),
    margin: rect(properties.margin, 'AtlasTexture margin'),
    filterClip:
      boolSlotValue(typeof properties.filter_clip === 'string' ? properties.filter_clip : undefined) ===
        true || properties.filter_clip === true,
  };
}

/**
 * The atlas rectangle `tex` samples and the size it reports, or null when it
 * describes nothing drawable. `atlasSize` is read only for a zero axis, where
 * Godot uses the atlas's dimension (`get_width`/`get_height` :34-38/:45-49,
 * `_get_region_rect` :126-137). Null `atlasSize` answers null only on such an axis.
 */
export function atlasTextureLayout(
  tex: AtlasTextureData,
  atlasSize: { width: number; height: number } | null
): AtlasTextureLayout | null {
  // `set_region` stores `Rect2(position, size.floor())` (:97): the size is whole
  // texels, the position is not.
  const roundedW = Math.floor(tex.region.width);
  const roundedH = Math.floor(tex.region.height);

  const sourceW = roundedW === 0 ? atlasSize?.width : roundedW;
  const sourceH = roundedH === 0 ? atlasSize?.height : roundedH;
  if (sourceW === undefined || sourceH === undefined) return null;

  const width = roundedW === 0 ? sourceW : roundedW + tex.margin.width;
  const height = roundedH === 0 ? sourceH : roundedH + tex.margin.height;
  if (width <= 0 || height <= 0 || sourceW <= 0 || sourceH <= 0) return null;

  return {
    width,
    height,
    // The position is floored here, not in `set_region`: Godot samples a float
    // UV, and a pixel crop starts on a whole texel.
    source: {
      x: Math.floor(tex.region.x),
      y: Math.floor(tex.region.y),
      width: sourceW,
      height: sourceH,
    },
    // `draw` composes the region at `margin.position` inside the reported box
    // (:163); the rest of the box is empty.
    dest: { x: tex.margin.x, y: tex.margin.y },
  };
}

function rect(value: unknown, context: string): AtlasRect {
  if (typeof value !== 'string') return ZERO_RECT;
  return parseOptionalRect2(value, context) ?? ZERO_RECT;
}
