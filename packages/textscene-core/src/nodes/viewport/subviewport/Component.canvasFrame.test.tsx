/**
 * A SubViewport's canvas is a root of its own: a CanvasLayer frame around the SubViewport carries
 * no canvas transform into it, so a light inside places itself in the viewport's own frame.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';

import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../../../parser/TscnParser';
import { ViewportTextureProvider } from '../../../r3f/contexts/ViewportTextureContext';
import { ViewportPassProvider } from '../../../r3f/contexts/ViewportPassRegistryContext';
import { CanvasLighting2DProvider } from '../../../r3f/lighting2d/CanvasLighting2D';
import { CanvasFrameContext, useCanvasFrame } from '../../../r3f/canvasFrame';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { settleLoads } from '../../../r3f/testing/settleLoads';

import '../../../r3f/nodes/index';

/** The frame each light read when it handed the pass its origin, by the light's height. */
const framesByHeight = vi.hoisted(() => new Map<number, unknown>());

vi.mock('../../../r3f/lighting2d/apartLight', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../r3f/lighting2d/apartLight')>();
  return {
    ...actual,
    useApartLightOrigin: (_ordinal: number | null, _place: unknown, height: number) => {
      framesByHeight.set(height, useCanvasFrame());
      return () => {};
    },
  };
});

const COOKIE = 'res://light.png';

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

describe('a SubViewport under a canvas frame', () => {
  it('hands the lights inside it no frame, and the lights around it the frame', async () => {
    const parsed = new TscnParser().parse(SCENE);
    const fake = createFakeResourceLoader();
    const texture = new THREE.Texture();
    (texture as unknown as { image: object }).image = { width: 64, height: 64 };
    fake.textures.seed(COOKIE, texture);
    const frame = new THREE.Object3D();
    await ReactThreeTestRenderer.create(
      <SceneStack workspace="2d" loader={fake.loader} scene={parsed}>
        <ViewportTextureProvider>
          <ViewportPassProvider>
            <CanvasFrameContext.Provider value={frame}>
              <CanvasLighting2DProvider canvasModulate={{ r: 1, g: 1, b: 1, a: 1 }}>
                <NodeDispatcher nodes={parsed.nodes} />
              </CanvasLighting2DProvider>
            </CanvasFrameContext.Provider>
          </ViewportPassProvider>
        </ViewportTextureProvider>
      </SceneStack>
    );
    await settleLoads();
    expect(framesByHeight.get(10)).toBe(frame);
    expect(framesByHeight.get(20)).toBeNull();
  });
});
