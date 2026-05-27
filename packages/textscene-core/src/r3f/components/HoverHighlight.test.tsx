/**
 * Regression test for WI-UX-10: viewport hover feedback.
 *
 * Pins the wire from `SelectionContext.hoveredNodePath` →
 * `THREE.BoxHelper` attached to the canvas scene. Before WI-UX-10,
 * `hoveredNodePath` was a dead state slot — `TreeNode.tsx` populated
 * it on mouseenter/mouseleave but no viewport component consumed it
 * (Gap 9 in docs/UX-FLOW-GAPS.md). Now `<HoverHighlight>` mirrors
 * `<SelectionHighlight>`'s pattern with an orange (`0xff8800`) helper
 * to match main's `HelperManager.showHoverEffect`.
 *
 * Mounts `TscnSceneContents` with a SelectionProvider so the seeder
 * component can drive `hoveredNodePath` through real provider state.
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

function makeMeshInstance(name: string): TscnNode {
  const props: MeshInstance3DProperties = {
    name,
    surfaceMaterialOverrides: new Map(),
  };
  return { name, type: 'MeshInstance3D', children: [], properties: props };
}

function StateSeeder({
  hoverPath,
  selectPath,
}: {
  hoverPath?: string | null;
  selectPath?: string | null;
}) {
  const { setHoveredNodePath, setSelectedNodePath } = useSelection();
  useEffect(() => {
    if (hoverPath !== undefined) setHoveredNodePath(hoverPath);
    if (selectPath !== undefined) setSelectedNodePath(selectPath);
  }, [hoverPath, selectPath, setHoveredNodePath, setSelectedNodePath]);
  return null;
}

function findHelpers(scene: THREE.Scene): THREE.BoxHelper[] {
  const out: THREE.BoxHelper[] = [];
  scene.traverse((o) => {
    if (o instanceof THREE.BoxHelper) out.push(o);
  });
  return out;
}

function findHelperByColor(
  scene: THREE.Scene,
  colorHex: number,
): THREE.BoxHelper | null {
  for (const h of findHelpers(scene)) {
    const mat = (h as unknown as { material: THREE.LineBasicMaterial }).material;
    if (mat.color.getHex() === colorHex) return h;
  }
  return null;
}

describe('<HoverHighlight> (WI-UX-10)', () => {
  it('mounts no BoxHelper when nothing is hovered', async () => {
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

    const scene = renderer.scene.instance as unknown as THREE.Scene;
    expect(findHelperByColor(scene, 0xff8800)).toBeNull();
  });

  it('attaches an orange BoxHelper when a node is hovered', async () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeMeshInstance('Cube')],
    });

    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <StateSeeder hoverPath="Cube" />
          <TscnSceneContents />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    const scene = renderer.scene.instance as unknown as THREE.Scene;
    const helper = findHelperByColor(scene, 0xff8800);
    expect(helper).not.toBeNull();
    expect(helper!.name).toBe('tscn-hover-highlight');
  });

  it('switches the hover target when the hovered path changes', async () => {
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
          <StateSeeder hoverPath="Root/Alpha" />
          <TscnSceneContents />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    const scene = renderer.scene.instance as unknown as THREE.Scene;
    const helperA = findHelperByColor(scene, 0xff8800);
    expect(helperA).not.toBeNull();
    const targetA = (helperA as unknown as { object: THREE.Object3D }).object;

    await renderer.update(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <StateSeeder hoverPath="Root/Beta" />
          <TscnSceneContents />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    const helperB = findHelperByColor(scene, 0xff8800);
    expect(helperB).not.toBeNull();
    const targetB = (helperB as unknown as { object: THREE.Object3D }).object;
    expect(targetB).not.toBe(targetA);
  });

  it('removes the hover helper when hoveredNodePath flips to null', async () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeMeshInstance('Cube')],
    });

    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <StateSeeder hoverPath="Cube" />
          <TscnSceneContents />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    const scene = renderer.scene.instance as unknown as THREE.Scene;
    expect(findHelperByColor(scene, 0xff8800)).not.toBeNull();

    await renderer.update(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <StateSeeder hoverPath={null} />
          <TscnSceneContents />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    expect(findHelperByColor(scene, 0xff8800)).toBeNull();
  });

  it('coexists with the selection helper when hovered === selected (matches main)', async () => {
    // Main's HelperManager keeps highlight and hover under independent
    // map keys; both BoxHelpers attach to the scene when the same node
    // is selected AND hovered. Pin that behavior so a future
    // simplification that swaps to "skip hover when selected" is a
    // conscious choice, not an accident.
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeMeshInstance('Cube')],
    });

    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <StateSeeder hoverPath="Cube" selectPath="Cube" />
          <TscnSceneContents />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    const scene = renderer.scene.instance as unknown as THREE.Scene;
    const green = findHelperByColor(scene, 0x00ff00);
    const orange = findHelperByColor(scene, 0xff8800);
    expect(green).not.toBeNull();
    expect(orange).not.toBeNull();
    expect(green).not.toBe(orange);
  });
});
