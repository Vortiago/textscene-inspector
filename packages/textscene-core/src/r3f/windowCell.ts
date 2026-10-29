/**
 * The cell of a texture a UV window shows, with a texel of apron on each side, so a copy of the
 * cell samples as the whole texture does. A linear filter reads at most one texel past the window,
 * and a texture edge clamps alike in the cell and the whole.
 */

import type { AtlasTextureLayout } from '../resources/textures/atlastexture/types';
import type { ImageSize } from '../resources/formats/image/imagePixels';
import type { UvWindow } from './uvWindow';

/** The texels past the window that a linear filter reads. A mip chain reads further, so it takes no cell. */
const FILTER_APRON = 1;

/** A cell of a texture, as the layout that cuts it and the window that shows the same texels in it. */
export interface WindowCell {
  layout: AtlasTextureLayout;
  window: UvWindow;
}

/**
 * The cell `window` shows of a texture of `size` texels, which clamps at its edges on both axes
 * when `isClamped`. Null when the cell is the whole texture, when the window tiles past an edge, or
 * when the filter reads past an edge the sampler wraps over.
 */
export function windowCell(window: UvWindow, size: ImageSize, isClamped: boolean): WindowCell | null {
  const columns = apronSpan(window.offset.x, window.repeat.x, size.width, isClamped);
  const rows = apronSpan(window.offset.y, window.repeat.y, size.height, isClamped);
  if (!columns || !rows) return null;
  const width = columns.end - columns.start;
  const height = rows.end - rows.start;
  if (width === size.width && height === size.height) return null;
  return {
    // Rows count from the top in a layout and from the bottom in a window.
    layout: {
      width,
      height,
      source: { x: columns.start, y: size.height - rows.end, width, height },
      dest: { x: 0, y: 0 },
    },
    window: {
      repeat: { x: (window.repeat.x * size.width) / width, y: (window.repeat.y * size.height) / height },
      offset: {
        x: (window.offset.x * size.width - columns.start) / width,
        y: (window.offset.y * size.height - rows.start) / height,
      },
    },
  };
}

/** The texels one axis of a window reads, apron included, or null when they leave the texture. */
function apronSpan(
  offset: number,
  repeat: number,
  size: number,
  isClamped: boolean
): { start: number; end: number } | null {
  const first = Math.min(offset, offset + repeat) * size;
  const last = Math.max(offset, offset + repeat) * size;
  if (first < 0 || last > size) return null;
  const start = Math.floor(first) - FILTER_APRON;
  const end = Math.ceil(last) + FILTER_APRON;
  if (!isClamped && (start < 0 || end > size)) return null;
  return { start: Math.max(start, 0), end: Math.min(end, size) };
}
