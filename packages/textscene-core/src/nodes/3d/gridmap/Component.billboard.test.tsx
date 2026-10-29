/**
 * A GridMap draws each item through a MultiMesh, whose shader billboards
 * `model_matrix * instance` (`scene_forward_clustered.glsl:338-342`,
 * `material.cpp:1260-1335`). So a billboarded surface stays one instanced draw, each tile turns
 * about its own cell, never about the GridMap origin, and keeps its scale only under keep_scale.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { castsFrom, drawsColour } from '../../../r3f/testing/threePasses';
import { patchedVertex } from '../../../r3f/testing/patchedFragment';
import { isInstancedMesh } from '../../../r3f/testing/threeNarrow';
import { drawnMaterials, renderGridMapTiles, renderInstancedTile } from './testing/gridMapCorpus';

/** Cells (0, 0, 0) and (3, 0, 0): centred at (1, 1, 1) and (7, 1, 1) at the default 2 m cell. */
const TWO_CELLS = '0, 0, 0, 3, 0, 0';
const BILLBOARD = 'billboard_mode = 1';
/** A plain first surface beside a billboarding second one, over two cells. */
const PLAIN_THEN_BILLBOARD = {
  materialLines: 'roughness = 0.5',
  secondMaterialLines: `${BILLBOARD}\nroughness = 0.25`,
  cells: TWO_CELLS,
};
const DOUBLED = 'item/0/mesh_transform = Transform3D(2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0)';
/** The line the instance billboard compiles, as `surfaceBillboard.instances.test.ts` pins it. */
const POSES_INSTANCES = '#define instanceMatrix godotInstanceLocal';
const KEEPS_SCALE = 'length( godotModel[ 0 ].xyz )';

const vertexOf = (tile: THREE.Mesh) => patchedVertex(drawnMaterials(tile)[0]!);

function instancePositions(tile: THREE.InstancedMesh): number[][] {
  const matrix = new THREE.Matrix4();
  return Array.from({ length: tile.count }, (_, i) => {
    tile.getMatrixAt(i, matrix);
    return new THREE.Vector3().setFromMatrixPosition(matrix).toArray();
  });
}

function instanceScale(tile: THREE.InstancedMesh): number[] {
  const matrix = new THREE.Matrix4();
  tile.getMatrixAt(0, matrix);
  return new THREE.Vector3().setFromMatrixScale(matrix).toArray();
}

describe('<GridMap> tile material billboard_mode', () => {
  it('draws every billboarded tile in one instanced draw', async () => {
    const tiles = await renderGridMapTiles({ materialLines: BILLBOARD, cells: TWO_CELLS });
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toBeInstanceOf(THREE.InstancedMesh);
  });

  it('compiles the instance billboard into the tile material', async () => {
    const tile = await renderInstancedTile({ materialLines: BILLBOARD, cells: TWO_CELLS });
    expect(vertexOf(tile)).toContain(POSES_INSTANCES);
  });

  it('places each instance at its own cell centre, which the billboard turns about', async () => {
    const tile = await renderInstancedTile({ materialLines: BILLBOARD, cells: TWO_CELLS });
    expect(instancePositions(tile)).toEqual([
      [1, 1, 1],
      [7, 1, 1],
    ]);
  });

  it('hands the billboard the mesh_transform scale', async () => {
    const tile = await renderInstancedTile({ materialLines: BILLBOARD, itemLines: DOUBLED });
    expect(instanceScale(tile)).toEqual([2, 2, 2]);
  });

  it('drops the tile’s scale by default', async () => {
    const tile = await renderInstancedTile({ materialLines: BILLBOARD, itemLines: DOUBLED });
    expect(vertexOf(tile)).not.toContain(KEEPS_SCALE);
  });

  it('keeps the tile’s scale under billboard_keep_scale', async () => {
    const tile = await renderInstancedTile({
      materialLines: `${BILLBOARD}\nbillboard_keep_scale = true`,
      itemLines: DOUBLED,
    });
    expect(vertexOf(tile)).toContain(KEEPS_SCALE);
  });

  it('casts from the billboarded tiles by default', async () => {
    const tile = await renderInstancedTile({ materialLines: BILLBOARD, cells: TWO_CELLS });
    expect(castsFrom(tile)).toBe(true);
  });

  it('applies the item’s mesh_cast_shadow to the billboarded tiles', async () => {
    const tile = await renderInstancedTile({
      materialLines: BILLBOARD,
      itemLines: 'item/0/mesh_cast_shadow = 3',
      cells: TWO_CELLS,
    });
    expect([castsFrom(tile), drawsColour(tile)]).toEqual([true, false]);
  });

  it('draws each surface in its own instanced draw', async () => {
    const tiles = await renderGridMapTiles(PLAIN_THEN_BILLBOARD);
    expect(tiles.every(isInstancedMesh)).toBe(true);
    expect(tiles.map((tile) => drawnMaterials(tile).map((m) => m.roughness))).toEqual([[0.5], [0.25]]);
  });

  it('billboards only the surface whose material asks', async () => {
    const tiles = await renderGridMapTiles(PLAIN_THEN_BILLBOARD);
    expect(tiles.map((tile) => vertexOf(tile).includes(POSES_INSTANCES))).toEqual([false, true]);
  });
});
