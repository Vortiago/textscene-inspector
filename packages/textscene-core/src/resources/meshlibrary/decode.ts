/**
 * The MeshLibrary slice's decode (ADR-0031): a MeshLibrary **ParsedResource**
 * in, the `MeshLibraryModel` out. One arrival: every MeshLibrary a GridMap
 * names is its own `.tres` file, so there is no scene-embedded adapter beside
 * this one.
 *
 * Lenient: silent on absent fields, warn-then-skip on malformed ones, never
 * throws. Mirrors the TileSet decode's contract.
 *
 * Item properties look like:
 *   item/7/name = "Floor"
 *   item/7/mesh = ExtResource("8_v1wcb")        // → an ArrayMesh .tres
 *   item/7/mesh = SubResource("ArrayMesh_x")    // → embedded in THIS .tres
 *   item/7/mesh_transform = Transform3D(1,0,0, 0,1,0, 0,0,1, 0,0,0)
 *   item/7/mesh_cast_shadow = 2                 // RS::ShadowCastingSetting ordinal
 */

import { warn } from '../../logger';
import type { ParsedResource } from '../../parser/parsedResource';
import { resolveRefToResourcePath, subResourceTypeGate } from '../subResourcePath';
import { parseTransform3D } from '../../utils/transform';
import { unquoteString } from '../../parser/utils';
import { ShadowCastingSetting, type MeshLibraryModel, type MeshLibraryItem } from './types';

const ITEM_KEY_RE = /^item\/(\d+)\/(name|mesh|mesh_transform|mesh_cast_shadow)$/;

/**
 * `mesh_cast_shadow` is serialised as the `RS::ShadowCastingSetting` ordinal.
 * Anything outside 0-3 lands on Godot's own default branch, which is ON
 * (`scene/resources/3d/mesh_library.cpp:65-67`).
 */
function decodeCastShadow(rawValue: string): ShadowCastingSetting {
  switch (parseInt(rawValue, 10)) {
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

/**
 * @param selfPath - the `res://` path the library was loaded from. An item mesh
 *   the library embeds as its own `[sub_resource]` can only be addressed
 *   relative to that file, so this is an input rather than a convenience.
 */
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
    const id = parseInt(match[1]!, 10);
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
 * A library written from a scene can embed a PRIMITIVE mesh (`BoxMesh`,
 * `CylinderMesh`, …) as its own `[sub_resource]`. Addressing one would hand the
 * ArrayMesh processor something with no `_surfaces`; leaving it unresolved is what
 * makes GridMap draw its placeholder cell rather than an empty instanced mesh that
 * looks like nothing is there.
 */
const ADDRESSABLE_ITEM_MESH_TYPES: ReadonlySet<string> = new Set(['ArrayMesh']);

