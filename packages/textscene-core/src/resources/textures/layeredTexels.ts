/**
 * The texels of an image cut into layers, as Godot's layered importer cuts it for a 3D texture or
 * a texture array (`editor/import/resource_importer_layered_texture.cpp:370-386`). It reads
 * decoded pixels, so a test runs it without a browser.
 */

import type { ImportSlices } from '../../godot/import/layeredTextureImport';
import { emptyLike, type PlainPixelsOf } from '../../utils/emptyLike';

type Texels = Uint8Array | Uint16Array | Float32Array;

type SourcePixels = Uint8Array | Uint8ClampedArray | Uint16Array;

/** RGBA texels, layer after layer, each layer's rows from the top. */
export interface LayeredTexels<LayerTexels extends Texels = Uint8Array> {
  texels: LayerTexels;
  width: number;
  height: number;
  depth: number;
}

/** RGBA pixels, top row first: bytes from an image decoder, or half-float bits from an HDR decoder. */
interface LayeredSource<Source extends SourcePixels> {
  data: Source;
  width: number;
  height: number;
}

/**
 * Each layer is the image's size over the counts, truncated, so a remainder column or row is
 * dropped. Layers run left to right, then top to bottom. Null when a layer is empty, which Godot
 * skips (`:380`), leaving no texture. The texels can share the image's buffer. Half-float bits
 * stay half-float bits, and bytes land in a plain `Uint8Array`.
 */
export function sliceImage<Source extends SourcePixels>(
  image: LayeredSource<Source>,
  { horizontal, vertical }: ImportSlices
): LayeredTexels<PlainPixelsOf<Source>> | null {
  const width = Math.trunc(image.width / horizontal);
  const height = Math.trunc(image.height / vertical);
  if (width < 1 || height < 1) return null;
  const depth = horizontal * vertical;
  if (horizontal === 1 && height * vertical === image.height && isLayerTexels(image.data)) {
    return { texels: image.data, width, height, depth };
  }
  const length = width * height * depth * 4;
  const texels = emptyLike(image.data, length);
  const rowTexels = width * 4;
  for (let layer = 0; layer < depth; layer++) {
    const left = (layer % horizontal) * width;
    const top = Math.trunc(layer / horizontal) * height;
    for (let y = 0; y < height; y++) {
      const source = ((top + y) * image.width + left) * 4;
      texels.set(image.data.subarray(source, source + rowTexels), (layer * height + y) * rowTexels);
    }
  }
  return { texels, width, height, depth };
}

/**
 * The layers cut down to their red byte, one byte for each texel: all a shadowmask reads, so its
 * texture takes a quarter of the memory.
 */
export function redOnly({ texels, ...size }: LayeredTexels): LayeredTexels {
  const red = new Uint8Array(texels.length / 4);
  for (let texel = 0; texel < red.length; texel++) red[texel] = texels[texel * 4]!;
  return { texels: red, ...size };
}

/** Whether `data` already has the texel type its layers take, so a stack of whole rows is itself. */
function isLayerTexels<Source extends SourcePixels>(data: Source): data is Source & PlainPixelsOf<Source> {
  return data instanceof Uint16Array || data instanceof Uint8Array;
}
