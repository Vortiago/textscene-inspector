/** The cells a tile layer holds, as Godot keeps them in its `HashMap<Vector2i, CellData>`. */
import { VARIANT_TYPE as T } from '../godot/variant/variantType.js';
import type { VariantValue } from '../godot/variant/variantValue.js';
import {
  decodeLegacyTileData,
  decodeTileMapData,
  type PlacedCell,
} from '../nodes/2d/tiles/shared/tileData.js';
import { intOr } from '../parser/valueParsers.js';

/** The texts a node's file sets, by property name. */
type NodeTexts = Readonly<Record<string, string>>;

/** The format a TileMap starts at when the file writes none: TILE_MAP_DATA_FORMAT_3 (tile_map.h:64). */
export const CURRENT_TILE_MAP_FORMAT = 2;

/** A cell set twice keeps its first place and its last value. */
export function cellsByCoords(cells: readonly PlacedCell[]): PlacedCell[] {
  const byCoords = new Map<string, PlacedCell>();
  for (const cell of cells) byCoords.set(`${cell.coords.x},${cell.coords.y}`, cell);
  return [...byCoords.values()];
}

/** A TileMap layer's `tile_data`, null where it does not decode. A Godot 3 format loads no cells here. */
export function legacyLayerCells(text: string | undefined, texts: NodeTexts): PlacedCell[] | null {
  if (text === undefined || intOr(texts.format, CURRENT_TILE_MAP_FORMAT) !== CURRENT_TILE_MAP_FORMAT)
    return [];
  const cells = decodeLegacyTileData(text, CURRENT_TILE_MAP_FORMAT);
  return cells && cellsByCoords(cells);
}

/** A TileMapLayer's cells. Data that does not decode loads none (tile_map_layer.cpp:3216-3240). */
export function tileMapLayerCells(texts: NodeTexts): PlacedCell[] {
  const data = texts.tile_map_data;
  return cellsByCoords((data === undefined ? null : decodeTileMapData(data)) ?? []);
}

/** `get_used_cells`: each cell's coordinates, as `Array[Vector2i]`. */
export function usedCellsValue(cells: readonly PlacedCell[]): VariantValue {
  const elements = cells.map(({ coords }) => ({ type: T.VECTOR2I, value: [coords.x, coords.y] }) as const);
  return { type: T.ARRAY, elements, elementType: { builtin: T.VECTOR2I } };
}
