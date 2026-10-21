/**
 * <GridMap> `cell_scale`: Godot scales each cell's basis by it, after the cell's place is set and
 * before the item's mesh transform (`modules/gridmap/grid_map.cpp:685-687,696`).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { renderInstancedTile } from './testing/gridMapCorpus';

/** The first instance's matrix, split into its position and scale. */
async function firstCell(gridMapProperties: Record<string, string>, itemLines = '') {
  const tile = await renderInstancedTile({ gridMapProperties, itemLines });
  const matrix = new THREE.Matrix4();
  tile.getMatrixAt(0, matrix);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  matrix.decompose(position, new THREE.Quaternion(), scale);
  return { position: position.toArray(), scale: scale.toArray() };
}

describe('<GridMap> cell_scale', () => {
  it('draws each item at its own size when cell_scale is unset', async () => {
    expect((await firstCell({})).scale).toEqual([1, 1, 1]);
  });

  it("scales each cell's mesh by cell_scale", async () => {
    expect((await firstCell({ cell_scale: '0.5' })).scale).toEqual([0.5, 0.5, 0.5]);
  });

  it('keeps each cell at its place in the grid', async () => {
    expect((await firstCell({ cell_scale: '3' })).position).toEqual([1, 1, 1]);
  });

  it("scales the item's mesh offset too, as the scale comes before the mesh transform", async () => {
    const meshTransform = 'item/0/mesh_transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)';
    expect((await firstCell({ cell_scale: '0.5' }, meshTransform)).position).toEqual([2, 1, 1]);
  });
});
