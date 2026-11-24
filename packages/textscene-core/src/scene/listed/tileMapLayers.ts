import { visitIndexedKeys } from '../../godot/classdb/indexedKey.js';
import { strToVar } from '../../godot/variant/strToVar.js';
import { castVariant } from '../../godot/variant/variantCast.js';
import { VARIANT_TYPE as T } from '../../godot/variant/variantType.js';
import type { VariantValue } from '../../godot/variant/variantValue.js';
import { tileMapLayerVector } from '../../nodes/2d/tiles/shared/layerVector.js';
import { tileMapLayerNames } from '../../nodes/2d/tiles/tilemap/layerNames.js';
import { perObject } from '../../utils/perObject.js';
import { boolValue, intValue } from '../derived/valueOf.js';
import type { GetOutcome } from '../propertyAccess.js';
import type { NodeTexts } from './listedProperties.js';

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

/** Each layer the file builds, by index, with its node name. */
const layersOf = perObject((texts: NodeTexts) => ({
  leaves: new Map(tileMapLayerVector(texts)),
  names: tileMapLayerNames(texts),
}));

/** `TileMap::_get` of a `layer_<i>/<leaf>` name, through its PropertyListHelper (tile_map.cpp:727-744). */
export function tileMapLayers(property: string, texts: NodeTexts): GetOutcome {
  const key = layerKeyOf(property);
  if (!key) return { kind: 'unknown' };
  if (key.leaf === 'tile_data') return { kind: 'unported', declaredBy: 'TileMap' };
  const { leaves, names } = layersOf(texts);
  // `_get_property` refuses a layer past the last and an undeclared leaf (property_list_helper.cpp:58).
  if (!leaves.has(key.index)) return { kind: 'refused' };
  if (key.leaf === 'name') return { kind: 'value', value: { type: T.STRING, value: names.get(key.index)! } };
  const leaf = Object.hasOwn(LAYER_LEAVES, key.leaf) ? LAYER_LEAVES[key.leaf] : undefined;
  if (!leaf) return { kind: 'refused' };
  const text = leaves.get(key.index)!.get(key.leaf);
  return { kind: 'value', value: text === undefined ? leaf.initial : castVariant(strToVar(text), leaf.type) };
}
