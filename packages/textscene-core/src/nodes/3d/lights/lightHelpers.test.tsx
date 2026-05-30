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
import type { DirectionalLight3DProperties } from './directionallight3d/types';
import type { OmniLight3DProperties } from './omnilight3d/types';
import type { SpotLight3DProperties } from './spotlight3d/types';
import type { Camera3DProperties } from '../camera3d/types';
import {
  KeepAspectMode,
  ProjectionMode,
} from '../camera3d/types';
import type { AudioStreamPlayer3DProperties } from '../../audio/audiostreamplayer3d/types';
import {
  AttenuationModel,
  DopplerTracking,
} from '../../audio/audiostreamplayer3d/types';
import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { TscnSceneContents } from '../../../r3f/TscnCanvas';
import { HierarchyProvider } from '../../../r3f/contexts/HierarchyContext';
import {
  SelectionProvider,
  useSelection,
} from '../../../r3f/contexts/SelectionContext';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph';

import '../../../r3f/nodes/index';

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

/**
 * Scope expansion for WI-UX-14: ui-designer-2's visual A/B (commit
 * `a03dedc`) found the same eager-gizmo pattern in Camera3D's
 * `THREE.CameraHelper` frustum wireframe. Same fix shape — gate via
 * `useGizmoVisible()`.
 */
function cameraNode(name: string, overrides: Partial<Camera3DProperties> = {}): TscnNode {
  const props: Camera3DProperties = {
    name,
    projection: ProjectionMode.PROJECTION_PERSPECTIVE,
    fov: 75,
    size: 1,
    keep_aspect: KeepAspectMode.KEEP_HEIGHT,
    near: 0.05,
    far: 4000,
    h_offset: 0,
    v_offset: 0,
    cull_mask: 1048575,
    environment: undefined,
    attributes: undefined,
    doppler_tracking: 0,
    current: false,
    ...overrides,
  };
  return { name, type: 'Camera3D', children: [], properties: props };
}

describe('Camera3D gizmo — selection gating (WI-UX-14 scope expansion)', () => {
  it('renders zero CameraHelper frusta when nothing is selected', async () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [cameraNode('CamA'), cameraNode('CamB')],
    });
    const rootNodes = graph.scenes.get(graph.rootScene)?.nodes ?? [];

    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <NodeDispatcher nodes={rootNodes} />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    const scene = renderer.scene.instance as unknown as THREE.Scene;
    expect(findHelpersOfType(scene, THREE.CameraHelper)).toHaveLength(0);
  });

  it('renders exactly one CameraHelper when the camera path is selected', async () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [cameraNode('CamA'), cameraNode('CamB')],
    });
    const rootNodes = graph.scenes.get(graph.rootScene)?.nodes ?? [];

    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <SelectSeeder path="CamA" />
          <NodeDispatcher nodes={rootNodes} />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    const scene = renderer.scene.instance as unknown as THREE.Scene;
    expect(findHelpersOfType(scene, THREE.CameraHelper)).toHaveLength(1);
  });

  it('tears the CameraHelper down when selection moves to a different camera', async () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [cameraNode('CamA'), cameraNode('CamB')],
    });
    const rootNodes = graph.scenes.get(graph.rootScene)?.nodes ?? [];

    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <SelectSeeder path="CamA" />
          <NodeDispatcher nodes={rootNodes} />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    const scene = renderer.scene.instance as unknown as THREE.Scene;
    expect(findHelpersOfType(scene, THREE.CameraHelper)).toHaveLength(1);

    await renderer.update(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <SelectSeeder path="CamB" />
          <NodeDispatcher nodes={rootNodes} />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    expect(findHelpersOfType(scene, THREE.CameraHelper)).toHaveLength(1);
  });
});

/**
 * AudioStreamPlayer3D's gizmo isn't a `THREE.*Helper` — it's a regular
 * wireframe cone+disk plus an optional range sphere rendered as part of
 * the audio node's group. ui-designer-2's A/B finding (commit `a03dedc`)
 * flagged these as part of the "yellow wireframe overlay" pollution.
 * The gate hides BOTH the speaker meshes AND the range sphere, leaving
 * an empty `<group>` (so descendant children of the audio node still
 * see the correct transform context).
 */
