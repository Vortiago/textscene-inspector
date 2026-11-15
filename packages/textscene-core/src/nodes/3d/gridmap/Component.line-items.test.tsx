/**
 * <GridMap> items whose mesh is an ArrayMesh with a LINES surface: Godot draws it as `PRIMITIVE_LINES`,
 * one set of segments at each cell's place, beside the item's triangles.
 */
import { describe, expect, it } from 'vitest';
import { Matrix4, Vector3, type InstancedBufferGeometry, type LineSegments } from 'three';
import { wallQuadSurfaces } from '../../../resources/testing/arrayMeshSurfaces';
import { mountGridMap } from './testing/gridMapCorpus';
import { instanceMatrices } from '../../../r3f/meshes/sharedInstances';

const LINE_LIBRARY = `[gd_resource type="MeshLibrary" format=3]

[sub_resource type="ArrayMesh" id="Mesh_item"]
_surfaces = ${wallQuadSurfaces({ name: 'wire', primitive: 1 })}

[resource]
item/0/mesh = SubResource("Mesh_item")
`;

const MIXED_LIBRARY = LINE_LIBRARY.replace(
  wallQuadSurfaces({ name: 'wire', primitive: 1 }),
  wallQuadSurfaces({ name: 'wall' }, { name: 'wire', primitive: 1 })
);

/** Where each cell of `lines` puts the first vertex, in the world. */
function firstVertexPlaces(lines: LineSegments): number[][] {
  const geometry = lines.geometry as InstancedBufferGeometry;
  const position = geometry.getAttribute('position');
  return Array.from({ length: geometry.instanceCount }, (_, cell) => {
    const matrix = new Matrix4().fromArray(instanceMatrices(geometry).array, cell * 16);
    return lines.localToWorld(new Vector3().fromBufferAttribute(position, 0).applyMatrix4(matrix)).toArray();
  });
}

describe('<GridMap> item with a lines surface', () => {
  it('draws every cell as an instance of one LineSegments, never as the placeholder', async () => {
    const grid = await mountGridMap({ library: LINE_LIBRARY, cells: '0, 0, 0, 1, 0, 0' });
    const lines = grid.lines();

    expect(lines).toHaveLength(1);
    expect(grid.tiles()).toHaveLength(0);
    expect((lines[0]!.geometry as InstancedBufferGeometry).instanceCount).toBe(2);
  });

  it('puts each cell’s segments at the cell’s place', async () => {
    const [lines] = (await mountGridMap({ library: LINE_LIBRARY, cells: '0, 0, 0, 1, 0, 0' })).lines();
    const [first, second] = firstVertexPlaces(lines!);

    expect(second![0]! - first![0]!).toBeCloseTo(2);
  });

  it('batches the triangles and draws the lines at each cell, as Godot draws every surface', async () => {
    const grid = await mountGridMap({ library: MIXED_LIBRARY, cells: '0, 0, 0, 1, 0, 0' });

    expect([grid.tiles().length, grid.lines().length]).toEqual([1, 1]);
  });
});
