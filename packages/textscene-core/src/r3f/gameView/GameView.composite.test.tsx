import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { GameViewContents } from './GameViewContents';
import { TscnSceneProvider } from '../TscnSceneProvider';
import { openScene } from '../../scene/openScene';
import { ViewportPassOrchestrator } from '../contexts/ViewportPassRegistryContext';
import { CaptureRenderer } from '../testing/CaptureRenderer';
import { settleLoads } from '../testing/settleLoads';
import { withStubbedGl } from '../testing/stubbedGl';
import { compareKeys, firstMeshUnder, paintKey } from '../testing/paintOrder';
import { isMesh } from '../testing/threeNarrow';
import { OVER_EVERY_LAYER } from '../canvasKeyWindow';
import type { ResourceProvider } from '../../resources/ResourceProvider';
import '../nodes';

const provider: ResourceProvider = { loadResource: async () => null };

const POLYGON = 'polygon = PackedVector2Array(0, 0, 100, 0, 100, 100)';

/** A world under a current Camera3D, an item on the root canvas, and items on layers -1 and 2. */
const HUD_OVER_WORLD = `[gd_scene format=3]

[node name="Main" type="Node"]

[node name="World" type="Node3D" parent="."]

[node name="Camera3D" type="Camera3D" parent="World"]
current = true

[node name="Box" type="CSGBox3D" parent="World"]

[node name="Top" type="CanvasLayer" parent="."]
layer = 2

[node name="TopItem" type="Polygon2D" parent="Top"]
${POLYGON}

[node name="Root" type="Polygon2D" parent="."]
${POLYGON}

[node name="Low" type="CanvasLayer" parent="."]
layer = -1

[node name="LowItem" type="Polygon2D" parent="Low"]
${POLYGON}
`;

/** A canvas item and a Camera2D whose parent is a Node3D, which Godot puts on the root canvas. */
const CANVAS_UNDER_NODE3D = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="Camera3D" type="Camera3D" parent="."]
current = true

[node name="Box" type="CSGBox3D" parent="."]

[node name="Camera2D" type="Camera2D" parent="."]
anchor_mode = 0
offset = Vector2(100, 50)

[node name="Item" type="Polygon2D" parent="."]
${POLYGON}
`;

/** A canvas item below a hidden Node3D, whose visibility it does not take (`canvas_item.cpp:319-348`). */
const CANVAS_UNDER_HIDDEN_NODE3D = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="Camera3D" type="Camera3D" parent="."]
current = true

[node name="Hidden" type="Node3D" parent="."]
visible = false

[node name="Holder" type="Node" parent="Hidden"]

[node name="Item" type="Polygon2D" parent="Hidden/Holder"]
${POLYGON}
`;

/** A 3D node whose parent is a CanvasItem, which Godot puts in the world (`node_3d.cpp:150`). */
const NODE3D_UNDER_CANVAS = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="Camera3D" type="Camera3D" parent="."]
current = true

[node name="Hud" type="Node2D" parent="."]

