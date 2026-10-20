/**
 * <GridMap> rendering: nothing while a tile loads, and cell-sized wireframe boxes in one draw per
 * item when no MeshLibrary resolves.
 */
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../parser/types';
import { parseGridMap } from './parser';
import { GridMap } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../index';
import { instanceAs } from '../testing/reactThreeTestInstance';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import { loaderServing } from '../../../resources/testing/servingResourceLoader';
import { isInstancedMesh } from '../../../r3f/testing/threeNarrow';
import { renderGridMapTiles } from './testing/gridMapCorpus';

function gridMapNode(properties: Record<string, string>): TscnNode {
  return {
    rawProperties: {},
    name: 'MyGridMap',
    type: 'GridMap',
    children: [],
    properties: parseGridMap(
      { type: 'node', attributes: { type: 'GridMap', name: 'MyGridMap' } },
      properties
    ),
  };
}

/** The wireframe box draws <GridMap> falls back to when no MeshLibrary resolves. */
function placeholderDraws(renderer: Awaited<ReturnType<typeof render>>): THREE.InstancedMesh[] {
  return renderer.scene
    .findAllByType('Mesh')
    .map((m) => instanceAs<THREE.Mesh>(m))
    .filter(isInstancedMesh)
    .filter((m) => (m.material as THREE.MeshBasicMaterial)?.wireframe);
}

/** The centre of each wireframe box, in the order of its cells. */
function placeholderCentres(renderer: Awaited<ReturnType<typeof render>>): number[][] {
  return placeholderDraws(renderer).flatMap((batch) =>
    Array.from({ length: batch.count }, (_, i) => {
      const matrix = new THREE.Matrix4();
      batch.getMatrixAt(i, matrix);
      return new THREE.Vector3().setFromMatrixPosition(matrix).toArray();
    })
  );
}

function gridMapTree(loader: ResourceLoader, node: TscnNode, children?: ReactNode) {
  return (
    <ResourceLoaderProvider loader={loader}>
      <SceneResourcesProvider internalResources={[]} externalResources={[]}>
        <GridMap node={node}>{children}</GridMap>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

function render(node: TscnNode, children?: ReactNode) {
  return ReactThreeTestRenderer.create(gridMapTree(loaderServing(), node, children));
}

/** The sphere three culls `batch` by, computed only when missing, as three's frustum test does. */
function cullingSphere(batch: THREE.InstancedMesh): THREE.Sphere {
  if (!batch.boundingSphere) batch.computeBoundingSphere();
  return batch.boundingSphere!;
}

describe('<GridMap>', () => {
  it('renders a group and passes children through', async () => {
    const renderer = await render(
      gridMapNode({}),
      <mesh name="child">
        <boxGeometry />
        <meshBasicMaterial />
      </mesh>
    );
    expect(renderer.scene.findAllByType('Group').length).toBeGreaterThan(0);
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });

  it('falls back to a cell-sized wireframe box per decoded cell when no library resolves', async () => {
    // Two cells (items 0 and 0 at different positions); no mesh_library → boxes.
    const renderer = await render(gridMapNode({ data: '{"cells": PackedInt32Array(0, 0, 0, 1, 0, 0)}' }));
    expect(placeholderCentres(renderer)).toHaveLength(2);
  });

  it("draws every wireframe box of an item in one draw, as Godot draws an item's cells", async () => {
    const renderer = await render(gridMapNode({ data: '{"cells": PackedInt32Array(0, 0, 0, 1, 0, 0)}' }));
    expect(placeholderDraws(renderer)).toHaveLength(1);
  });

  it('culls a moved wireframe box by where it now sits', async () => {
    const loader = loaderServing();
    const renderer = await ReactThreeTestRenderer.create(
      gridMapTree(loader, gridMapNode({ data: '{"cells": PackedInt32Array(0, 0, 0)}' }))
    );
    const [batch] = placeholderDraws(renderer);
    cullingSphere(batch!);

    await renderer.update(
      gridMapTree(loader, gridMapNode({ data: '{"cells": PackedInt32Array(10, 0, 0)}' }))
    );

    expect(cullingSphere(batch!).containsPoint(new THREE.Vector3(21, 1, 1))).toBe(true);
  });

  it('draws nothing while the mesh library loads', async () => {
    expect(await renderGridMapTiles({ held: 'library', cells: '0, 0, 0, 1, 0, 0' })).toHaveLength(0);
  });

  it("draws nothing while an item's mesh loads", async () => {
    expect(await renderGridMapTiles({ held: 'tile', cells: '0, 0, 0, 1, 0, 0' })).toHaveLength(0);
  });

  it('offsets each cell by half a cell — Godot centers all three axes by default', async () => {
    // One cell at the grid origin. Godot's _get_offset() adds cell_size * 0.5
    // on every axis whose cell_center_* is on, and all three default to on, so
    // (0,0,0) renders at (1,1,1) with the default 2-unit cell.
    const renderer = await render(gridMapNode({ data: '{"cells": PackedInt32Array(0, 0, 0)}' }));

    expect(placeholderCentres(renderer)[0]).toEqual([1, 1, 1]);
  });

  it('drops the offset per axis when cell_center_* is off', async () => {
    const renderer = await render(
      gridMapNode({
        data: '{"cells": PackedInt32Array(0, 0, 0)}',
        cell_center_x: 'false',
        cell_center_z: 'false',
      })
    );

    // Only y stays centered.
    expect(placeholderCentres(renderer)[0]).toEqual([0, 1, 0]);
  });

  it('adds the offset on top of the cell stride, not instead of it', async () => {
    // Cell (1, 0, 0) with the default 2-unit cell: 1*2 + 1 = 3 on x.
    const renderer = await render(gridMapNode({ data: '{"cells": PackedInt32Array(1, 0, 0)}' }));

    expect(placeholderCentres(renderer)[0]).toEqual([3, 1, 1]);
  });

  it('renders nothing extra for an empty grid', async () => {
    const renderer = await render(gridMapNode({}));
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });
});
