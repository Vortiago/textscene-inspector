/**
 * Viewport hover feedback: `SelectionContext.hoveredNodePath` attaches an orange (`0xff8800`)
 * `THREE.BoxHelper` to the canvas scene. A seeder drives the path through a real
 * SelectionProvider around `TscnSceneContents`.
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
import { HoverSeeder } from '../testing/HoverSeeder';
import { SelectSeeder } from '../testing/SelectSeeder';

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
          <HoverSeeder path="Cube" />
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
          <HoverSeeder path="Root/Alpha" />
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
          <HoverSeeder path="Root/Beta" />
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
          <HoverSeeder path="Cube" />
          <TscnSceneContents />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    const scene = renderer.scene.instance as unknown as THREE.Scene;
    expect(findHelperByColor(scene, 0xff8800)).not.toBeNull();

    await renderer.update(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <HoverSeeder path={null} />
          <TscnSceneContents />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    expect(findHelperByColor(scene, 0xff8800)).toBeNull();
  });

  it('coexists with the selection helper when hovered === selected (matches main)', async () => {
    // Hover and selection helpers are independent, so a node both selected and
    // hovered carries both BoxHelpers.
    const graph = createSceneGraphFromTscnScene({
      nodes: [makeMeshInstance('Cube')],
    });

    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <HoverSeeder path="Cube" />
          <SelectSeeder path="Cube" />
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
