/**
 * Decoder for an `AtlasTexture` sub-resource block, plus the one piece of
 * geometry every consumer of it needs: which atlas rectangle it samples and how
 * big it claims to be.
 *
 * An AtlasTexture is a first-class Texture2D that windows another one — a
 * sprite-sheet cell. Godot presents it to every consumer as a texture of its
 * OWN size (`get_width`/`get_height`, `scene/resources/atlas_texture.cpp`
 * :33-53), not the sheet's, which is why the size half matters as much as the
 * pixels: a Control's minimum size reads exactly that.
 *
 * Pure `.ts`, no THREE — `renderer.ts` composes the layout into a texture.
 */

import type { AtlasRect, AtlasTexture, AtlasTextureLayout } from './types';

const ZERO_RECT: AtlasRect = { x: 0, y: 0, width: 0, height: 0 };

const RECT2_RE =
  /^Rect2\(\s*(-?[\d.eE+-]+)\s*,\s*(-?[\d.eE+-]+)\s*,\s*(-?[\d.eE+-]+)\s*,\s*(-?[\d.eE+-]+)\s*\)$/;

/**
 * Read an `AtlasTexture` block's properties. Every default is the one Godot's
 * own member initialisers install (`atlas_texture.h:42-45`): a zero `region`, a
 * zero `margin`, `filter_clip = false`.
 */
export function parseAtlasTexture(data: Record<string, unknown>): AtlasTexture {
  return {
    atlas: typeof data.atlas === 'string' ? data.atlas : null,
    region: parseRect2(data.region),
    margin: parseRect2(data.margin),
    filterClip: data.filter_clip === 'true' || data.filter_clip === true,
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
  tex: AtlasTexture,
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
    source: { x: Math.floor(tex.region.x), y: Math.floor(tex.region.y), width: sourceW, height: sourceH },
    // `draw` composes the region at `margin.position` inside the reported box
    // (:163); the rest of the box is empty.
    dest: { x: tex.margin.x, y: tex.margin.y },
  };
}

function parseRect2(value: unknown): AtlasRect {
  if (typeof value !== 'string') return ZERO_RECT;
  const m = RECT2_RE.exec(value);
  if (!m) return ZERO_RECT;
  const rect = {
    x: parseFloat(m[1]!),
    y: parseFloat(m[2]!),
    width: parseFloat(m[3]!),
    height: parseFloat(m[4]!),
  };
  return Object.values(rect).some(Number.isNaN) ? ZERO_RECT : rect;
}
