/**
 * The editor's placeholder for a scene tile (`TileMapLayer::_scenes_draw_cell_debug`,
 * `tile_map_layer.cpp:1661-1700`): a translucent disc at a cell whose scene is missing, or whose
 * tile asks for it with `display_placeholder`. Only the Gizmos toggle draws it.
 */

import { hsvToRgb } from '../../godot/math/color.js';
import { hashIntArray } from '../../godot/math/hashFuncs.js';
import type { Rgba } from '../../godot/math/math.js';
import type { Vector2 } from '../../godot/math/vector.js';
import { GodotRandomPCG } from '../../nodes/shared/cpuparticles/godotRng.js';
import { mapToLocalPx } from './tilePlacement.js';
import type { SceneTileCell } from './sceneTileCells.js';
import type { TileGrid } from './types.js';

/** `canvas_item_add_ellipse`'s fixed fan (`renderer_canvas_cull.cpp:1436`). */
export const PLACEHOLDER_SEGMENTS = 64;

const PLACEHOLDER_ALPHA = 0.8;

export interface PlaceholderCircle {
  /** The cell's centre, in the layer's pixels (+Y down). */
  center: Vector2;
  radius: number;
  color: Rgba;
}

/**
 * The disc's colour, drawn from the hash of the cell's source id and its alternative, transform
 * bits included (`:1681-1693`). Hue takes the top byte of the first `RandomPCG` word; saturation
 * and value take the next two bytes, each lerped into the upper half.
 */
export function placeholderColor(sourceId: number, alternativeId: number): Rgba {
  const word = new GodotRandomPCG(hashIntArray([sourceId, alternativeId])).rand();
  const byte = (shift: number) => ((word >>> shift) & 0xff) / 256;
  const rgb = hsvToRgb(byte(24), 0.5 + 0.5 * byte(16), 0.5 + 0.5 * byte(8));
  return { ...rgb, a: PLACEHOLDER_ALPHA };
}

/** The discs for `tiles`, a quarter of the shorter tile side in radius (`:1698`). */
export function placeholderCircles(grid: TileGrid, tiles: readonly SceneTileCell[]): PlaceholderCircle[] {
  const radius = Math.min(grid.tileSize.x, grid.tileSize.y) / 4;
  // A layer holds few distinct (source, alternative) pairs, and each colour costs a hash and an RNG.
  const colors = new Map<string, Rgba>();
  const colorOf = (sourceId: number, alternativeId: number): Rgba => {
    const key = `${sourceId}:${alternativeId}`;
    let color = colors.get(key);
    if (!color) colors.set(key, (color = placeholderColor(sourceId, alternativeId)));
    return color;
  };
  return tiles.map(({ cell }) => ({
    center: mapToLocalPx(grid, cell.coords),
    radius,
    color: colorOf(cell.sourceId, cell.alternativeId),
  }));
}
