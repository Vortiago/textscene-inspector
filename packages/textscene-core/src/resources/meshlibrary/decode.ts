/**
 * MeshLibrary decode (ADR-0031): a **ParsedResource** in, `MeshLibraryModel` out,
 * from `item/<n>/name`, `mesh` (an ExtResource, or a SubResource in this `.tres`),
 * `mesh_transform` and `mesh_cast_shadow`. Every library is its own `.tres`. Like
 * the TileSet decode: silent on absent fields, warn-then-skip on malformed, no throw.
 */

import { warn } from '../../logger';
import { indexedKeyRegex, parseGodotInt, toIntIndex } from '../../godot/index.js';
import type { ParsedResource } from '../../parser/parsedResource';
import { resolveRefToResourcePath, subResourceTypeGate } from '../subResourcePath';
import { parseTransform3D } from '../../utils/transform';
import { unquoteString } from '../../parser/utils';
import { ShadowCastingSetting, type MeshLibraryModel, type MeshLibraryItem } from './types';

/**
 * `MeshLibrary::_set` reads fixed slices with no validity gate, `get_slicec('/', 1)`
 * for the index and `get_slicec('/', 2)` for the leaf (mesh_library.cpp:40-41). So
 * {@link toIntIndex} decides the number (`+7` is 7, `x` is 0), and anything below the
 * leaf is ignored (ustring.cpp:941-964): `item/7/name/extra` sets item 7's name.
 */
const ITEM_KEY_RE = indexedKeyRegex('^item/(#)/([^/]+)', 'to_int');

/**
 * @param selfPath - the `res://` path the library was loaded from. An item mesh
 *   the library embeds as its own `[sub_resource]` can only be addressed
 *   relative to that file, so this is an input rather than a convenience.
 */
/**
 * `mesh_cast_shadow` is serialised as the `RS::ShadowCastingSetting` ordinal.
 * Anything outside 0-3 lands on Godot's own default branch, which is ON
 * (`scene/resources/3d/mesh_library.cpp:65-67`).
 */
function decodeCastShadow(rawValue: string): ShadowCastingSetting {
  // `parseGodotInt`, not `parseInt`: Godot converts a FLOAT spelling into an int
  // slot (`variant.cpp`), so `cast_shadow = 2.0` is DOUBLE_SIDED, and a raw
  // `parseInt` would read `2` out of text the engine refuses outright.
  switch (parseGodotInt(rawValue)) {
    case 0:
      return ShadowCastingSetting.OFF;
    case 2:
      return ShadowCastingSetting.DOUBLE_SIDED;
    case 3:
      return ShadowCastingSetting.SHADOWS_ONLY;
    default:
      return ShadowCastingSetting.ON;
  }
}

export function meshLibraryFromTres(
  tres: ParsedResource,
  selfPath: string
): MeshLibraryModel {
  const extPathById = new Map(tres.extResources.map((r) => [r.id, r.path]));
  const items: MeshLibraryModel = new Map();

  const ensure = (id: number): MeshLibraryItem => {
    let item = items.get(id);
    if (!item) {
      // Absent = ON (`scene/resources/3d/mesh_library.h:58`).
      item = { id, meshPath: null, meshTransform: null, castShadow: ShadowCastingSetting.ON };
      items.set(id, item);
    }
    return item;
  };

  for (const [key, rawValue] of Object.entries(tres.properties)) {
    const match = ITEM_KEY_RE.exec(key);
    if (!match) continue;
    const id = toIntIndex(match[1]!);
    // `create_item`'s `ERR_FAIL_COND(p_item < 0)` (mesh_library.cpp:159) leaves
    // no item for the `set_item_*` that follows, so a negative index writes
    // nothing.
    if (!(id >= 0)) continue;
    const field = match[2]!;
    const item = ensure(id);

    if (field === 'name') {
      item.name = unquoteString(rawValue);
    } else if (field === 'mesh') {
      item.meshPath = resolveRefToResourcePath(
        rawValue,
        extPathById,
        selfPath,
        subResourceTypeGate(tres.subResources, ADDRESSABLE_ITEM_MESH_TYPES)
      );
    } else if (field === 'mesh_transform') {
      try {
        item.meshTransform = parseTransform3D(rawValue);
      } catch {
        warn(`[MeshLibrary] item/${id}/mesh_transform is malformed — using identity: ${rawValue}`);
      }
    } else if (field === 'mesh_cast_shadow') {
      item.castShadow = decodeCastShadow(rawValue);
    }
  }

  return items;
}

/**
 * A library written from a scene can embed a primitive mesh (`BoxMesh`, …) as a
 * `[sub_resource]`, which has no `_surfaces` for the ArrayMesh processor. Left
 * unresolved, GridMap draws its placeholder cell rather than an empty mesh.
 */
const ADDRESSABLE_ITEM_MESH_TYPES: ReadonlySet<string> = new Set(['ArrayMesh']);

