/**
 * The ground-plane grid toggle, off by default: a non-empty scene shows the grid
 * only when the user turns it on.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { TscnSceneContents } from './TscnCanvas';
import { HierarchyProvider } from './contexts/HierarchyContext';
import { SelectionProvider } from './contexts/SelectionContext';
import { ViewportModeProvider } from './contexts/ViewportModeContext';
import { createSceneGraphFromTscnScene } from '../core/SceneGraph';
import type { TscnNode } from '../parser/types';
import type { MeshInstance3DProperties } from '../nodes/3d/meshinstance3d/types';

import './nodes/index';

function makeMeshInstance(name: string): TscnNode {
  const props: MeshInstance3DProperties = { name, surfaceMaterialOverrides: new Map() };
  return { name, type: 'MeshInstance3D', children: [], properties: props };
}

function countGrids(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>): number {
  return renderer.scene.findAllByType('GridHelper').length;
}

describe('<TscnSceneContents> ground-plane grid toggle (#224)', () => {
  it('defaults to OFF for a non-empty scene (no ViewportModeProvider)', async () => {
    const graph = createSceneGraphFromTscnScene({ nodes: [makeMeshInstance('Cube')] });
    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <TscnSceneContents />
        </SelectionProvider>
      </HierarchyProvider>
    );
    expect(countGrids(renderer)).toBe(0);
  });

  it('defaults to OFF for a non-empty scene even WITH a ViewportModeProvider mounted', async () => {
    const graph = createSceneGraphFromTscnScene({ nodes: [makeMeshInstance('Cube')] });
    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <ViewportModeProvider>
            <TscnSceneContents />
          </ViewportModeProvider>
        </SelectionProvider>
      </HierarchyProvider>
    );
    expect(countGrids(renderer)).toBe(0);
  });

  it('shows the grid in a non-empty scene once toggled on', async () => {
    const graph = createSceneGraphFromTscnScene({ nodes: [makeMeshInstance('Cube')] });
    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <ViewportModeProvider initialShowGrid>
            <TscnSceneContents />
          </ViewportModeProvider>
        </SelectionProvider>
      </HierarchyProvider>
    );
    expect(countGrids(renderer)).toBe(1);
  });

  it('does not double up with the empty-scene indicator grid when both would apply', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ViewportModeProvider initialShowGrid>
        <TscnSceneContents />
      </ViewportModeProvider>
    );
    // Empty scene already shows its own grid regardless of the toggle;
    // the toggle must not add a second overlapping grid.
    expect(countGrids(renderer)).toBe(1);
  });

  it('tags the rendered grid so frameSceneBounds excludes it from auto-fit framing', async () => {
    // `traverse()` visits every descendant, so frameSceneBounds honours only a
    // tag on the grid itself. The `<gridHelper>` carries it in both the empty and
    // the content-grid case.
    const graph = createSceneGraphFromTscnScene({ nodes: [makeMeshInstance('Cube')] });
    const contentGridRenderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <ViewportModeProvider initialShowGrid>
            <TscnSceneContents />
          </ViewportModeProvider>
        </SelectionProvider>
      </HierarchyProvider>
    );
    const contentGrid = contentGridRenderer.scene.findByType('GridHelper');
    expect((contentGrid.instance as unknown as THREE.Object3D).userData.tscnEmptyState).toBe(true);

    const emptyStateRenderer = await ReactThreeTestRenderer.create(<TscnSceneContents />);
    const emptyStateGrid = emptyStateRenderer.scene.findByType('GridHelper');
    expect((emptyStateGrid.instance as unknown as THREE.Object3D).userData.tscnEmptyState).toBe(
      true
    );
  });
});
