/**
 * MeshLibrary resolver — parses item/N/mesh, name, and mesh_transform out of a
 * MeshLibrary .tres into the normalized model, resolving mesh ExtResource ids
 * to res:// paths against the file's own ext_resources.
 */
import { describe, it, expect } from 'vitest';
import { parseTresFile } from '../../parser/parsedResource';
import { meshLibraryFromTres } from './decode';

const TILES_TRES = `[gd_resource type="MeshLibrary" format=3 uid="uid://tiles"]

[ext_resource type="ArrayMesh" path="res://stage/meshes/floor.tres" id="8_floor"]
[ext_resource type="ArrayMesh" path="res://stage/meshes/wall.tres" id="9_wall"]

[resource]
item/7/name = "Floor"
item/7/mesh = ExtResource("8_floor")
item/7/mesh_transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
item/8/name = "Wall"
item/8/mesh = ExtResource("9_wall")
`;

describe('meshLibraryFromTres', () => {
  it('resolves item ids to names, mesh paths, and transforms', () => {
    const model = meshLibraryFromTres(parseTresFile(TILES_TRES), 'res://stage/tiles.tres');

    expect(model.size).toBe(2);
    const floor = model.get(7)!;
    expect(floor.name).toBe('Floor');
    expect(floor.meshPath).toBe('res://stage/meshes/floor.tres');
    expect(floor.meshTransform?.origin).toEqual({ x: 0, y: 0, z: 0 });

    const wall = model.get(8)!;
    expect(wall.name).toBe('Wall');
    expect(wall.meshPath).toBe('res://stage/meshes/wall.tres');
    expect(wall.meshTransform).toBeNull(); // no mesh_transform line
  });

  // `MeshLibrary::_set` reads the index with a bare
  // `prop_name.get_slicec('/', 1).to_int()` and no validity gate
  // (mesh_library.cpp:40), and `to_int` SKIPS a character it cannot use
  // (ustring.cpp:2280-2293), so `+7` is item 7 and `x` is item 0. A negative one
  // dies in `create_item`'s `ERR_FAIL_COND(p_item < 0)` (:159) and the
  // `set_item_*` that follows finds no item.
  it('resolves an item index the way to_int does', () => {
    const model = meshLibraryFromTres(
      parseTresFile(`[gd_resource type="MeshLibrary" format=3]

[resource]
item/+7/name = "Floor"
item/x/name = "Zero"
item/-1/name = "Dropped"
`),
      'res://stage/tiles.tres'
    );

    expect([...model.keys()].sort((a, b) => a - b)).toEqual([0, 7]);
    expect(model.get(7)!.name).toBe('Floor');
    expect(model.get(0)!.name).toBe('Zero');
  });

  it('returns an empty model for a library with no items', () => {
    const model = meshLibraryFromTres(
      parseTresFile('[gd_resource type="MeshLibrary" format=3]\n\n[resource]\n'),
      'res://stage/empty.tres'
    );
    expect(model.size).toBe(0);
  });

  it('addresses an item mesh embedded in the library as a sub-resource path', () => {
    // Godot writes this form when the MeshLibrary carries its own item meshes
    // rather than referencing shared `.tres` files. `meshPath` stays one string,
    // so GridMap's `useResource(meshPath, 'ArrayMesh')` needs no change.
    const embedded = `[gd_resource type="MeshLibrary" format=3]

[sub_resource type="ArrayMesh" id="ArrayMesh_floor"]
_surfaces = []

[resource]
item/0/name = "Floor"
item/0/mesh = SubResource("ArrayMesh_floor")
`;
    const model = meshLibraryFromTres(parseTresFile(embedded), 'res://stage/tiles.tres');

    expect(model.get(0)!.meshPath).toBe('res://stage/tiles.tres::ArrayMesh_floor');
  });
});
