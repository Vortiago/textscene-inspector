/**
 * <GridMap> rendering: a mesh per decoded cell, or cell-sized wireframe boxes
 * when no MeshLibrary resolves.
 */
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../parser/types';
import { parseGridMap } from './parser';
import { GridMap } from './Component';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider, ResourceLoader, FileEventBus } from '../../../index';
import type { ResourceProvider } from '../../../resources/ResourceProvider';
import { instanceAs } from '../testing/reactThreeTestInstance';

class NoopProvider implements ResourceProvider {
  async loadResource(): Promise<string | ArrayBuffer | null> {
    return null;
  }
}

function makeLoader(): ResourceLoader {
  const provider = new NoopProvider();
  const loader = new ResourceLoader(new FileEventBus(provider));
  loader.setProvider(provider);
  return loader;
}

function gridMapNode(properties: Record<string, string>): TscnNode {
  return {
    name: 'MyGridMap',
    type: 'GridMap',
    children: [],
    properties: parseGridMap({ type: 'node', attributes: { type: 'GridMap', name: 'MyGridMap' } }, properties),
  };
}

/** The wireframe boxes <GridMap> falls back to when no MeshLibrary resolves. */
function placeholderCells(renderer: Awaited<ReturnType<typeof render>>) {
  return renderer.scene
    .findAllByType('Mesh')
    .filter((m) => (instanceAs<THREE.Mesh>(m).material as THREE.MeshBasicMaterial)?.wireframe);
}

function render(node: TscnNode, children?: ReactNode) {
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={makeLoader()}>
      <SceneResourcesProvider internalResources={[]} externalResources={[]}>
        <GridMap node={node}>{children}</GridMap>
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
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
    const renderer = await render(
      gridMapNode({ data: '{"cells": PackedInt32Array(0, 0, 0, 1, 0, 0)}' })
    );
    expect(placeholderCells(renderer)).toHaveLength(2);
  });

  it('offsets each cell by half a cell — Godot centers all three axes by default', async () => {
    // One cell at the grid origin. Godot's _get_offset() adds cell_size * 0.5
    // on every axis whose cell_center_* is on, and all three default to on, so
    // (0,0,0) renders at (1,1,1) with the default 2-unit cell.
    const renderer = await render(
      gridMapNode({ data: '{"cells": PackedInt32Array(0, 0, 0)}' })
    );

    expect(placeholderCells(renderer)[0]!.instance.position.toArray()).toEqual([1, 1, 1]);
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
    expect(placeholderCells(renderer)[0]!.instance.position.toArray()).toEqual([0, 1, 0]);
  });

  it('adds the offset on top of the cell stride, not instead of it', async () => {
    // Cell (1, 0, 0) with the default 2-unit cell: 1*2 + 1 = 3 on x.
    const renderer = await render(
      gridMapNode({ data: '{"cells": PackedInt32Array(1, 0, 0)}' })
    );

    expect(placeholderCells(renderer)[0]!.instance.position.toArray()).toEqual([3, 1, 1]);
  });

  it('renders nothing extra for an empty grid', async () => {
    const renderer = await render(gridMapNode({}));
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });
});
