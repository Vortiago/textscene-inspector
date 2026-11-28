import type { ImageSize } from '../../resources/formats/image/imagePixels.js';
import type { AtlasRect } from '../../resources/textures/atlastexture/types.js';

export interface AtlasLayout extends ImageSize {
  rects: readonly AtlasRect[];
}

type PackAtlas = (sizes: readonly ImageSize[]) => AtlasLayout;

function fits({ width, height }: ImageSize, limit: number): boolean {
  return width <= limit && height <= limit;
}

/** @canonical Fit the textures of an atlas to the GPU size limit in join order */
export function fitAtlas(pack: PackAtlas, sizes: readonly ImageSize[], limit: number) {
  const full = pack(sizes);
  if (fits(full, limit)) return { layout: full, wanted: undefined };
  let fitting = pack([]);
  let low = 0;
  let high = sizes.length - 1;
  while (low < high) {
    const kept = Math.ceil((low + high) / 2);
    const layout = pack(sizes.slice(0, kept));
    if (fits(layout, limit)) {
      fitting = layout;
      low = kept;
    } else {
      high = kept - 1;
    }
  }
  return { layout: fitting, wanted: { width: full.width, height: full.height } };
}
