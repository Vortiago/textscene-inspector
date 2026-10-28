/**
 * A SubViewport with 2D content lights it with its own Light2D pass. Every Viewport keeps its own
 * World2D (`viewport.cpp:5345`), so the lights, occluders and CanvasModulate inside act on the
 * canvas items inside and on nothing outside, and the canvas around acts on nothing inside.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';

import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../../../parser/TscnParser';
import { ViewportTextureProvider } from '../../../r3f/contexts/ViewportTextureContext';
import {
  ViewportPassOrchestrator,
  ViewportPassProvider,
} from '../../../r3f/contexts/ViewportPassRegistryContext';
import { CanvasLighting2DProvider } from '../../../r3f/lighting2d/CanvasLighting2D';
import { LIGHT_PASS_LAYER } from '../../../r3f/lighting2d/lightPassLayers';
import { drawnMeshes, isSeed, ownerName } from '../../../r3f/lighting2d/testing/lightPassProbe';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { CaptureRenderer } from '../../../r3f/testing/CaptureRenderer';
import { settleLoads } from '../../../r3f/testing/settleLoads';
import { withStubbedGl } from '../../../r3f/testing/stubbedGl';
import { canvasModulateColor } from '../../../r3f/canvasModulate';
import { contextOver } from '../../../r3f/liveSceneTree.testkit';

import '../../../r3f/nodes/index';

const COOKIE = 'res://light.png';

const SCENE = `[gd_scene format=3]
[ext_resource type="Texture2D" path="${COOKIE}" id="1"]
[node name="Root" type="Node2D"]

[node name="Ground" type="Polygon2D" parent="."]
polygon = PackedVector2Array(0, 0, 100, 0, 100, 100)

[node name="Outer" type="PointLight2D" parent="."]
texture = ExtResource("1")

[node name="Viewport" type="SubViewport" parent="."]
size = Vector2i(200, 150)

[node name="Floor" type="Polygon2D" parent="Viewport"]
polygon = PackedVector2Array(0, 0, 200, 0, 200, 150, 0, 150)

[node name="Inner" type="PointLight2D" parent="Viewport"]
texture = ExtResource("1")

[node name="Tint" type="CanvasModulate" parent="Viewport"]
color = Color(0.4, 0.5, 0.85, 1)
`;

/** One accumulation draw: the scene it drew, and what the draw held. */
interface Accumulation {
  readonly scene: THREE.Object3D;
  readonly camera: THREE.Camera;
  readonly targetSize: [number, number];
  /** The owners of the light meshes the camera would draw. */
  readonly lights: string[];
  readonly seed: [number, number, number];
}

function accumulationOf(
  bound: THREE.WebGLRenderTarget,
  scene: THREE.Object3D,
  camera: THREE.Camera
): Accumulation {
  const drawn = drawnMeshes(scene, camera);
  const seed = (drawn.find(isSeed)!.material as THREE.ShaderMaterial).uniforms.uSeed!.value as THREE.Vector3;
  return {
    scene,
    camera,
    targetSize: [bound.width, bound.height],
    lights: drawn.filter((mesh) => !isSeed(mesh)).map(ownerName),
    seed: [seed.x, seed.y, seed.z],
  };
}

/** The draws of one frame, in order: the accumulations, and whatever else the renderer drew. */
interface Frame {
  readonly accumulations: Accumulation[];
  /** The scenes the frame drew, accumulation or not, in order. */
  readonly drawnScenes: THREE.Object3D[];
}

async function frameOf(): Promise<Frame> {
  const parsed = new TscnParser().parse(SCENE);
  const fake = createFakeResourceLoader();
  const texture = new THREE.Texture();
  (texture as unknown as { image: object }).image = { width: 64, height: 64 };
  fake.textures.seed(COOKIE, texture);
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack workspace="2d" loader={fake.loader} scene={parsed}>
      <ViewportTextureProvider>
        <ViewportPassProvider>
          <CanvasLighting2DProvider
            canvasModulate={canvasModulateColor(parsed.nodes, contextOver(parsed, {}))}
          >
            <NodeDispatcher nodes={parsed.nodes} />
          </CanvasLighting2DProvider>
          <CaptureRenderer captured={captured} />
          <ViewportPassOrchestrator />
        </ViewportPassProvider>
      </ViewportTextureProvider>
    </SceneStack>
  );
  await settleLoads();
  const frame: Frame = { accumulations: [], drawnScenes: [] };
  await withStubbedGl(
    captured.current!,
    {
      onRender: (bound, scene, camera) => {
        frame.drawnScenes.push(scene);
        if (bound && camera.layers.mask === 1 << LIGHT_PASS_LAYER) {
          frame.accumulations.push(accumulationOf(bound, scene, camera));
        }
      },
    },
    () => renderer.advanceFrames(1, 16)
  );
  return frame;
}

const PORTAL_SCENE = 'Viewport::offscreen';
const portalOf = (frame: Frame) => frame.accumulations.find((a) => a.scene.name === PORTAL_SCENE);
const mainOf = (frame: Frame) => frame.accumulations.find((a) => a.scene.name !== PORTAL_SCENE);

describe('a SubViewport with 2D content', () => {
  it('lights its own canvas with the lights inside it and no other', async () => {
    expect(portalOf(await frameOf())!.lights).toEqual(['Inner']);
  });

  it('leaves the lights inside it off the canvas around it', async () => {
    expect(mainOf(await frameOf())!.lights).toEqual(['Outer']);
  });

  it("sizes the accumulation to the viewport's target, not the drawing buffer", async () => {
    expect(portalOf(await frameOf())!.targetSize).toEqual([200, 150]);
  });

  it('seeds the accumulation from the CanvasModulate inside it, and the canvas around from its own', async () => {
    const frame = await frameOf();
    expect(portalOf(frame)!.seed.map((c) => c.toFixed(2))).toEqual(['0.40', '0.50', '0.85']);
    expect(mainOf(frame)!.seed).toEqual([1, 1, 1]);
  });

  it('accumulates before it draws the target, through the camera it draws the target with', async () => {
    const frame = await frameOf();
    const portal = portalOf(frame)!;
    const portalDraws = frame.drawnScenes.filter((scene) => scene === portal.scene);
    expect(portalDraws.length).toBeGreaterThan(1);
    expect(frame.drawnScenes.indexOf(portal.scene)).toBeLessThan(frame.drawnScenes.lastIndexOf(portal.scene));
    expect(portal.camera).not.toBe(mainOf(frame)!.camera);
  });
});
