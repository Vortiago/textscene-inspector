/**
 * Light, camera and audio gizmos show only for the selected node: no selection
 * gives no helpers however many lights exist, and a light's path gives that
 * light's helper alone. Hover is not a trigger.
 */
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { DirectionalLight3DProperties } from '../directionallight3d/types';
import type { OmniLight3DProperties } from '../omnilight3d/types';
import type { SpotLight3DProperties } from '../spotlight3d/types';
import type { Camera3DProperties } from '../../camera3d/types';
import {
  KeepAspectMode,
  ProjectionMode,
} from '../../camera3d/types';
import type { AudioStreamPlayer3DProperties } from '../../../audio/audiostreamplayer3d/types';
import {
  AttenuationModel,
  DopplerTracking,
} from '../../../audio/audiostreamplayer3d/types';
import { NodeDispatcher } from '../../../../r3f/NodeDispatcher';
import { TscnSceneContents } from '../../../../r3f/TscnCanvas';
import { HierarchyProvider } from '../../../../r3f/contexts/HierarchyContext';
import {
  SelectionProvider,
  useSelection,
} from '../../../../r3f/contexts/SelectionContext';
import { createSceneGraphFromTscnScene } from '../../../../core/SceneGraph';
import { SelectSeeder } from '../../../../r3f/testing/SelectSeeder';

import '../../../../r3f/nodes/index';

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
    spot_attenuation: 1.0,
    spot_angle_attenuation: 1.0,
    ...overrides,
  };
  return { name, type: 'SpotLight3D', children: [], properties: props };
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

        // Selection moved to the sibling light. The assertion counts helpers,
        // since a lookup by target identity through the test renderer is fragile.
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
    // N lights and no selection give 0 helpers, as on example-hallway.tscn.
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
    // The lights themselves still mount. `findAllByType`, because the raw scene
    // traversal in `findHelpersOfType` does not cross r3f-managed groups here.
    expect(renderer.scene.findAllByType('SpotLight')).toHaveLength(18);
  });

  it('hover does NOT trigger a gizmo (the orange BoxHelper from WI-UX-10 is the hover affordance)', async () => {
    const graph = createSceneGraphFromTscnScene({
      nodes: [spotNode('Torch')],
    });

    function HoverSeeder() {
      const { hoverStore } = useSelection();
      useEffect(() => {
        hoverStore.set('Torch');
      }, [hoverStore]);
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

  it("DirectionalLightHelper sits at the light's own world position, not squared through its parent group", async () => {
    // THREE.DirectionalLightHelper's constructor sets `matrix = light.matrixWorld`
    // and `matrixAutoUpdate = false`. The helper is a <primitive> sibling of the
    // light in its transform group, so without `correctHelperForParentGroup` the
    // group's matrixWorld composes on top and doubles the translation.
    const node: TscnNode = {
      name: 'Sun',
      type: 'DirectionalLight3D',
      children: [],
      properties: {
        name: 'Sun',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1,
        shadow_enabled: false,
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: 0, y: 5, z: 0 },
        },
      } as DirectionalLight3DProperties,
    };
    const graph = createSceneGraphFromTscnScene({ nodes: [node] });
    const rootNodes = graph.scenes.get(graph.rootScene)?.nodes ?? [];

    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <SelectSeeder path="Sun" />
          <NodeDispatcher nodes={rootNodes} />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    // The correction runs in the helper's wrapped `update()`, which
    // `usePrimitiveHelper` calls from `useFrame`, after `.create()` resolves.
    // One frame makes that tick fire before any matrixWorld is read.
    await renderer.advanceFrames(1, 16);

    const scene = renderer.scene.instance as unknown as THREE.Scene;
    scene.updateMatrixWorld(true);
    const [helper] = findHelpersOfType(scene, THREE.DirectionalLightHelper);
    expect(helper).toBeDefined();

    // The raw `scene.traverse` in `findHelpersOfType` does not cross the
    // r3f-managed group, so the test renderer's tree API finds the light.
    const [lightNode] = renderer.scene.findAllByType('DirectionalLight');
    expect(lightNode).toBeDefined();
    const light = lightNode!.instance as unknown as THREE.DirectionalLight;

    // The helper tracks the light's current matrixWorld, and the helper leaves
    // it untouched: `helper.matrix` aliases `light.matrixWorld`, which a per-frame
    // compose() would reset. `<directionalLight>` sets `position={[0, 0, 0]}` over
    // three's `Object3D.DEFAULT_UP`, so world Y is the group's 5, not 6.
    const helperWorldPos = new THREE.Vector3().setFromMatrixPosition(helper!.matrixWorld);
    const lightWorldPos = new THREE.Vector3().setFromMatrixPosition(light.matrixWorld);
    expect(lightWorldPos.y).toBeCloseTo(5, 5);
    expect(helperWorldPos.x).toBeCloseTo(lightWorldPos.x, 5);
    expect(helperWorldPos.y).toBeCloseTo(lightWorldPos.y, 5);
    expect(helperWorldPos.z).toBeCloseTo(lightWorldPos.z, 5);
  });

  it("PointLightHelper sits at the light's own world position, not squared through its parent group", async () => {
    // THREE.PointLightHelper has DirectionalLightHelper's constructor aliasing,
    // and the same correction (see the previous test).
    const node: TscnNode = {
      name: 'Lamp',
      type: 'OmniLight3D',
      children: [],
      properties: {
        name: 'Lamp',
        light_color: 'Color(1, 1, 1, 1)',
        light_energy: 1,
        shadow_enabled: false,
        omni_range: 5,
        omni_attenuation: 1,
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: 0, y: 5, z: 0 },
        },
      } as OmniLight3DProperties,
    };
    const graph = createSceneGraphFromTscnScene({ nodes: [node] });
    const rootNodes = graph.scenes.get(graph.rootScene)?.nodes ?? [];

    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <SelectSeeder path="Lamp" />
          <NodeDispatcher nodes={rootNodes} />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    // The correction applies after one `useFrame` tick (see the DirectionalLight test).
    await renderer.advanceFrames(1, 16);

    const scene = renderer.scene.instance as unknown as THREE.Scene;
    scene.updateMatrixWorld(true);
    const [helper] = findHelpersOfType(scene, THREE.PointLightHelper);
    expect(helper).toBeDefined();

    const [lightNode] = renderer.scene.findAllByType('PointLight');
    expect(lightNode).toBeDefined();
    const light = lightNode!.instance as unknown as THREE.PointLight;

    // The DirectionalLight invariant. THREE.PointLight has no `DEFAULT_UP`
    // position, so its world Y is the group's authored 5.
    const helperWorldPos = new THREE.Vector3().setFromMatrixPosition(helper!.matrixWorld);
    const lightWorldPos = new THREE.Vector3().setFromMatrixPosition(light.matrixWorld);
    expect(lightWorldPos.y).toBeCloseTo(5, 5);
    expect(helperWorldPos.x).toBeCloseTo(lightWorldPos.x, 5);
    expect(helperWorldPos.y).toBeCloseTo(lightWorldPos.y, 5);
    expect(helperWorldPos.z).toBeCloseTo(lightWorldPos.z, 5);
  });
});

