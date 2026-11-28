import type { ImageSize } from '../../resources/formats/image/imagePixels.js';
import type { AtlasRect } from '../../resources/textures/atlastexture/types.js';

export interface AtlasLayout extends ImageSize {
  rects: readonly AtlasRect[];
  wanted?: ImageSize;
}

type Fitted<Layout> = Layout & { wanted?: ImageSize };

function fits({ width, height }: ImageSize, limit: number): boolean {
  return width <= limit && height <= limit;
}

/** @canonical Fit the textures of an atlas to the GPU size limit in join order */
export function fitAtlas<Layout extends ImageSize>(
  count: number,
  pack: (count: number) => Layout,
  limit: number,
  capacity: () => number
): Fitted<Layout> {
  const full = pack(count);
  if (fits(full, limit) || count === 0) return full;
  const wanted = { width: full.width, height: full.height };
  // A later cell can improve the skyline, so a failed layout rules out only that prefix.
  for (let kept = Math.min(count - 1, capacity()); kept > 0; kept--) {
    const layout = pack(kept);
    if (fits(layout, limit)) return { ...layout, wanted };
  }
  return { ...pack(0), wanted };
}
