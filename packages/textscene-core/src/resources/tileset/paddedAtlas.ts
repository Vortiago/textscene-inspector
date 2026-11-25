/**
 * Godot's padded atlas layout. Godot copies each tile, frame 0, to its atlas coordinates on a grid
 * of cells one texel wider on each side than the texture region, and draws it from there
 * (`tile_set.cpp:5333-5345`, `:5638`).
 */

import type { Vector2 } from '../../godot/math/vector';
import type { ImagePixels } from '../formats/image/imagePixels';
import { atlasTileRegion, type AtlasSourceModel } from './types';

/** The cell padding on each side of a tile. */
const PADDING = 1;

/** `get_runtime_tile_texture_region` with padding: the tile's own `region` size, one texel into its cell. */
export function paddedTileRegion(
  source: Pick<AtlasSourceModel, 'textureRegionSize'>,
  atlasCoords: Vector2,
  region: { width: number; height: number }
): { x: number; y: number; width: number; height: number } {
  const { textureRegionSize: cell } = source;
  return {
    x: atlasCoords.x * (cell.x + 2 * PADDING) + PADDING,
    y: atlasCoords.y * (cell.y + 2 * PADDING) + PADDING,
    width: region.width,
    height: region.height,
  };
}

const BYTES_PER_TEXEL = 4;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** `tile_set.cpp:4729`: integer division truncates, as `Vector2i` does. */
export function atlasGridSize(
  source: Pick<AtlasSourceModel, 'margins' | 'separation' | 'textureRegionSize'>,
  textureSize: { width: number; height: number }
): Vector2 {
  const { margins, separation, textureRegionSize: region } = source;
  const empty = { x: 0, y: 0 };
  if (region.x <= 0 || region.y <= 0) return empty;
  const validWidth = textureSize.width - margins.x;
  const validHeight = textureSize.height - margins.y;
  if (validWidth < region.x || validHeight < region.y) return empty;
  return {
    x: 1 + Math.trunc((validWidth - region.x) / (region.x + separation.x)),
    y: 1 + Math.trunc((validHeight - region.y) / (region.y + separation.y)),
  };
}

/** `tile_set.cpp:5622`, frame 0 only: the model holds no animation frames. */
export function paddedAtlasPixels(pixels: ImagePixels, source: AtlasSourceModel): ImagePixels {
  const cell = { x: source.textureRegionSize.x + 2 * PADDING, y: source.textureRegionSize.y + 2 * PADDING };
  const grid = atlasGridSize(source, pixels);
  const width = grid.x * cell.x;
  const height = grid.y * cell.y;
  const padded: ImagePixels = { width, height, data: new Uint8Array(width * height * BYTES_PER_TEXEL) };
  for (const [key, tile] of source.tiles) {
    const [atlasX, atlasY] = key.split(':').map(Number) as [number, number];
    const region = atlasTileRegion(source, { x: atlasX, y: atlasY }, tile.sizeInAtlas);
    const base = { x: atlasX * cell.x + PADDING, y: atlasY * cell.y + PADDING };
    copyTileWithEdges(padded, pixels, region, base);
  }
  return padded;
}

/** The tile, then its four sides and four corners, in Godot's order (`tile_set.cpp:5640`). */
function copyTileWithEdges(target: ImagePixels, source: ImagePixels, region: Rect, base: Vector2): void {
  const { x, y, width, height } = region;
  const right = x + width - 1;
  const bottom = y + height - 1;
  const copy = (from: Rect, toX: number, toY: number) => blitRect(target, source, from, toX, toY);
  copy(region, base.x, base.y);
  copy({ x, y, width, height: 1 }, base.x, base.y - 1);
  copy({ x, y: bottom, width, height: 1 }, base.x, base.y + height);
  copy({ x, y, width: 1, height }, base.x - 1, base.y);
  copy({ x: right, y, width: 1, height }, base.x + width, base.y);
  copy({ x, y, width: 1, height: 1 }, base.x - 1, base.y - 1);
  copy({ x: right, y, width: 1, height: 1 }, base.x + width, base.y - 1);
  copy({ x, y: bottom, width: 1, height: 1 }, base.x - 1, base.y + height);
  copy({ x: right, y: bottom, width: 1, height: 1 }, base.x + width, base.y + height);
}

/** `image.cpp:3106`: the source rect and the destination clip to both images. */
function blitRect(target: ImagePixels, source: ImagePixels, from: Rect, toX: number, toY: number): void {
  let { x: fromX, y: fromY, width, height } = from;
  if (fromX < 0) [toX, width, fromX] = [toX - fromX, width + fromX, 0];
  if (fromY < 0) [toY, height, fromY] = [toY - fromY, height + fromY, 0];
  if (toX < 0) [fromX, width, toX] = [fromX - toX, width + toX, 0];
  if (toY < 0) [fromY, height, toY] = [fromY - toY, height + toY, 0];
  width = Math.max(0, Math.min(width, source.width - fromX, target.width - toX));
  height = Math.max(0, Math.min(height, source.height - fromY, target.height - toY));
  if (width === 0 || height === 0) return;
  for (let row = 0; row < height; row++) {
    const start = ((fromY + row) * source.width + fromX) * BYTES_PER_TEXEL;
    const end = start + width * BYTES_PER_TEXEL;
    target.data.set(source.data.subarray(start, end), ((toY + row) * target.width + toX) * BYTES_PER_TEXEL);
  }
}
