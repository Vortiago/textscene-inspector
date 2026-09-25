/**
 * A selected path puts a `BoxHelper` in the canvas scene around the Object3D
 * the dispatcher registered for it. The tests mount `TscnSceneContents` with
 * a SelectionProvider and a HierarchyProvider.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../parser/types';
import { TscnSceneContents } from '../TscnCanvas';
import { HierarchyProvider } from '../contexts/HierarchyContext';
import { SelectionProvider } from '../contexts/SelectionContext';
import { createSceneGraphFromTscnScene } from '../../core/SceneGraph';
import type { MeshInstance3DProperties } from '../../nodes/3d/meshinstance3d/types';
import { SelectSeeder } from '../testing/SelectSeeder';

import '../nodes/index';

function makeNode(name: string, type: string, children: TscnNode[] = []): TscnNode {
  return { name, type, children, properties: {} };
}

function makeMeshInstance(name: string, mesh?: string): TscnNode {
  const props: MeshInstance3DProperties = {
    name,
    surfaceMaterialOverrides: new Map(),
    ...(mesh ? { mesh } : {}),
  };
  return { name, type: 'MeshInstance3D', children: [], properties: props };
}

function findBoxHelper(scene: THREE.Scene): THREE.BoxHelper | null {
  let found: THREE.BoxHelper | null = null;
  scene.traverse((o) => {
    if (found) return;
    if (o instanceof THREE.BoxHelper) found = o;
  });
  return found;
}

describe('<SelectionHighlight> (WI-UX-2)', () => {
  it('mounts no BoxHelper when nothing is selected', async () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeMeshInstance('Cube')],
    });

    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <TscnSceneContents />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    const helper = findBoxHelper(renderer.scene.instance as unknown as THREE.Scene);
    expect(helper).toBeNull();
  });

  it('attaches a BoxHelper to the scene when a node is selected', async () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeMeshInstance('Cube')],
    });

    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <SelectSeeder path="Cube" />
          <TscnSceneContents />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    const helper = findBoxHelper(renderer.scene.instance as unknown as THREE.Scene);
    expect(helper).not.toBeNull();
    const lineMaterial = (helper as unknown as { material: THREE.LineBasicMaterial }).material;
    expect(lineMaterial.color.getHex()).toBe(0x00ff00);
  });

  it('switches the highlight target when the selected path changes', async () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [
        makeNode('Root', 'Node3D', [
          makeMeshInstance('Alpha'),
          makeMeshInstance('Beta'),
        ]),
      ],
    });

    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <SelectSeeder path="Root/Alpha" />
          <TscnSceneContents />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    const scene = renderer.scene.instance as unknown as THREE.Scene;
    const helperA = findBoxHelper(scene);
    expect(helperA).not.toBeNull();
    const targetA = (helperA as unknown as { object: THREE.Object3D }).object;
    expect(targetA).toBeDefined();

    await renderer.update(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <SelectSeeder path="Root/Beta" />
          <TscnSceneContents />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    const helperB = findBoxHelper(scene);
    expect(helperB).not.toBeNull();
    const targetB = (helperB as unknown as { object: THREE.Object3D }).object;
    expect(targetB).toBeDefined();
    // A new selection moves the helper to a different Object3D.
    expect(targetB).not.toBe(targetA);
  });

  it('removes the BoxHelper when selection is cleared', async () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeMeshInstance('Cube')],
    });

    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <SelectSeeder path="Cube" />
          <TscnSceneContents />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    const scene = renderer.scene.instance as unknown as THREE.Scene;
    expect(findBoxHelper(scene)).not.toBeNull();

    await renderer.update(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <SelectSeeder path={null} />
          <TscnSceneContents />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    expect(findBoxHelper(scene)).toBeNull();
  });
});
