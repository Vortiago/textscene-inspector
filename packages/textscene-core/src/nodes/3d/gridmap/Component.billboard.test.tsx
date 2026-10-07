/**
 * A GridMap draws each item through a MultiMesh, whose shader billboards
 * `model_matrix * instance` (`scene_forward_clustered.glsl:338-342`,
 * `material.cpp:1260-1335`). So a billboarded tile turns about its own cell,
 * never about the GridMap origin, and keeps its scale only under keep_scale.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  castsFrom,
  drawColourGroup,
  drawsColour,
  expectSameRotation,
  TEST_CAMERA,
} from '../../../r3f/testing/threePasses';
import { drawnMaterials, isInstanced, renderGridMapTiles } from './testing/gridMapCorpus';

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

const drawnMatrix = (tile: THREE.Mesh) => drawColourGroup(tile, TEST_CAMERA, 0, (s) => s.matrixWorld);

/** The drawn per-axis scale, to five decimal places. */
function drawnScale(tile: THREE.Mesh): number[] {
  const scale = new THREE.Vector3().setFromMatrixScale(drawnMatrix(tile));
  return scale.toArray().map((v) => Number(v.toFixed(5)));
}

function drawnPositions(tiles: THREE.Mesh[]): number[][] {
  return tiles
    .map((tile) => new THREE.Vector3().setFromMatrixPosition(drawnMatrix(tile)).toArray())
    .sort((a, b) => a[0]! - b[0]!);
}

describe('<GridMap> tile material billboard_mode', () => {
  it('draws every tile facing the camera', async () => {
    const tiles = await renderGridMapTiles({ materialLines: BILLBOARD, cells: TWO_CELLS });
    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) expectSameRotation(drawnMatrix(tile), TEST_CAMERA.matrixWorld);
  });

  it('turns each tile about its own cell centre', async () => {
    const tiles = await renderGridMapTiles({ materialLines: BILLBOARD, cells: TWO_CELLS });
    expect(drawnPositions(tiles)).toEqual([
      [1, 1, 1],
      [7, 1, 1],
    ]);
  });

  it('drops the tile’s mesh_transform scale by default', async () => {
    const [tile] = await renderGridMapTiles({ materialLines: BILLBOARD, itemLines: DOUBLED });
    expect(drawnScale(tile!)).toEqual([1, 1, 1]);
  });

  it('keeps the tile’s mesh_transform scale under billboard_keep_scale', async () => {
    const [tile] = await renderGridMapTiles({
      materialLines: `${BILLBOARD}\nbillboard_keep_scale = true`,
      itemLines: DOUBLED,
    });
    expect(drawnScale(tile!)).toEqual([2, 2, 2]);
  });

  it('casts from every billboarded tile by default', async () => {
    const tiles = await renderGridMapTiles({ materialLines: BILLBOARD, cells: TWO_CELLS });
    expect(tiles.map((tile) => castsFrom(tile))).toEqual([true, true]);
  });

  it('applies the item’s mesh_cast_shadow to every billboarded tile', async () => {
    const tiles = await renderGridMapTiles({
      materialLines: BILLBOARD,
      itemLines: 'item/0/mesh_cast_shadow = 3',
      cells: TWO_CELLS,
    });
    expect(tiles.map((tile) => [castsFrom(tile), drawsColour(tile)])).toEqual([
      [true, false],
      [true, false],
    ]);
  });

  it('batches the surface that does not billboard and draws the billboarding one per cell', async () => {
    const tiles = await renderGridMapTiles(PLAIN_THEN_BILLBOARD);
    expect(tiles.filter(isInstanced)).toHaveLength(1);
    expect(tiles.filter((tile) => !isInstanced(tile))).toHaveLength(2);
  });

  it('turns the billboarding surface of each cell to face the camera', async () => {
    const cellTiles = (await renderGridMapTiles(PLAIN_THEN_BILLBOARD)).filter((tile) => !isInstanced(tile));
    for (const tile of cellTiles) {
      expectSameRotation(
        drawColourGroup(tile, TEST_CAMERA, 1, (s) => s.matrixWorld),
        TEST_CAMERA.matrixWorld
      );
    }
  });

  it('draws each surface in one draw only', async () => {
    const tiles = await renderGridMapTiles(PLAIN_THEN_BILLBOARD);
    const roughness = tiles.map((tile) => drawnMaterials(tile).map((m) => m.roughness));
    expect(roughness).toEqual([[0.5], [0.25], [0.25]]);
  });

  it('still batches a tile whose material does not billboard', async () => {
    const tiles = await renderGridMapTiles({ materialLines: 'roughness = 0.5', cells: TWO_CELLS });
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toBeInstanceOf(THREE.InstancedMesh);
  });
});