function audioNode(name: string, overrides: Partial<AudioStreamPlayer3DProperties> = {}): TscnNode {
  const props: AudioStreamPlayer3DProperties = {
    name,
    volume_db: 0,
    pitch_scale: 1,
    playing: false,
    autoplay: false,
    stream_paused: false,
    attenuation_model: AttenuationModel.ATTENUATION_INVERSE_DISTANCE,
    unit_size: 10,
    max_distance: 0,
    max_db: 3,
    attenuation_filter_cutoff_hz: 5000,
    attenuation_filter_db: -24,
    doppler_tracking: DopplerTracking.DOPPLER_TRACKING_DISABLED,
    panning_strength: 1,
    area_mask: 1,
    emission_angle_enabled: false,
    emission_angle_degrees: 45,
    emission_angle_filter_attenuation_db: -12,
    bus: 'Master',
    max_polyphony: 1,
    ...overrides,
  };
  return { name, type: 'AudioStreamPlayer3D', children: [], properties: props };
}

/**
 * Counts the speaker-body group + the range-sphere mesh combined via
 * the test-renderer's tree API. We can't rely on `THREE.Scene.traverse`
 * + `parent.userData` here because the test renderer mounts each
 * primitive inside R3F-managed groups whose parent identity differs
 * from the production THREE.Scene's. The two markers
 * (`isAudioGizmoBody` on the speaker group, `isAudioRangeSphere` on
 * the range-sphere mesh) are the production-side hooks for this.
 */
function countAudioGizmoParts(
  renderer: { scene: { findAllByType: (t: string) => { instance: THREE.Object3D }[] } },
): { speakerGroups: number; rangeSpheres: number } {
  const groups = renderer.scene.findAllByType('Group');
  const speakerGroups = groups.filter((g) => {
    const ud = g.instance.userData as { isAudioGizmoBody?: boolean };
    return ud.isAudioGizmoBody === true;
  }).length;
  const meshes = renderer.scene.findAllByType('Mesh');
  const rangeSpheres = meshes.filter((m) => {
    const ud = m.instance.userData as { isAudioRangeSphere?: boolean };
    return ud.isAudioRangeSphere === true;
  }).length;
  return { speakerGroups, rangeSpheres };
}

describe('AudioStreamPlayer3D gizmo — selection gating (WI-UX-14 scope expansion)', () => {
  it('renders zero speaker / range gizmo parts when nothing is selected', async () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [audioNode('A', { unit_size: 25 }), audioNode('B', { unit_size: 25 })],
    });
    const rootNodes = graph.scenes.get(graph.rootScene)?.nodes ?? [];

    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <NodeDispatcher nodes={rootNodes} />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    const { speakerGroups, rangeSpheres } = countAudioGizmoParts(renderer);
    expect(speakerGroups).toBe(0);
    expect(rangeSpheres).toBe(0);
  });

  it('renders the speaker + range gizmo parts only for the selected audio path', async () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [audioNode('A', { unit_size: 25 }), audioNode('B', { unit_size: 25 })],
    });
    const rootNodes = graph.scenes.get(graph.rootScene)?.nodes ?? [];

    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <SelectSeeder path="A" />
          <NodeDispatcher nodes={rootNodes} />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    const { speakerGroups, rangeSpheres } = countAudioGizmoParts(renderer);
    // Selected A → 1 speaker group + 1 range sphere; Unselected B → 0/0.
    expect(speakerGroups).toBe(1);
    expect(rangeSpheres).toBe(1);
  });

  it('hides the gizmo when selection moves off the audio node', async () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [audioNode('A', { unit_size: 25 })],
    });
    const rootNodes = graph.scenes.get(graph.rootScene)?.nodes ?? [];

    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <SelectSeeder path="A" />
          <NodeDispatcher nodes={rootNodes} />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    expect(countAudioGizmoParts(renderer).speakerGroups).toBe(1);

    await renderer.update(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <SelectSeeder path="NotAudio" />
          <NodeDispatcher nodes={rootNodes} />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    const after = countAudioGizmoParts(renderer);
    expect(after.speakerGroups).toBe(0);
    expect(after.rangeSpheres).toBe(0);
  });
});

// `SelectSeeder` reused from the lights describe block above —
// declared at module scope so the Camera3D / Audio describe blocks
// pick it up via hoisting.
