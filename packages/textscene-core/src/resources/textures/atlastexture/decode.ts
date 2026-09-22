/**
 * AtlasTexture decode — an `AtlasTexture` section's raw properties into "which
 * sheet, which window", plus the one piece of geometry every consumer needs:
 * the atlas rectangle it samples and the size it reports.
 *
 * `atlas = ExtResource("2")` names the sheet and `region = Rect2(x, y, w, h)`
 * the cell. The atlas REF STAYS RAW here, the same rule SpriteFrames' frame refs
 * follow: resolving it needs the owning file's ExtResource table, and keeping
 * that out makes this a leaf module — which is what lets the shared Texture2D
 * resolvers call the decode without an import cycle.
 *
 * The Rect2 grammar is the shared canonical reader's, so a malformed component
 * (`1.2.3`, `1e-`, a double sign) fails the whole match and leaves the rect at
 * Godot's own zero default, instead of the NaN a loose `[\d.eE+-]+` copy stores.
 *
 * Pure `.ts`, no THREE — `build.ts` composes the layout into a texture.
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
 * describes nothing drawable.
 *
 * `atlasSize` is only consulted for an axis whose region size rounds to zero,
 * which is where Godot substitutes the atlas's own dimension
 * (`get_width`/`get_height` :34-38/:45-49, `_get_region_rect` :126-137). Pass
 * null when the atlas image has not loaded — the answer is then null on exactly
 * the axes that need it, and available on every fully-authored region without
 * loading anything at all.
 */
export function atlasTextureLayout(
  tex: AtlasTextureData,
  atlasSize: { width: number; height: number } | null
): AtlasTextureLayout | null {
  // `set_region` stores `Rect2(position, size.floor())` (:97) — the SIZE is
  // rounded because an image rectangle is whole texels; the position is not.
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
    // The position is floored here rather than in `set_region`: Godot samples it
    // as a float UV, a pixel crop has to start on a whole texel.
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
