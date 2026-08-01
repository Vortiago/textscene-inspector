/**
 * AtlasTexture build — cutting a decoded cell out of a loaded sheet for the
 * hosts that cannot window with UVs.
 *
 * THE UV HOSTS (Sprite2D, AnimatedSprite2D, every `useTexture2D` consumer) are
 * deliberately absent from this module: they window through the shared
 * `composeFrameTexture` / `frameSizePx` pair (`r3f/spriteFrame.ts`), which takes
 * the cell as its `atlasRegion` argument. One applier, so an atlas cell and an
 * authored `region_rect` cannot drift apart.
 *
 * THE DOM HOSTS (TextureRect, Button icons) have no UVs to window: they render
 * an `<img>` from a data URL, so the cell must be cut out of the decoded bitmap.
 * That is what this module is for. It goes through the shared `withImageCanvas`
 * drawability/taint policy and adds only the crop.
 *
 * NOT SUPPORTED, and why each omission is safe rather than silently wrong:
 *   - `margin` — Godot pads the drawn size with transparent border
 *     (`get_width() = region.width + margin.size.width`,
 *     `scene/resources/atlas_texture.cpp:33-42`) and shifts the source by
 *     `margin.position` (`get_rect_region`, atlas_texture.cpp:203). Applying
 *     neither keeps the cell's own pixels correct; only a trimmed-atlas layout
 *     sits off by the margin.
 *   - `filter_clip` — Godot's `p_clip_uv` clamps sampling inside the cell so a
 *     filtered edge cannot bleed in from the neighbouring cell
 *     (atlas_texture.cpp:163). A cropped bitmap cannot bleed at all, so the DOM
 *     path is unaffected; the UV path can, and three has no per-draw equivalent.
 * Both are recorded in `resources/textures/comparison.md`.
 */

import { withImageCanvas, type ImageSize } from '../../../r3f/controls/withImageCanvas';
import type { AtlasRegion } from './types';

/**
 * The crop a cell describes over a decoded image, clamped to the image bounds
 * (Godot clips a cell to the sheet: `_get_region_rect().intersection(src)`,
 * atlas_texture.cpp:204). Pure, so the geometry is testable without a canvas —
 * happy-dom has none. Null when the cell falls entirely outside the image.
 */
export function atlasCropRect(
  image: ImageSize,
  region: AtlasRegion
): { sx: number; sy: number; width: number; height: number } | null {
  const sx = Math.max(0, Math.min(region.x, image.width));
  const sy = Math.max(0, Math.min(region.y, image.height));
  const width = Math.min(region.x + region.width, image.width) - sx;
  const height = Math.min(region.y + region.height, image.height) - sy;
  if (!(width > 0) || !(height > 0)) return null;
  return { sx, sy, width, height };
}

/**
 * The cell as a self-contained data URL, for the DOM controls that draw an
 * `<img>` instead of sampling a texture. Undefined when the image is not
 * drawable (no DOM, no 2D context, tainted canvas — `withImageCanvas`'s policy)
 * or the cell misses the sheet entirely, so callers fall back exactly as they
 * already do for an image that has not decoded yet.
 */
export function atlasRegionDataUrl(image: unknown, region: AtlasRegion): string | undefined {
  return withImageCanvas(image, (ctx, size) => {
    const crop = atlasCropRect(size, region);
    if (!crop) return undefined;
    const cell = globalThis.document.createElement('canvas');
    cell.width = crop.width;
    cell.height = crop.height;
    const cellCtx = cell.getContext('2d');
    if (!cellCtx) return undefined;
    cellCtx.drawImage(
      ctx.canvas,
      crop.sx,
      crop.sy,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height
    );
    return cell.toDataURL();
  });
}
