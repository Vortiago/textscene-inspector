/**
 * A SubViewport's canvas runs the same frame steps as the root canvas: it samples its shadow inputs
 * inside its own pass, after the animation tick of the frame it draws.
 */
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';

import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { COOKIE, cookieLoader, ViewportPassStack } from './viewportPasses.testkit';
import { TscnParser } from '../../../parser/TscnParser';
import { underWhiteCanvasLighting } from '../../../r3f/lighting2d/testing/whiteCanvasLighting';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { settleLoads } from '../../../r3f/testing/settleLoads';
import { advanceFrameWithStubbedGl } from '../../../r3f/testing/stubbedGl';
import {
  TICK_STEP,
  TickedLightProbe,
  UNMOVED_LEFT,
  type PoseReading,
} from '../../../r3f/testing/tickedLightProbe';

import '../../../r3f/nodes/index';

const reading: PoseReading = { left: null };

// No other test uses the 'TickedLightProbe' type, so the registration stays.
nodeComponentRegistry.register({
  typeName: 'TickedLightProbe',
  Component: () => <TickedLightProbe reading={reading} />,
  canvasItem: true,
});

const SCENE = `[gd_scene format=3]
[ext_resource type="Texture2D" path="${COOKIE}" id="1"]
[node name="Root" type="Node2D"]

[node name="Viewport" type="SubViewport" parent="."]
render_target_update_mode = 4
size = Vector2i(200, 150)

[node name="Floor" type="Polygon2D" parent="Viewport"]
polygon = PackedVector2Array(0, 0, 200, 0, 200, 150, 0, 150)

[node name="Lamp" type="PointLight2D" parent="Viewport"]
texture = ExtResource("1")

[node name="Probe" type="TickedLightProbe" parent="Viewport"]
`;

describe('a SubViewport canvas frame', () => {
  it("samples a light's shadow pose after the animation tick of the frame it draws", async () => {
    const parsed = new TscnParser().parse(SCENE);
    const captured: { current: THREE.WebGLRenderer | null } = { current: null };
    const renderer = await ReactThreeTestRenderer.create(
      <SceneStack workspace="2d" loader={cookieLoader()} scene={parsed}>
        <ViewportPassStack captured={captured}>
          {underWhiteCanvasLighting(<NodeDispatcher nodes={parsed.nodes} />)}
        </ViewportPassStack>
      </SceneStack>
    );
    await settleLoads();
    expect(reading.left).toBe(UNMOVED_LEFT);

    // The pose is React state, so the frame's update flushes inside `act`.
    await act(() => advanceFrameWithStubbedGl(renderer, captured.current!));

    expect(reading.left).toBe(UNMOVED_LEFT + TICK_STEP);
  });
});
