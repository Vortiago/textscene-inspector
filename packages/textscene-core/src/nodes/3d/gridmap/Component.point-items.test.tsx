/**
 * <GridMap> items whose mesh is a PointMesh: Godot draws it as `PRIMITIVE_POINTS`
 * (`primitive_meshes.cpp:2388`), one point at each cell's place, never as the placeholder.
 */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { mountGridMap } from './testing/gridMapCorpus';

const POINT_LIBRARY = `[gd_resource type="MeshLibrary" format=3]

[sub_resource type="PointMesh" id="Mesh_item"]

[resource]
item/0/name = "Dot"
item/0/mesh = SubResource("Mesh_item")
`;

/** Where each point sits in the world. */
async function pointPlaces(cells: string): Promise<number[][]> {
  const grid = await mountGridMap({ library: POINT_LIBRARY, cells });
  return grid.points().map((points) => points.localToWorld(points.position.clone().set(0, 0, 0)).toArray());
}

describe('<GridMap> item with an inline PointMesh', () => {
  it('draws one point at the centre of each cell', async () => {
    // Cell (0, 0, 0) of the default 2-unit, centred grid sits at (1, 1, 1).
    expect(await pointPlaces('0, 0, 0')).toEqual([[1, 1, 1]]);
  });

  it('draws a point per cell, each at its own place', async () => {
    expect(await pointPlaces('0, 0, 0, 1, 0, 0')).toEqual([
      [1, 1, 1],
      [3, 1, 1],
    ]);
  });

  it('draws no triangle mesh and no placeholder box', async () => {
    const grid = await mountGridMap({ library: POINT_LIBRARY });
    expect(grid.tiles()).toEqual([]);
  });
});

describe('<GridMap> item with a PointMesh that names a material', () => {
  it("sizes each point by the material's point_size", async () => {
    const grid = await mountGridMap({
      library: `[gd_resource type="MeshLibrary" format=3]

[sub_resource type="StandardMaterial3D" id="Big"]
use_point_size = true
point_size = 16.0

[sub_resource type="PointMesh" id="Mesh_item"]
material = SubResource("Big")

[resource]
item/0/mesh = SubResource("Mesh_item")
`,
    });
    const sizes = grid.points().map((points) => (points.material as THREE.Material).userData.godotPointSize);
    expect(sizes).toEqual([16]);
  });
});
