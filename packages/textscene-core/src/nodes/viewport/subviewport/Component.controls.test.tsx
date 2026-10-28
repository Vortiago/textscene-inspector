/**
 * A SubViewport with 2D content and Controls draws both into its own pass. Every CanvasItem of a
 * viewport draws into that viewport's canvas, in one tree-order draw (`viewport.cpp:5344-5345`,
 * ADR-0036), so the pass holds the Controls the container used to draw live over it.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';

import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { CanvasWorldScope } from '../../../r3f/environment/WorldEnvironmentScope';
import { ViewportModeProvider } from '../../../r3f/contexts/ViewportModeContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../../../parser/TscnParser';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { settleLoads } from '../../../r3f/testing/settleLoads';
import { withStubbedGl } from '../../../r3f/testing/stubbedGl';
import { compareKeys, paintKey } from '../../../r3f/testing/paintOrder';
import { ViewportPassStack } from './viewportPasses.testkit';

import '../../../r3f/nodes/index';
import '../../../r3f/controls/index';

const PORTAL_SCENE = 'View::offscreen';

/** A viewport holding a full-rect ColorRect and a Polygon2D in the authored order given. */
function scene(order: 'control-first' | 'world-first'): string {
  const control = `[node name="Panel" type="ColorRect" parent="View"]
offset_right = 200.0
offset_bottom = 150.0
color = Color(0, 0, 0.4, 1)
`;
  const world = `[node name="Shape" type="Polygon2D" parent="View"]
polygon = PackedVector2Array(0, 0, 100, 0, 100, 100)
`;
  return `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="View" type="SubViewport" parent="."]
size = Vector2i(200, 150)

${order === 'control-first' ? control + '\n' + world : world + '\n' + control}`;
}

/** The portal scene one frame draws, once the lazily loaded Control painters have mounted. */
async function portalSceneOf(tscn: string): Promise<THREE.Object3D> {
  const parsed = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack workspace="2d" loader={fake.loader} scene={parsed}>
      <ViewportPassStack captured={captured}>
        <NodeDispatcher nodes={parsed.nodes} />
      </ViewportPassStack>
    </SceneStack>
  );
  await settleLoads();
  let portal: THREE.Object3D | undefined;
  await withStubbedGl(
    captured.current!,
    {
      onRender: (_bound, drawn) => {
        if (drawn.name === PORTAL_SCENE) portal = drawn;
      },
    },
    () => renderer.advanceFrames(1, 16)
  );
  if (!portal) throw new Error(`expected a draw of ${PORTAL_SCENE}, got none`);
  return portal;
}

function meshOf(root: THREE.Object3D, name: string): THREE.Object3D {
  let found: THREE.Object3D | undefined;
  root.traverse((o) => {
    if (found || (o.name !== name && !o.name.endsWith(`:${name}`))) return;
    o.traverse((d) => {
      if (!found && (d as THREE.Mesh).isMesh) found = d;
    });
  });
  if (!found) throw new Error(`expected "${name}" to draw a mesh in ${root.name}, got none`);
  return found;
}

/** A full-rect ColorRect and a Polygon2D in a viewport wider than the largest texture. */
const WIDE_SCENE = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="View" type="SubViewport" parent="."]
size = Vector2i(20000, 100)

[node name="Panel" type="ColorRect" parent="View"]
anchors_preset = 15
anchor_right = 1.0
anchor_bottom = 1.0
color = Color(0, 0, 0.4, 1)

