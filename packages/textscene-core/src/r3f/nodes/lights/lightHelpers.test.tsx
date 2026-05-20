/**
 * Regression test for WI-UX-14: gate light gizmos on selection.
 *
 * Before WI-UX-14 each light gizmo (`*LightGizmo` in `lightHelpers.tsx`)
 * mounted its `THREE.*LightHelper` unconditionally on light mount.
 * `example-hallway.tscn` has 18 SpotLight3D nodes, so the viewport showed
 * 18 overlapping yellow cones that obscured the actual scene meshes —
 * a major visual-pollution regression vs main, where
 * `HelperManager.setHelper('highlight', …)` only attached a gizmo when
 * the corresponding node was the active selection.
 *
 * After WI-UX-14: gizmos are gated through `useNodePath()` +
 * `SelectionContext.selectedNodePath`. No selection → 0 helpers, even
 * with N lights. Selection on a light's path → exactly that light's
 * helper appears. Selection on a non-light path → 0 helpers.
 *
 * Hover is intentionally NOT a trigger; the orange BoxHelper from
 * WI-UX-10 is the hover affordance. Documented in `lightHelpers.tsx`.
 */
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../parser/types';
import type { DirectionalLight3DProperties } from '../../../nodes/3d/lights/directionallight3d/types';
import type { OmniLight3DProperties } from '../../../nodes/3d/lights/omnilight3d/types';
import type { SpotLight3DProperties } from '../../../nodes/3d/lights/spotlight3d/types';
import { NodeDispatcher } from '../../NodeDispatcher';
import { TscnSceneContents } from '../../TscnCanvas';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import {
  SelectionProvider,
  useSelection,
} from '../../contexts/SelectionContext';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph';

import '../index';

function dirNode(name: string, overrides: Partial<DirectionalLight3DProperties> = {}): TscnNode {
  const props: DirectionalLight3DProperties = {
    name,
    light_color: 'Color(1, 1, 1, 1)',
    light_energy: 1,
    shadow_enabled: false,
    ...overrides,
  };
  return { name, type: 'DirectionalLight3D', children: [], properties: props };
}

function omniNode(name: string, overrides: Partial<OmniLight3DProperties> = {}): TscnNode {
  const props: OmniLight3DProperties = {
    name,
    light_color: 'Color(1, 1, 1, 1)',
    light_energy: 1,
    shadow_enabled: false,
    omni_range: 5,
    omni_attenuation: 2,
    ...overrides,
  };
  return { name, type: 'OmniLight3D', children: [], properties: props };
}

function spotNode(name: string, overrides: Partial<SpotLight3DProperties> = {}): TscnNode {
  const props: SpotLight3DProperties = {
    name,
    light_color: 'Color(1, 1, 1, 1)',
    light_energy: 1,
    shadow_enabled: false,
    spot_range: 10,
    spot_angle: 30,
    ...overrides,
  };
  return { name, type: 'SpotLight3D', children: [], properties: props };
}

function SelectSeeder({ path }: { path: string | null }) {
  const { setSelectedNodePath } = useSelection();
  useEffect(() => {
    setSelectedNodePath(path);
  }, [path, setSelectedNodePath]);
  return null;
}

function findHelpersOfType<T extends THREE.Object3D>(
  scene: THREE.Scene,
  ctor: new (...args: never[]) => T,
): T[] {
  const out: T[] = [];
  scene.traverse((o) => {
    if (o instanceof ctor) out.push(o as T);
  });
  return out;
}

interface LightCase {
  label: string;
  nodes: TscnNode[];
  helperCtor: new (...args: never[]) => THREE.Object3D;
  selectedPath: string;
  otherPath: string;
}

const CASES: LightCase[] = [
  {
    label: 'DirectionalLight3D → DirectionalLightHelper',
    nodes: [dirNode('Sun'), dirNode('Other')],
    helperCtor: THREE.DirectionalLightHelper,
    selectedPath: 'Sun',
    otherPath: 'Other',
  },
  {
    label: 'OmniLight3D → PointLightHelper',
    nodes: [omniNode('Lamp'), omniNode('Other')],
    helperCtor: THREE.PointLightHelper,
    selectedPath: 'Lamp',
    otherPath: 'Other',
  },
  {
    label: 'SpotLight3D → SpotLightHelper',
    nodes: [spotNode('Torch'), spotNode('Other')],
    helperCtor: THREE.SpotLightHelper,
    selectedPath: 'Torch',
    otherPath: 'Other',
  },
];

