/**
 * MeshLibrary resolver — turns a parsed MeshLibrary `.tres` into a
 * MeshLibraryModel. Lenient: silent on absent fields, warn-then-skip on
 * malformed ones, never throws. Mirrors the TileSet resolver's contract.
 *
 * Item properties look like:
 *   item/7/name = "Floor"
 *   item/7/mesh = ExtResource("8_v1wcb")        // → an ArrayMesh .tres
 *   item/7/mesh = SubResource("ArrayMesh_x")    // → embedded in THIS .tres
 *   item/7/mesh_transform = Transform3D(1,0,0, 0,1,0, 0,0,1, 0,0,0)
 */

import { warn } from '../../logger';
import type { ParsedTresFile } from '../../parser/tresParser';
import { findSubResource, parseResourceReference } from '../SubResourceResolver';
import { resolveRefToResourcePath } from '../subResourcePath';
import { parseTransform3D } from '../../utils/transform';
import { unquoteString } from '../../parser/utils';
import type { MeshLibraryModel, MeshLibraryItem } from './meshLibraryModel';

const ITEM_KEY_RE = /^item\/(\d+)\/(name|mesh|mesh_transform)$/;

/**
 * @param selfPath - the `res://` path the library was loaded from. An item mesh
 *   the library embeds as its own `[sub_resource]` can only be addressed
 *   relative to that file, so this is an input rather than a convenience.
 */
export function meshLibraryFromTres(
  tres: ParsedTresFile,
  selfPath: string
): MeshLibraryModel {
  const extPathById = new Map(tres.extResources.map((r) => [r.id, r.path]));
  const items: MeshLibraryModel = new Map();

  const ensure = (id: number): MeshLibraryItem => {
    let item = items.get(id);
    if (!item) {
      item = { id, meshPath: null, meshTransform: null };
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
      item.meshPath = resolveItemMeshPath(rawValue, tres, extPathById, selfPath);
    } else if (field === 'mesh_transform') {
      try {
        item.meshTransform = parseTransform3D(rawValue);
      } catch {
        warn(`[MeshLibrary] item/${id}/mesh_transform is malformed — using identity: ${rawValue}`);
      }
    }
  }

  return items;
}

/**
 * An item's mesh as one resource path, whichever form Godot wrote — but only when
 * the target is an ArrayMesh.
 *
 * A library written from a scene can embed a PRIMITIVE mesh (`BoxMesh`,
 * `CylinderMesh`, …) as its own `[sub_resource]`. Addressing one would hand the
 * ArrayMesh processor something with no `_surfaces`; null instead leaves the item
 * unresolved, which is what makes GridMap draw its placeholder cell rather than an
 * empty instanced mesh that looks like nothing is there.
 */
function resolveItemMeshPath(
  rawValue: string,
  tres: ParsedTresFile,
  extPathById: ReadonlyMap<string, string>,
  selfPath: string
): string | null {
  const ref = parseResourceReference(rawValue);
  if (ref?.type === 'SubResource') {
    const sub = findSubResource(tres.subResources, ref.id);
    if (sub?.type !== 'ArrayMesh') return null;
  }
  return resolveRefToResourcePath(rawValue, extPathById, selfPath);
}

