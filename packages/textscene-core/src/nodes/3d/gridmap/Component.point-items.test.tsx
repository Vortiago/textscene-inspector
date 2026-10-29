/**
 * <GridMap> items whose mesh is a PointMesh: Godot draws it as `PRIMITIVE_POINTS`
 * (`primitive_meshes.cpp:2388`), one point at each cell's place, never as the placeholder.
 */
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import {
  Matrix3,
  Matrix4,
  Raycaster,
  Vector3,
  type InstancedBufferGeometry,
  type Material,
  type Points,
} from 'three';
import { ORTHO_BASES } from './cellData';
import { wallQuadSurfaces } from '../../../resources/testing/arrayMeshSurfaces';
import { mountGridMap } from './testing/gridMapCorpus';
import { instanceMatrices } from '../../../r3f/meshes/sharedInstances';

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

/** Each instance's matrix of `points`. */
function cellMatrices(points: Points): Matrix4[] {
  const geometry = points.geometry as InstancedBufferGeometry;
  return Array.from({ length: geometry.instanceCount }, (_, cell) =>
    new Matrix4().fromArray(instanceMatrices(geometry).array, cell * 16)
  );
}

/** Where each vertex of `points` sits in the world, at each cell in turn. */
function vertexPlaces(points: Points): number[][] {
  const position = points.geometry.getAttribute('position');
  return cellMatrices(points).flatMap((cell) =>
    Array.from({ length: position.count }, (_, i) =>
      points.localToWorld(new Vector3().fromBufferAttribute(position, i).applyMatrix4(cell)).toArray()
    )
  );
}

describe('<GridMap> item with an inline PointMesh', () => {
  it('draws one point at the centre of each cell', async () => {
    // Cell (0, 0, 0) of the default 2-unit, centred grid sits at (1, 1, 1).
    expect(vertexPlaces(await onlyPoints('0, 0, 0'))).toEqual([[1, 1, 1]]);
  });

  it('draws every cell as an instance of one Points, each point at its own place', async () => {
    expect(vertexPlaces(await onlyPoints('0, 0, 0, 1, 0, 0'))).toEqual([
      [1, 1, 1],
      [3, 1, 1],
    ]);
  });

  it("turns each point's +Z normal with its cell's basis", async () => {
    // The second cell, at x = 1, holds orientation 10, which `ORTHO_BASES` gives as a half turn about Y.
    const points = await onlyPoints(`0, 0, 0, 1, 0, ${10 << 16}`);
    const normal = new Vector3().fromBufferAttribute(points.geometry.getAttribute('normal'), 0);
    const basis = ORTHO_BASES[10]!;
    const normals = cellMatrices(points).map((cell) =>
      normal.clone().applyMatrix3(new Matrix3().getNormalMatrix(cell)).toArray()
    );

    expect(normals).toEqual([
      [0, 0, 1],
      [basis[2], basis[5], basis[8]],
    ]);
  });

  it('frames and culls by the box of every cell', async () => {
    const { boundingBox } = (await onlyPoints('0, 0, 0, 1, 0, 0')) as Points & {
      boundingBox: { min: Vector3; max: Vector3 };
    };
    expect([boundingBox.min.toArray(), boundingBox.max.toArray()]).toEqual([
      [1, 1, 1],
      [3, 1, 1],
    ]);
  });

  it("picks the point at the second cell, as each instance's points are its own", async () => {
    const points = await onlyPoints('0, 0, 0, 1, 0, 0');
    const raycaster = new Raycaster(new Vector3(3, 1, 10), new Vector3(0, 0, -1));
    raycaster.params.Points.threshold = 0.1;
    const hits = raycaster.intersectObject(points);
    expect(hits.map(({ instanceId, object }) => [instanceId, object === points])).toEqual([[1, true]]);
  });

  it('draws no triangle mesh and no placeholder box', async () => {
    const grid = await mountGridMap({ library: POINT_LIBRARY });
    expect(grid.tiles()).toEqual([]);
  });

  it("keeps the item's points through a remount, as StrictMode runs one", async () => {
    const [points] = (await mountGridMap({ library: POINT_LIBRARY, wrapper: StrictMode })).points();
    expect(points!.geometry.getAttribute('position')?.count).toBe(1);
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
    // The four corners of the wall quad, drawn at each of the two cells.
    expect(vertexPlaces(points!)).toHaveLength(8);
  });
});

describe('<GridMap> item with a PointMesh under triplanar mapping', () => {
  const triplanarLibrary = (mapping: string) => `[gd_resource type="MeshLibrary" format=3]

[sub_resource type="StandardMaterial3D" id="Projected"]
${mapping}

[sub_resource type="PointMesh" id="Mesh_item"]
material = SubResource("Projected")

[resource]
item/0/mesh = SubResource("Mesh_item")
`;

  it("instances every cell under local triplanar, so each point reads its cell's instance matrix", async () => {
    const grid = await mountGridMap({
      library: triplanarLibrary('uv1_triplanar = true'),
      cells: '0, 0, 0, 1, 0, 0',
    });
    const [points, ...others] = grid.points();

    expect(others).toEqual([]);
    expect((points!.material as Material).userData.godotPointsAtInstances).toBe(true);
  });

  it('instances every cell under a billboard too, which turns each about its cell', async () => {
    const grid = await mountGridMap({
      library: triplanarLibrary('billboard_mode = 1'),
      cells: '0, 0, 0, 1, 0, 0',
    });

    expect(grid.points()).toHaveLength(1);
  });

  it('instances every cell under world triplanar too', async () => {
    const grid = await mountGridMap({
      library: triplanarLibrary('uv1_triplanar = true\nuv1_world_triplanar = true'),
      cells: '0, 0, 0, 1, 0, 0',
    });

    expect(grid.points()).toHaveLength(1);
  });
});