/** Camera3D's `THREE.CameraHelper` frustum is gated by `useGizmoVisible()` too. */
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
    frustum_offset: { x: 0, y: 0 },
    cull_mask: 1048575,
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

  it("CameraHelper sits at the camera's own world transform, not squared through a transformed ancestor", async () => {
    // THREE.CameraHelper has the light helpers' `matrix = camera.matrixWorld`
    // aliasing. Camera3D puts its transform on the `<perspectiveCamera>` with no
    // group of its own, so only a transformed ancestor, whose group holds both
    // the camera and its sibling helper, reproduces the doubling.
    const parentNode: TscnNode = {
      name: 'Rig',
      type: 'Node3D',
      children: [cameraNode('RigCam')],
      properties: {
        name: 'Rig',
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: 10, y: 5, z: -3 },
        },
      },
    };
    const graph = createSceneGraphFromTscnScene({ nodes: [parentNode] });
    const rootNodes = graph.scenes.get(graph.rootScene)?.nodes ?? [];

    const renderer = await ReactThreeTestRenderer.create(
      <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
        <SelectionProvider>
          <SelectSeeder path="Rig/RigCam" />
          <NodeDispatcher nodes={rootNodes} />
        </SelectionProvider>
      </HierarchyProvider>,
    );

    // The correction applies after one `useFrame` tick (see the DirectionalLight test).
    await renderer.advanceFrames(1, 16);

    const scene = renderer.scene.instance as unknown as THREE.Scene;
    scene.updateMatrixWorld(true);
    const [helper] = findHelpersOfType(scene, THREE.CameraHelper);
    expect(helper).toBeDefined();

    const [cameraNode3] = renderer.scene.findAllByType('PerspectiveCamera');
    expect(cameraNode3).toBeDefined();
    const camera = cameraNode3!.instance as unknown as THREE.PerspectiveCamera;

    const helperWorldPos = new THREE.Vector3().setFromMatrixPosition(helper!.matrixWorld);
    const cameraWorldPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    expect(cameraWorldPos.x).toBeCloseTo(10, 5);
    expect(cameraWorldPos.y).toBeCloseTo(5, 5);
    expect(cameraWorldPos.z).toBeCloseTo(-3, 5);
    expect(helperWorldPos.x).toBeCloseTo(cameraWorldPos.x, 5);
    expect(helperWorldPos.y).toBeCloseTo(cameraWorldPos.y, 5);
    expect(helperWorldPos.z).toBeCloseTo(cameraWorldPos.z, 5);
  });
});

/**
 * AudioStreamPlayer3D's gizmo is a wireframe cone and disk plus an optional
 * range sphere in the node's group. The gate hides both and leaves an empty
 * `<group>`, so the node's children keep their transform context.
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
 * Counts speaker groups (`isAudioGizmoBody`) and range groups (`isAudioRangeSphere`)
 * through the test renderer's tree API. `THREE.Scene.traverse` cannot serve: the
 * test renderer mounts each primitive in R3F-managed groups with other parents.
 */
function countAudioGizmoParts(
  renderer: { scene: { findAllByType: (t: string) => { instance: THREE.Object3D }[] } },
): { speakerGroups: number; rangeSpheres: number } {
  const groups = renderer.scene.findAllByType('Group');
  const speakerGroups = groups.filter((g) => {
    const ud = g.instance.userData as { isAudioGizmoBody?: boolean };
    return ud.isAudioGizmoBody === true;
  }).length;
  // The audible range is a camera-facing circle of lines (what Godot's gizmo
  // plugin draws), so its marker sits on a group wrapping a <lineSegments>,
  // not on a mesh.
  const rangeSpheres = groups.filter((g) => {
    const ud = g.instance.userData as { isAudioRangeSphere?: boolean };
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

// `SelectSeeder` is declared at module scope, so the Camera3D and Audio blocks
// share it through hoisting.
