/**
 * A SubViewport's canvas is a root of its own: a CanvasLayer around the SubViewport carries neither
 * its layer index nor its frame into it, so a light inside places itself on the viewport's canvas.
 * The lights inside sit under the viewport's own light pass, so the test reads the hook they call.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';

import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { TscnParser } from '../../../parser/TscnParser';
import { underWhiteCanvasLighting } from '../../../r3f/lighting2d/testing/whiteCanvasLighting';
import { CanvasFrameContext, useCanvasFrame } from '../../../r3f/canvasFrame';
import { CanvasLayerIndexProvider, useCanvasLayerIndex } from '../../../r3f/lighting2d/canvasItemPlacement';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { settleLoads } from '../../../r3f/testing/settleLoads';
import { COOKIE, cookieLoader, ViewportPassStack } from './viewportPasses.testkit';

import '../../../r3f/nodes/index';

/** The canvas each light placed itself on, by the light's height. */
const canvasesByHeight = vi.hoisted(() => new Map<number, { frame: unknown; layer: number }>());

vi.mock('../../../r3f/lighting2d/apartLight', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../r3f/lighting2d/apartLight')>();
  return {
    ...actual,
    useApartLightOrigin: (_ordinal: number | null, _place: unknown, height: number) => {
      canvasesByHeight.set(height, { frame: useCanvasFrame(), layer: useCanvasLayerIndex() });
      return () => {};
    },
  };
});

const SCENE = `[gd_scene format=3]
[ext_resource type="Texture2D" path="${COOKIE}" id="1"]
[node name="Root" type="Node2D"]

[node name="Outer" type="PointLight2D" parent="."]
texture = ExtResource("1")
height = 10.0

[node name="Viewport" type="SubViewport" parent="."]
size = Vector2i(200, 150)

[node name="Inner" type="PointLight2D" parent="Viewport"]
texture = ExtResource("1")
height = 20.0
`;

async function renderUnderLayer(frame: THREE.Object3D, layer: number) {
  const parsed = new TscnParser().parse(SCENE);
  await ReactThreeTestRenderer.create(
    <SceneStack workspace="2d" loader={cookieLoader()} scene={parsed}>
      <ViewportPassStack captured={{ current: null }}>
        <CanvasLayerIndexProvider value={layer}>
          <CanvasFrameContext.Provider value={frame}>
            {underWhiteCanvasLighting(<NodeDispatcher nodes={parsed.nodes} />)}
          </CanvasFrameContext.Provider>
        </CanvasLayerIndexProvider>
      </ViewportPassStack>
    </SceneStack>
  );
  await settleLoads();
}

describe('a SubViewport under a CanvasLayer', () => {
  it("hands the lights around it the layer's frame, and the lights inside it none", async () => {
    const frame = new THREE.Object3D();
    await renderUnderLayer(frame, 2);
    expect(canvasesByHeight.get(10)!.frame).toBe(frame);
    expect(canvasesByHeight.get(20)!.frame).toBeNull();
  });

  it("puts the lights inside it on the viewport's own canvas layer", async () => {
    await renderUnderLayer(new THREE.Object3D(), 2);
    expect(canvasesByHeight.get(10)!.layer).toBe(2);
    expect(canvasesByHeight.get(20)!.layer).toBe(0);
  });
});
