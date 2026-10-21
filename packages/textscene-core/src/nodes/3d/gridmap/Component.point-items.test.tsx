/**
 * <GridMap> items whose mesh is a PointMesh: Godot draws it as `PRIMITIVE_POINTS`
 * (`primitive_meshes.cpp:2388`), one point at each cell's place, never as the placeholder.
 */
import { describe, expect, it } from 'vitest';
import { Vector3, type Material, type Points } from 'three';
import { ORTHO_BASES } from './cellData';
import { wallQuadSurfaces } from '../../../resources/testing/arrayMeshSurfaces';
import { mountGridMap } from './testing/gridMapCorpus';

const POINT_LIBRARY = `[gd_resource type="MeshLibrary" format=3]

[sub_resource type="PointMesh" id="Mesh_item"]

[resource]
item/0/name = "Dot"
item/0/mesh = SubResource("Mesh_item")
`;

/** The one Points an item mounts for all its cells. */
async function onlyPoints(cells: string): Promise<Points> {
  const points = (await mountGridMap({ library: POINT_LIBRARY, cells })).points();
  expect(points).toHaveLength(1);
  return points[0]!;
}

/** Where each vertex of `points` sits in the world. */
function vertexPlaces(points: Points): number[][] {
  const position = points.geometry.getAttribute('position');
  return Array.from({ length: position.count }, (_, i) =>
    points.localToWorld(new Vector3().fromBufferAttribute(position, i)).toArray()
  );
}

describe('<GridMap> item with an inline PointMesh', () => {
  it('draws one point at the centre of each cell', async () => {
    // Cell (0, 0, 0) of the default 2-unit, centred grid sits at (1, 1, 1).
    expect(vertexPlaces(await onlyPoints('0, 0, 0'))).toEqual([[1, 1, 1]]);
  });

  it('draws every cell in one Points, each point at its own place', async () => {
    expect(vertexPlaces(await onlyPoints('0, 0, 0, 1, 0, 0'))).toEqual([
      [1, 1, 1],
      [3, 1, 1],
    ]);
  });

  it("turns each point's +Z normal with its cell's basis", async () => {
    // The second cell, at x = 1, holds orientation 10, which `ORTHO_BASES` gives as a half turn about Y.
    const points = await onlyPoints(`0, 0, 0, 1, 0, ${10 << 16}`);
    const normal = points.geometry.getAttribute('normal');
    const basis = ORTHO_BASES[10]!;
    const normals = [0, 1].map((i) => new Vector3().fromBufferAttribute(normal, i).toArray());

    expect(normals).toEqual([
      [0, 0, 1],
      [basis[2], basis[5], basis[8]],
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
    const sizes = grid.points().map((points) => (points.material as Material).userData.godotPointSize);
    expect(sizes).toEqual([16]);
  });
});

describe('<GridMap> item with an ArrayMesh of triangle and points surfaces', () => {
  const MIXED_LIBRARY = `[gd_resource type="MeshLibrary" format=3]

[sub_resource type="ArrayMesh" id="Mesh_item"]
_surfaces = ${wallQuadSurfaces({ name: 'wall' }, { name: 'dots', primitive: 0 })}

[resource]
item/0/mesh = SubResource("Mesh_item")
`;

  it('batches the triangles and draws the points at each cell, as Godot draws every surface', async () => {
    const grid = await mountGridMap({ library: MIXED_LIBRARY, cells: '0, 0, 0, 1, 0, 0' });

    const [points, ...others] = grid.points();

    expect(grid.tiles()).toHaveLength(1);
    expect(others).toEqual([]);
    // The four corners of the wall quad, once for each of the two cells.
    expect(points!.geometry.getAttribute('position').count).toBe(8);
  });
});
