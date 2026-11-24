import { visitIndexedKeys } from '../../godot/classdb/indexedKey.js';
import { strToVar } from '../../godot/variant/strToVar.js';
import { castVariant } from '../../godot/variant/variantCast.js';
import { VARIANT_TYPE as T } from '../../godot/variant/variantType.js';
import type { VariantValue } from '../../godot/variant/variantValue.js';
import { tileMapLayerVector } from '../../nodes/2d/tiles/shared/layerVector.js';
import { decodeLegacyTileData, type PlacedCell } from '../../nodes/2d/tiles/shared/tileData.js';
import { tileMapLayerNames } from '../../nodes/2d/tiles/tilemap/layerNames.js';
import { intOr } from '../../parser/valueParsers.js';
import { perObject } from '../../utils/perObject.js';
import { boolValue, intValue } from '../derived/valueOf.js';
import type { GetOutcome } from '../propertyAccess.js';
import type { ListedReads, NodeTexts } from './listedProperties.js';

interface LayerLeaf {
  readonly type: number;
  /** The value of a layer the file sets nothing of: TileMapLayer's own. */
  readonly initial: VariantValue;
}

/** The leaves `register_property` declares bar `name` and `tile_data` (tile_map.cpp:1031-1037). */
const LAYER_LEAVES: Readonly<Record<string, LayerLeaf>> = {
  enabled: { type: T.BOOL, initial: boolValue(true) },
  modulate: { type: T.COLOR, initial: { type: T.COLOR, value: [1, 1, 1, 1] } },
  y_sort_enabled: { type: T.BOOL, initial: boolValue(false) },
  y_sort_origin: { type: T.INT, initial: intValue(0) },
  z_index: { type: T.INT, initial: intValue(0) },
  navigation_enabled: { type: T.BOOL, initial: boolValue(true) },
};

/** The layer and leaf a name asks for, as `is_property_valid` reads it, or null for another name. */
function layerKeyOf(property: string): { index: number; leaf: string } | null {
  let key: { index: number; leaf: string } | null = null;
  visitIndexedKeys({ [property]: '' }, 'layer_', 'is_valid_int', (_key, _text, index, leaf) => {
    key = { index, leaf };
  });
  return key;
}

/** The leaves the file writes of each layer, and the node name of each layer the file builds. */
const layersOf = perObject((texts: NodeTexts) => ({
  leaves: new Map(tileMapLayerVector(texts)),
  names: tileMapLayerNames(texts),
}));

/** `TileMap::_get` of a `layer_<i>/<leaf>` name, through its PropertyListHelper (tile_map.cpp:727-744). */
export function tileMapLayers(property: string, { texts }: ListedReads): GetOutcome {
  const key = layerKeyOf(property);
  if (!key) return { kind: 'unknown' };
  const { leaves, names } = layersOf(texts);
  // `_get_property` refuses a layer past the last and an undeclared leaf (property_list_helper.cpp:58).
  if (!names.has(key.index)) return { kind: 'refused' };
  if (key.leaf === 'tile_data') return tileDataOf(leaves.get(key.index)?.get('tile_data'), texts);
  if (key.leaf === 'name') return { kind: 'value', value: { type: T.STRING, value: names.get(key.index)! } };
  const leaf = Object.hasOwn(LAYER_LEAVES, key.leaf) ? LAYER_LEAVES[key.leaf] : undefined;
  if (!leaf) return { kind: 'refused' };
  const text = leaves.get(key.index)?.get(key.leaf);
  return { kind: 'value', value: text === undefined ? leaf.initial : castVariant(strToVar(text), leaf.type) };
}

/** The format the member starts at when the file writes none: TILE_MAP_DATA_FORMAT_3 (tile_map.h:64). */
const CURRENT_FORMAT = 2;

/** `_get_tile_map_data_using_compatibility_format` (tile_map.cpp:146-170): each cell, in the format it saves. */
function tileDataOf(text: string | undefined, texts: NodeTexts): GetOutcome {
  // A Godot 3 format loads no cells in a build without the deprecated code.
  if (text === undefined || intOr(texts.format, CURRENT_FORMAT) !== CURRENT_FORMAT) return cellsValue([]);
  const cells = decodeLegacyTileData(text, CURRENT_FORMAT);
  return cells ? cellsValue(cellsByCoords(cells)) : { kind: 'unported', declaredBy: 'TileMap' };
}

function cellsValue(cells: readonly PlacedCell[]): GetOutcome {
  return { kind: 'value', value: { type: T.PACKED_INT32_ARRAY, value: encodeCells(cells) } };
}

/** The layer's `HashMap<Vector2i, CellData>`: a cell set twice keeps its first place and its last value. */
function cellsByCoords(cells: readonly PlacedCell[]): PlacedCell[] {
  const byCoords = new Map<string, PlacedCell>();
  for (const cell of cells) byCoords.set(`${cell.coords.x},${cell.coords.y}`, cell);
  return [...byCoords.values()];
}

/** Three int32s a cell: int16 x and y, then uint16 source, atlas x, atlas y and alternative, little-endian. */
function encodeCells(cells: readonly PlacedCell[]): number[] {
  const view = new DataView(new ArrayBuffer(cells.length * 12));
  cells.forEach((cell, index) => {
    const offset = index * 12;
    view.setInt16(offset, cell.coords.x, true);
    view.setInt16(offset + 2, cell.coords.y, true);
    view.setUint16(offset + 4, cell.sourceId, true);
    view.setUint16(offset + 6, cell.atlasCoords.x, true);
    view.setUint16(offset + 8, cell.atlasCoords.y, true);
    view.setUint16(offset + 10, cell.alternativeId, true);
  });
  return [...new Int32Array(view.buffer)];
}