[node name="Box" type="CSGBox3D" parent="Hud"]
`;

interface Draw {
  scene: THREE.Object3D;
  camera: THREE.Camera;
}

const isCanvas = (draw: Draw) => draw.scene.name.endsWith('::canvas');
const isWorld = (draw: Draw) => draw.scene.name.endsWith('::offscreen');

/** Unmounted after each test, so a test reads the scenes its draws hold. */
const mounted: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>[] = [];

/** The draws one frame of the In-game view of `source` makes, in order. */
async function drawsOf(source: string): Promise<Draw[]> {
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <TscnSceneProvider scene={openScene({ source, provider })}>
      <GameViewContents />
      <CaptureRenderer captured={captured} />
      <ViewportPassOrchestrator />
    </TscnSceneProvider>
  );
  await settleLoads();
  const draws: Draw[] = [];
  await withStubbedGl(
    captured.current!,
    { onRender: (_bound, scene, camera) => draws.push({ scene, camera }) },
    () => renderer.advanceFrames(1, 16)
  );
  mounted.push(renderer);
  return draws;
}

/** The group drawn for the node `name`, under `scene`. */
function drawnNamed(scene: THREE.Object3D, name: string): THREE.Object3D | undefined {
  return findObject(scene, (object) => object.name === name && hasMesh(object));
}

function findObject(root: THREE.Object3D, accepts: (object: THREE.Object3D) => boolean) {
  let found: THREE.Object3D | undefined;
  root.traverse((object) => {
    if (!found && accepts(object)) found = object;
  });
  return found;
}

function hasMesh(object: THREE.Object3D): boolean {
  return findObject(object, isMesh) !== undefined;
}

/** The labels of `drawn`, in the order three paints their first mesh. */
function paintOrderOf(drawn: Record<string, THREE.Object3D | undefined>): string[] {
  return Object.entries(drawn)
    .map(([label, object]) => {
      if (!object) throw new Error(`expected a drawn object for ${label}, found none`);
      return { label, key: paintKey(firstMeshUnder(object)) };
    })
    .sort((a, b) => compareKeys(a.key, b.key))
    .map(({ label }) => label);
}

// Every layer, one below 0 included, draws over the world (`renderer_viewport.cpp:380-385`).
describe('the In-game view composite', () => {
  // The pass loads the world's backdrop on demand, which a cold first frame would not have mounted.
  beforeAll(() => import('../viewportRender/CanvasOverWorld'));
  afterEach(async () => {
    await Promise.all(mounted.splice(0).map((renderer) => renderer.unmount()));
  });

  it('draws the 3D world before the canvas', async () => {
    const draws = await drawsOf(HUD_OVER_WORLD);
    const world = draws.findIndex(isWorld);
    expect(world, 'a draw of the world').toBeGreaterThanOrEqual(0);
    expect(draws.findIndex(isCanvas)).toBeGreaterThan(world);
  });

  it('paints the world, then layer -1, the root canvas and layer 2, in that order', async () => {
    const canvas = (await drawsOf(HUD_OVER_WORLD)).find(isCanvas)!.scene;
    const order = paintOrderOf({
      world: findObject(canvas, (object) => object.userData[OVER_EVERY_LAYER] === true),
      low: drawnNamed(canvas, 'LowItem'),
      root: drawnNamed(canvas, 'Root'),
      top: drawnNamed(canvas, 'TopItem'),
    });
    expect(order).toEqual(['world', 'low', 'root', 'top']);
  });

  it('draws a canvas item whose parent is a Node3D on the root canvas', async () => {
    const canvas = (await drawsOf(CANVAS_UNDER_NODE3D)).find(isCanvas)!.scene;
    expect(drawnNamed(canvas, 'Item')).toBeDefined();
  });

  it('frames the root canvas through a Camera2D whose parent is a Node3D', async () => {
    const canvasDraw = (await drawsOf(CANVAS_UNDER_NODE3D)).find(isCanvas)!;
    const camera = canvasDraw.camera as THREE.OrthographicCamera;
    // `offset` moves the view, so the top-left corner of the frame is (100, 50) in canvas pixels.
    expect(camera.position.x + camera.left).toBeCloseTo(100);
    expect(camera.position.y + camera.top).toBeCloseTo(-50);
  });

  it('draws a 3D node whose parent is a CanvasItem in the world', async () => {
    const world = (await drawsOf(NODE3D_UNDER_CANVAS)).find(isWorld)!.scene;
    expect(drawnNamed(world, 'Box')).toBeDefined();
  });

  it('draws a canvas item below a hidden Node3D, which passes it no visibility', async () => {
    const canvas = (await drawsOf(CANVAS_UNDER_HIDDEN_NODE3D)).find(isCanvas)!.scene;
    for (let object: THREE.Object3D | null = drawnNamed(canvas, 'Item')!; object; object = object.parent) {
      expect(object.visible, object.name).toBe(true);
    }
  });
});
