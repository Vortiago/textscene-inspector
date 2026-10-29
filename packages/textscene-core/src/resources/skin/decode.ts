/**
 * Skin decode: `bind_count` and `bind/<i>/{bone,name,pose}` as `Skin::_set` reads them
 * (`scene/resources/3d/skin.cpp:88-110`).
 */

import { warn } from '../../logger';
import { declaredLeafResolver, indexedElements } from '../../godot/classdb/indexedKey.js';
import { identityTransform3D } from '../../godot/math/transform3d.js';
import { slotInt } from '../../godot/variant/intSlots.js';
import { unquoteStringName } from '../../parser/utils';
import { parseTransform3D } from '../../utils/transform';
import type { SkinBind } from './types';

/**
 * `_set` reads the index with a bare `get_slicec('/', 1).to_int()` and the leaf with
 * `get_slicec('/', 2)` (`skin.cpp:94-95`), so a tail below the leaf is ignored: `bind/0/bone/extra`
 * sets the bone of bind 0.
 */
const BIND_LEAF = declaredLeafResolver(['bone', 'name', 'pose']);

/**
 * `properties` is the bag of a sub-resource or of the `[resource]` body of a `.tres`. A bind at or
 * past `bind_count` is dropped, as `set_bind_*` fail `ERR_FAIL_INDEX` (`skin.cpp:56`, `:66`, `:72`)
 * and a negative `bind_count` leaves no binds (`:34`).
 */
export function decodeSkin(properties: Record<string, string>): SkinBind[] {
  const count = Math.max(slotInt(properties.bind_count, 0) ?? 0, 0);
  const written = indexedElements(properties, 'bind/', 'to_int', BIND_LEAF);
  return Array.from({ length: count }, (_unused, index) => bindOf(written.get(index)));
}

/** A bind as `set_bind_count` makes it (`skin.h:38-42`), with the leaves the file wrote over it. */
function bindOf(leaves: ReadonlyMap<string, string> | undefined): SkinBind {
  const name = leaves?.get('name');
  return {
    bone: slotInt(leaves?.get('bone'), -1) ?? -1,
    name: name === undefined ? '' : unquoteStringName(name),
    pose: poseOf(leaves?.get('pose')),
  };
}

function poseOf(raw: string | undefined): SkinBind['pose'] {
  if (raw === undefined) return identityTransform3D();
  try {
    return parseTransform3D(raw);
  } catch {
    warn(`[Skin] bind pose is malformed, using the identity: ${raw}`);
    return identityTransform3D();
  }
}
