/** A CanvasLayer publishes the frame its canvas draws through, which a light scales its height by. */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CanvasLayerScope } from './canvasLayerScope';
import { useCanvasFrame } from './canvasFrame';
import type { TscnNode } from '../parser/types';
import type { CanvasLayerProperties } from '../nodes/2d/ui/canvaslayer/types';

function layer(scale: number): TscnNode {
  const properties: CanvasLayerProperties = {
    name: 'Layer',
    canvasTransform: { a: scale, b: 0, c: 0, d: scale, tx: 40, ty: 0 },
    follow_viewport_enabled: false,
    follow_viewport_scale: 1,
  };
  return { name: 'Layer', type: 'CanvasLayer', children: [], rawProperties: {}, properties } as TscnNode;
}

describe('CanvasLayerScope', () => {
  it("publishes the layer's frame to the canvas inside", async () => {
    const frames: (THREE.Object3D | null)[] = [];
    function Probe() {
      frames.push(useCanvasFrame());
      return null;
    }
    const renderer = await ReactThreeTestRenderer.create(
      <CanvasLayerScope node={layer(2)}>
        <Probe />
      </CanvasLayerScope>
    );
    // What the renderer does ahead of each frame's draws.
    renderer.scene.instance.updateMatrixWorld();
    expect(new THREE.Vector3().setFromMatrixScale(frames.at(-1)!.matrixWorld).x).toBeCloseTo(2);
  });
});
