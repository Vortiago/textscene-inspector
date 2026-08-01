/**
 * Regression test: gate light gizmos on selection.
 *
 * Previously each light gizmo (`*LightGizmo` in `lightHelpers.tsx`)
 * mounted its `THREE.*LightHelper` unconditionally on light mount.
 * `example-hallway.tscn` has 18 SpotLight3D nodes, so the viewport showed
 * 18 overlapping yellow cones that obscured the actual scene meshes —
 * a major visual-pollution regression vs main, where
 * `HelperManager.setHelper('highlight', …)` only attached a gizmo when
 * the corresponding node was the active selection.
 *
 * Now gizmos are gated through `useNodePath()` +
 * `SelectionContext.selectedNodePath`. No selection → 0 helpers, even
 * with N lights. Selection on a light's path → exactly that light's
 * helper appears. Selection on a non-light path → 0 helpers.
 *
 * Hover is intentionally NOT a trigger; the orange BoxHelper is
 * the hover affordance. Documented in `lightHelpers.tsx`.
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
    spot_attenuation: 1,
    spot_angle_attenuation: 1,
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
    // THREE.DirectionalLightHelper's constructor hardcodes
    // `matrix = light.matrixWorld` + `matrixAutoUpdate = false` (its official
    // usage adds the helper directly to the scene root). This codebase
    // instead renders the helper as a <primitive> SIBLING of the light
    // inside the light's own transform group, so without the parent
    // correction in `correctForParentGroup` the group's matrixWorld composes
    // on top of the already-world `light.matrixWorld`, DOUBLING the
    // translation (verified below against the light's own current position,
    // not a hardcoded constant, since a naive fix can get the helper's
    // absolute position "coincidentally right" while still corrupting the
    // light itself — see that function's doc comment).
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

    // The parent-correction lives in the helper's wrapped `update()`, which
    // `usePrimitiveHelper` invokes via `useFrame` — i.e. only once the
    // gizmo has actually been committed into the scene graph with a real
    // parent (never true yet at the point `.create()`'s promise resolves,
    // since mounting the `<primitive>` and running the first tick are two
    // separate steps). Advance one frame so that tick fires before we read
    // any matrixWorld, matching what always happens before a real paint.
    await renderer.advanceFrames(1, 16);

    const scene = renderer.scene.instance as unknown as THREE.Scene;
    scene.updateMatrixWorld(true);
    const [helper] = findHelpersOfType(scene, THREE.DirectionalLightHelper);
    expect(helper).toBeDefined();

    // The light primitive lives inside an r3f-managed group that the raw
    // `scene.traverse` in `findHelpersOfType` doesn't cross in this test
    // renderer (see `countAudioGizmoParts`'s comment below), so we look it
    // up via the test renderer's own tree API instead, same as the
    // 18-spotlight test does for `'SpotLight'`.
    const [lightNode] = renderer.scene.findAllByType('DirectionalLight');
    expect(lightNode).toBeDefined();
    const light = lightNode!.instance as unknown as THREE.DirectionalLight;

    // The helper must track the light's TRUE world position exactly — not
    // squared through the parent group (the original double-transform bug:
    // `helper.matrix` already held a WORLD matrix, so re-applying the
    // parent's transform on top doubled it) — and the light's OWN
    // matrixWorld must be exactly what it always was, unperturbed by the
    // helper's mere presence (the corruption bug: naively flipping
    // matrixAutoUpdate on without also breaking the constructor's aliasing
    // of `helper.matrix` to `light.matrixWorld` let the generic per-frame
    // compose() clobber that SHARED object to identity, corrupting the
    // light's actual illumination the instant its gizmo was selected).
    //
    // Comparing the helper directly against the light's own current
    // matrixWorld — rather than only asserting a hardcoded expected Y — is
    // what catches a subtly-wrong "fix" here. THREE.DirectionalLight's
    // constructor defaults its OWN local position to `Object3D.DEFAULT_UP`
    // (0, 1, 0), which used to leak into the effective shading direction —
    // `<directionalLight>` now sets an explicit
    // `position={[0, 0, 0]}` so only the shared parent group's authored
    // transform determines world position, giving this fixture's true
    // world Y of 5 (the group's origin.y), not 6.
    const helperWorldPos = new THREE.Vector3().setFromMatrixPosition(helper!.matrixWorld);
    const lightWorldPos = new THREE.Vector3().setFromMatrixPosition(light.matrixWorld);
    expect(lightWorldPos.y).toBeCloseTo(5, 5);
    expect(helperWorldPos.x).toBeCloseTo(lightWorldPos.x, 5);
    expect(helperWorldPos.y).toBeCloseTo(lightWorldPos.y, 5);
    expect(helperWorldPos.z).toBeCloseTo(lightWorldPos.z, 5);
  });

  it("PointLightHelper sits at the light's own world position, not squared through its parent group", async () => {
    // THREE.PointLightHelper shares DirectionalLightHelper's
    // `matrix = light.matrixWorld` + `matrixAutoUpdate = false` constructor
    // pattern — same double-transform bug, same fix (see the previous test).
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

    // See the DirectionalLight test above: the parent-correction only
    // applies once the gizmo's wrapped `update()` has fired via a real
    // `useFrame` tick, which requires advancing at least one frame.
    await renderer.advanceFrames(1, 16);

    const scene = renderer.scene.instance as unknown as THREE.Scene;
    scene.updateMatrixWorld(true);
    const [helper] = findHelpersOfType(scene, THREE.PointLightHelper);
    expect(helper).toBeDefined();

    const [lightNode] = renderer.scene.findAllByType('PointLight');
    expect(lightNode).toBeDefined();
    const light = lightNode!.instance as unknown as THREE.PointLight;

    // Same invariant as the DirectionalLight case above: the helper must
    // track the light's own current matrixWorld exactly, and that
    // matrixWorld must be unperturbed by the helper's presence.
    // THREE.PointLight has no `DEFAULT_UP` local-position quirk, so its
    // true world Y here is exactly the group's authored 5.
    const helperWorldPos = new THREE.Vector3().setFromMatrixPosition(helper!.matrixWorld);
    const lightWorldPos = new THREE.Vector3().setFromMatrixPosition(light.matrixWorld);
    expect(lightWorldPos.y).toBeCloseTo(5, 5);
    expect(helperWorldPos.x).toBeCloseTo(lightWorldPos.x, 5);
    expect(helperWorldPos.y).toBeCloseTo(lightWorldPos.y, 5);
    expect(helperWorldPos.z).toBeCloseTo(lightWorldPos.z, 5);
  });
});

/**
 * Scope expansion: ui-designer-2's visual A/B (commit
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
    frustum_offset: { x: 0, y: 0 },
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
    // THREE.CameraHelper's constructor hardcodes `matrix = camera.matrixWorld`
    // + `matrixAutoUpdate = false`, the exact aliasing pattern
    // `correctHelperForParentGroup` fixes for the light helpers. Unlike a
    // light (whose OWN internal transform group is enough to trigger the
    // bug — see the DirectionalLightHelper test above), Camera3D applies its
    // transform directly to the `<perspectiveCamera>` primitive with no
    // wrapping group of its own, so reproducing the double-transform
    // requires an ANCESTOR node with a real transform: a parent Node3D's
    // `<group position=…>` is what the camera's pickable wrapper — and the
    // helper mounted as its sibling — both sit under.
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

    // Same reasoning as the DirectionalLightHelper test: the correction runs
    // inside the helper's wrapped `update()`, invoked via `useFrame` — advance
    // one frame so it fires before reading any matrixWorld.
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
 * the range gizmo's group) are the production-side hooks for this.
 */
function countAudioGizmoParts(
  renderer: { scene: { findAllByType: (t: string) => { instance: THREE.Object3D }[] } },
): { speakerGroups: number; rangeSpheres: number } {
  const groups = renderer.scene.findAllByType('Group');
  const speakerGroups = groups.filter((g) => {
    const ud = g.instance.userData as { isAudioGizmoBody?: boolean };
    return ud.isAudioGizmoBody === true;
  }).length;
  // The audible range is a camera-facing CIRCLE of lines (what Godot's gizmo
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

// `SelectSeeder` reused from the lights describe block above —
// declared at module scope so the Camera3D / Audio describe blocks
// pick it up via hoisting.