[node name="Shape" type="Polygon2D" parent="View"]
polygon = PackedVector2Array(0, 0, 100, 0, 100, 100)
`;

describe('a SubViewport with 2D content and Controls', () => {
  // The Control painters load lazily; a loaded module lets one settled tick mount them.
  beforeAll(() => Promise.all([import('./ViewportControls'), import('./ControlsOverWorld')]));

  it('draws a Control into its own pass', async () => {
    const portal = await portalSceneOf(scene('control-first'));
    expect(meshOf(portal, 'Panel')).toBeDefined();
  });

  it('draws a Control under a Polygon2D authored after it', async () => {
    const portal = await portalSceneOf(scene('control-first'));
    expect(compareKeys(paintKey(meshOf(portal, 'Panel')), paintKey(meshOf(portal, 'Shape')))).toBeLessThan(0);
  });

  it('draws a Control over a Polygon2D authored before it', async () => {
    const portal = await portalSceneOf(scene('world-first'));
    expect(compareKeys(paintKey(meshOf(portal, 'Panel')), paintKey(meshOf(portal, 'Shape')))).toBeGreaterThan(
      0
    );
  });

  /**
   * Godot lays Controls out by `size` (`Viewport::get_visible_rect`, `viewport.cpp:1202-1210`), and
   * fails the texture allocation instead of shrinking `size` (`rendering_device.cpp:973`).
   */
  it('lays Controls out at the authored size when the target is capped', async () => {
    const portal = await portalSceneOf(WIDE_SCENE);
    const width = new THREE.Box3().setFromObject(meshOf(portal, 'Panel')).getSize(new THREE.Vector3()).x;
    expect(width).toBe(20000);
  });
});

const CONTROLS_SCENE = 'View::controls';

/** A Camera3D, a mesh and a ColorRect in one viewport, under the 2D stage that shows it. */
const SCENE_3D = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="View" type="SubViewport" parent="."]
size = Vector2i(200, 150)

[node name="Camera3D" type="Camera3D" parent="View"]

[node name="Box" type="MeshInstance3D" parent="View"]

[node name="Panel" type="ColorRect" parent="View"]
offset_right = 200.0
offset_bottom = 150.0
color = Color(0, 0, 0.4, 1)
`;

/** The scenes one frame draws, in order, each with the target bound at that moment. */
async function drawsOf(
  tscn: string
): Promise<{ scene: THREE.Object3D; bound: THREE.WebGLRenderTarget | null }[]> {
  const parsed = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack workspace="2d" loader={fake.loader} scene={parsed}>
      <ViewportModeProvider initialShowPreviewEnvironment={false}>
        <ViewportPassStack captured={captured}>
          <CanvasWorldScope>
            <NodeDispatcher nodes={parsed.nodes} />
          </CanvasWorldScope>
        </ViewportPassStack>
      </ViewportModeProvider>
    </SceneStack>
  );
  await settleLoads();
  const draws: { scene: THREE.Object3D; bound: THREE.WebGLRenderTarget | null }[] = [];
  await withStubbedGl(
    captured.current!,
    { onRender: (bound, drawn) => draws.push({ scene: drawn, bound }) },
    () => renderer.advanceFrames(1, 16)
  );
  return draws;
}

/** The mesh that copies the world into the Controls' pass: the one drawn before every Control. */
function backdropOf(root: THREE.Object3D): THREE.Mesh<THREE.BufferGeometry, THREE.Material> {
  let found: THREE.Mesh<THREE.BufferGeometry, THREE.Material> | undefined;
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && o.renderOrder < 0) found = o;
  });
  if (!found) throw new Error(`expected a backdrop mesh in ${root.name}`);
  return found;
}

describe('a SubViewport with 3D content and Controls', () => {
  beforeAll(() => Promise.all([import('./ViewportControls'), import('./ControlsOverWorld')]));

  it('draws its Controls in a pass of their own, after the world', async () => {
    const draws = await drawsOf(SCENE_3D);
    const controls = draws.find((d) => d.scene.name === CONTROLS_SCENE);
    expect(controls, `expected a draw of ${CONTROLS_SCENE}`).toBeDefined();
    expect(meshOf(controls!.scene, 'Panel')).toBeDefined();
  });

  it('replaces the target with the world, so a transparent world keeps its alpha', async () => {
    const draws = await drawsOf(SCENE_3D);
    const controls = draws.find((d) => d.scene.name === CONTROLS_SCENE)!;
    const backdrop = backdropOf(controls.scene);
    expect(backdrop.material.blending).toBe(THREE.NoBlending);
  });
});
