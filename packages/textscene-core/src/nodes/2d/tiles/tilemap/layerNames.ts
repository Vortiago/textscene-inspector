import { visitIndexedKeys } from '../../../../godot/classdb/indexedKey.js';
import { serialChildName, validateNodeName } from '../../../../godot/string/nodeName.js';
import { unquoteString } from '../../../../parser/utils.js';
import { LAYER_FILL_CEILING, LAYER_LEAVES } from '../shared/layerVector.js';

/** Each layer's name as `_set` builds and renames them in file order. No suffix past the fill ceiling. */
export function tileMapLayerNames(properties: Readonly<Record<string, string>>): Map<number, string> {
  // `TileMap()` builds and names the first layer (:1014-1018).
  const names = new Map([[0, 'Layer0']]);
  visitIndexedKeys(properties, 'layer_', 'is_valid_int', (_key, _indexText, index, leaf, value) => {
    if (!LAYER_LEAVES.has(leaf)) return;
    buildLayersTo(names, index);
    if (leaf === 'name') rename(names, index, unquoteString(value));
  });
  return names;
}

/** The loop names every layer it builds after the asked index, `vformat("Layer%d", index)` (:701-710). */
function buildLayersTo(names: Map<number, string>, index: number): void {
  if (index >= LAYER_FILL_CEILING) {
    if (!names.has(index)) names.set(index, `Layer${index}`);
    return;
  }
  for (let built = 0; built <= index; built++) {
    if (!names.has(built)) names.set(built, serialChildName(`Layer${index}`, new Set(names.values())));
  }
}

/** `set_name` refuses an empty name (node.cpp:1432), and a sibling's name takes a serial suffix. */
function rename(names: Map<number, string>, index: number, name: string): void {
  if (name === '') return;
  const siblings = new Set([...names].filter(([other]) => other !== index).map(([, sibling]) => sibling));
  names.set(index, serialChildName(validateNodeName(name), siblings));
}
