/**
 * Regression test for viewport selection feedback.
 *
 * Pins the wire from `SelectionContext.selectedNodePath` →
 * `THREE.BoxHelper` attached to the canvas scene. Before this fix the
 * tree click updated `selectedNodePath` but nothing rendered in 3D, so
 * the user could not tell which object in the viewport corresponded to
 * the row they were inspecting. See docs/archive/UX-REGRESSIONS.md §2 and
 * docs/archive/UX-FLOW-GAPS.md Gap 2.
 *
 * Mounts `TscnSceneContents` (the inside-`<Canvas>` half of TscnCanvas)
 * with a SelectionProvider + HierarchyProvider, then drives selection
 * changes through the provider and asserts the scene contains a
 * `BoxHelper` whose target is the dispatcher-registered Object3D.
 */
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../parser/types';
import { TscnSceneContents } from '../TscnCanvas';
import { HierarchyProvider } from '../contexts/HierarchyContext';
import {
  SelectionProvider,
  useSelection,
} from '../contexts/SelectionContext';
import { createSceneGraphFromTscnScene } from '../../core/SceneGraph';
import type { MeshInstance3DProperties } from '../../nodes/3d/meshinstance3d/types';

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

function SelectSeeder({ path }: { path: string | null }) {
  const { setSelectedNodePath } = useSelection();
  useEffect(() => {
    setSelectedNodePath(path);
  }, [path, setSelectedNodePath]);
  return null;
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
    // BoxHelper is green to match main's HelperManager highlight color.
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
    // New selection ⇒ helper must point at a different Object3D.
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