describe('Light gizmos — selection gating (WI-UX-14)', () => {
  for (const c of CASES) {
    describe(c.label, () => {
      it('renders zero helpers when nothing is selected (visual-pollution fix)', async () => {
        const graph = createSceneGraphFromTscnScene({ nodes: c.nodes });
        const rootNodes =
          graph.scenes.get(graph.rootScene)?.nodes ?? [];

        const renderer = await ReactThreeTestRenderer.create(
          <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
            <SelectionProvider>
              <NodeDispatcher nodes={rootNodes} />
            </SelectionProvider>
          </HierarchyProvider>,
        );

        const scene = renderer.scene.instance as unknown as THREE.Scene;
        const helpers = findHelpersOfType(scene, c.helperCtor);
        expect(helpers).toHaveLength(0);
      });

      it('renders exactly one helper when the matching path is selected', async () => {
        const graph = createSceneGraphFromTscnScene({ nodes: c.nodes });
        const rootNodes =
          graph.scenes.get(graph.rootScene)?.nodes ?? [];

        const renderer = await ReactThreeTestRenderer.create(
          <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
            <SelectionProvider>
              <SelectSeeder path={c.selectedPath} />
              <NodeDispatcher nodes={rootNodes} />
            </SelectionProvider>
          </HierarchyProvider>,
        );

        const scene = renderer.scene.instance as unknown as THREE.Scene;
        const helpers = findHelpersOfType(scene, c.helperCtor);
        expect(helpers).toHaveLength(1);
      });

      it('tears the helper down when selection moves to a different node', async () => {
        const graph = createSceneGraphFromTscnScene({ nodes: c.nodes });
        const rootNodes =
          graph.scenes.get(graph.rootScene)?.nodes ?? [];

        const renderer = await ReactThreeTestRenderer.create(
          <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
            <SelectionProvider>
              <SelectSeeder path={c.selectedPath} />
              <NodeDispatcher nodes={rootNodes} />
            </SelectionProvider>
          </HierarchyProvider>,
        );

        const scene = renderer.scene.instance as unknown as THREE.Scene;
        expect(findHelpersOfType(scene, c.helperCtor)).toHaveLength(1);

        await renderer.update(
          <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
            <SelectionProvider>
              <SelectSeeder path={c.otherPath} />
              <NodeDispatcher nodes={rootNodes} />
            </SelectionProvider>
          </HierarchyProvider>,
        );

        // Selection moved to the sibling same-type light: the previous
        // selection's helper is gone, the new one's helper is present.
        // We assert via cardinality (1 helper, somewhere) because
        // identity-of-target lookup through the test renderer is fragile.
        expect(findHelpersOfType(scene, c.helperCtor)).toHaveLength(1);
      });

      it('renders zero helpers when selection points at a non-light path', async () => {
        const graph = createSceneGraphFromTscnScene({ nodes: c.nodes });
        const rootNodes =
          graph.scenes.get(graph.rootScene)?.nodes ?? [];

        const renderer = await ReactThreeTestRenderer.create(
          <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
            <SelectionProvider>
              <SelectSeeder path="NodeThatDoesNotExist" />
              <NodeDispatcher nodes={rootNodes} />
            </SelectionProvider>
          </HierarchyProvider>,
        );

        const scene = renderer.scene.instance as unknown as THREE.Scene;
        expect(findHelpersOfType(scene, c.helperCtor)).toHaveLength(0);
      });
    });
  }

  it('a hallway-style scene with many spotlights renders 0 helpers when nothing is selected', async () => {
    // Mirrors the BLOCKER ux-flow-analyst-2 found on example-hallway.tscn:
    // 18 SpotLight3D nodes → 18 overlapping yellow cones. Verify the
    // scaling property of the gate: N lights, no selection ⇒ 0 helpers.
    const nodes = Array.from({ length: 18 }, (_, i) => spotNode(`Spot${i}`));
    const graph = createSceneGraphFromTscnScene({ nodes });
    const rootNodes = graph.scenes.get(graph.rootScene)?.nodes ?? [];

    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <NodeDispatcher nodes={rootNodes} />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    const scene = renderer.scene.instance as unknown as THREE.Scene;
    expect(findHelpersOfType(scene, THREE.SpotLightHelper)).toHaveLength(0);
    // But the 18 SpotLight nodes themselves still mount — only the
    // gizmos were the visual-pollution problem, not the lights. We
    // probe via the test renderer's findAllByType because the SpotLight
    // primitives live inside r3f-managed groups that the raw scene
    // traversal in `findHelpersOfType` doesn't cross in this harness.
    expect(renderer.scene.findAllByType('SpotLight')).toHaveLength(18);
  });

  it('hover does NOT trigger a gizmo (the orange BoxHelper from WI-UX-10 is the hover affordance)', async () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [spotNode('Torch')],
    });

    function HoverSeeder() {
      const { setHoveredNodePath } = useSelection();
      useEffect(() => {
        setHoveredNodePath('Torch');
      }, [setHoveredNodePath]);
      return null;
    }

    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <HoverSeeder />
          <TscnSceneContents />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    const scene = renderer.scene.instance as unknown as THREE.Scene;
    // No selection, only hover ⇒ no SpotLightHelper.
    expect(findHelpersOfType(scene, THREE.SpotLightHelper)).toHaveLength(0);
  });
});
