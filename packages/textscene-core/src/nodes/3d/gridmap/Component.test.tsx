/**
 * <GridMap> rendering. The component decodes the cell stream and places a mesh
 * per cell; with no resolvable MeshLibrary it falls back to cell-sized
 * wireframe boxes so the grid structure is still visible. Wrapped in the
 * resource + scene-resource providers the component depends on.
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
    const wireframes = renderer.scene
      .findAllByType('Mesh')
      .filter((m) => (m.instance.material as THREE.MeshBasicMaterial)?.wireframe);
    expect(wireframes).toHaveLength(2);
  });

  it('renders nothing extra for an empty grid', async () => {
    const renderer = await render(gridMapNode({}));
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });
});
