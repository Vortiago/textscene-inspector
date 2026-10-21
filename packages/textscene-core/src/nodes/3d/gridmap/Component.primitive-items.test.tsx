/**
 * <GridMap> items whose mesh is a PrimitiveMesh: Godot stores `item/<id>/mesh` as any
 * `Ref<Mesh>` (`scene/resources/3d/mesh_library.cpp:48-49`) and draws whatever kind it is
 * (`modules/gridmap/grid_map.cpp:688-700`), so a BoxMesh tile draws its box, not the placeholder.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { renderGridMapTiles, renderInstancedTile } from './testing/gridMapCorpus';

/** A library whose item 0 is the inline sub-resource `meshBlock` declares as `Mesh_item`. */
function inlineMeshLibrary(meshBlock: string): string {
  return `[gd_resource type="MeshLibrary" format=3]

${meshBlock}

[resource]
item/0/name = "Tile"
item/0/mesh = SubResource("Mesh_item")
`;
}

/** The size of a tile's geometry box, rounded to the micrometre. */
function geometrySize(tile: THREE.InstancedMesh): number[] {
  tile.geometry.computeBoundingBox();
  const size = tile.geometry.boundingBox!.getSize(new THREE.Vector3());
  return size.toArray().map((v) => Math.round(v * 1e6) / 1e6);
}

describe('<GridMap> item with an inline PrimitiveMesh', () => {
  it('draws the BoxMesh at its own size, not the wireframe placeholder', async () => {
    const tile = await renderInstancedTile({
      library: inlineMeshLibrary('[sub_resource type="BoxMesh" id="Mesh_item"]\nsize = Vector3(2, 0.5, 1)'),
    });
    expect((tile.material as THREE.MeshBasicMaterial).wireframe).toBeFalsy();
    expect(geometrySize(tile)).toEqual([2, 0.5, 1]);
  });

  it('draws the material the BoxMesh names', async () => {
    const tile = await renderInstancedTile({
      library: inlineMeshLibrary(`[sub_resource type="StandardMaterial3D" id="Red"]
albedo_color = Color(1, 0, 0, 1)

[sub_resource type="BoxMesh" id="Mesh_item"]
material = SubResource("Red")`),
    });
    expect((tile.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xff0000);
  });
});

describe('<GridMap> item whose mesh is a PrimitiveMesh .tres', () => {
  it('draws the BoxMesh the file holds', async () => {
    const tile = await renderInstancedTile({
      library: `[gd_resource type="MeshLibrary" format=3]

[ext_resource type="BoxMesh" path="res://stage/meshes/box.tres" id="1_box"]

[resource]
item/0/mesh = ExtResource("1_box")
`,
      files: {
        'res://stage/meshes/box.tres':
          '[gd_resource type="BoxMesh" format=3]\n\n[resource]\nsize = Vector3(0.5, 3, 0.25)\n',
      },
    });
    expect(geometrySize(tile)).toEqual([0.5, 3, 0.25]);
  });
});

describe('<GridMap> item with an inline PrimitiveMesh Godot builds no surface for', () => {
  it('draws nothing, neither the mesh nor the placeholder', async () => {
    // Equal radii: Godot refuses to build the torus (`primitive_meshes.cpp:2232`).
    const tiles = await renderGridMapTiles({
      library: inlineMeshLibrary(
        '[sub_resource type="TorusMesh" id="Mesh_item"]\ninner_radius = 1.0\nouter_radius = 1.0'
      ),
    });
    expect(tiles).toEqual([]);
  });
});
