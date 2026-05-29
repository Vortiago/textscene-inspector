/**
 * WI-UX-7 regression: SceneInfoCard surfaces node count + root name
 * from `useHierarchy().sceneGraph`. Mirrors main's `#scene-info` block.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import type { SceneGraph } from '../../../core/SceneGraph';
import type { TscnNode } from '../../../parser/types';
import { SceneInfoCard } from './SceneInfoCard';

function makeNode(name: string, children: TscnNode[] = []): TscnNode {
  return { name, type: 'Node3D', properties: { name }, children };
}

function makeSceneGraph(rootName: string, flattenedCount: number): SceneGraph {
  const rootNode = makeNode(rootName);
  const path = 'res://test.tscn';
  const rootScene = {
    path,
    nodes: [rootNode],
    externalScenes: [],
    internalResources: [],
    externalResources: [],
  };
  return {
    rootScene: path,
    scenes: new Map([[path, rootScene]]),
    flattenedNodes: Array.from({ length: flattenedCount }, (_, i) => ({
      path: i === 0 ? rootName : `${rootName}/Child${i}`,
      name: i === 0 ? rootName : `Child${i}`,
      data: makeNode(i === 0 ? rootName : `Child${i}`),
      source: path,
      parent: i === 0 ? null : rootName,
    })),
    version: 1,
    timestamp: 0,
  };
}

describe('<SceneInfoCard>', () => {
  it('renders nothing when no scene is loaded', () => {
    const { container } = render(
      <HierarchyProvider value={{ sceneGraph: null, panelId: 'test' }}>
        <SceneInfoCard />
      </HierarchyProvider>
    );
    expect(container.querySelector('[data-testid="scene-info-card"]')).toBeNull();
  });

  it('renders Nodes count and Root name from sceneGraph', () => {
    const sceneGraph = makeSceneGraph('Foo', 3);
    render(
      <HierarchyProvider value={{ sceneGraph, panelId: 'test' }}>
        <SceneInfoCard />
      </HierarchyProvider>
    );

    const card = screen.getByTestId('scene-info-card');
    expect(card).toBeTruthy();
    expect(card.textContent).toMatch(/Nodes:\s*3/);
    expect(card.textContent).toMatch(/Root:\s*Foo/);
  });

  it('matches the verified example from MAIN-FEATURE-INVENTORY (ThreeCubes / 11 nodes)', () => {
    // From docs/MAIN-FEATURE-INVENTORY.md "Scene Info card" section.
    const sceneGraph = makeSceneGraph('ThreeCubes', 11);
    render(
      <HierarchyProvider value={{ sceneGraph, panelId: 'test' }}>
        <SceneInfoCard />
      </HierarchyProvider>
    );

    const nodesRow = screen.getByTestId('scene-info-nodes');
    const rootRow = screen.getByTestId('scene-info-root');
    expect(nodesRow.textContent).toBe('Nodes: 11');
    expect(rootRow.textContent).toBe('Root: ThreeCubes');
  });

  it('renders "None" as Root when the root scene has no nodes', () => {
    // Defensive — should not happen in practice (parser would not emit
    // an empty scene), but we want to avoid crashing if it does.
    const path = 'res://empty.tscn';
    const sceneGraph: SceneGraph = {
      rootScene: path,
      scenes: new Map([
        [
          path,
          {
            path,
            nodes: [],
            externalScenes: [],
            internalResources: [],
            externalResources: [],
          },
        ],
      ]),
      flattenedNodes: [],
      version: 1,
      timestamp: 0,
    };

    render(
      <HierarchyProvider value={{ sceneGraph, panelId: 'test' }}>
        <SceneInfoCard />
      </HierarchyProvider>
    );

    expect(screen.getByTestId('scene-info-root').textContent).toBe('Root: None');
    expect(screen.getByTestId('scene-info-nodes').textContent).toBe('Nodes: 0');
  });
});
