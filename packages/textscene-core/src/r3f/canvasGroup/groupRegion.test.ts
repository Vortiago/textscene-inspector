/** The texel region a clipping group copies and draws in. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { clipRegions } from './groupRegion';
import type { KeyedScene } from './keyedScene';

const FRAME = { width: 64, height: 32, texture: new THREE.Texture() };
const camera = new THREE.OrthographicCamera();
const group = { window: { own: 10, from: 10, to: 20 } };
const NO_BOXES = new Map<typeof group, THREE.Box3[]>();

function scene(boxes: (THREE.Box3 | null)[], keys: number[]): KeyedScene {
  return { boxes, keys } as unknown as KeyedScene;
}

function box(x0: number, y0: number, x1: number, y1: number): THREE.Box3 {
  return new THREE.Box3(new THREE.Vector3(x0, y0, 0), new THREE.Vector3(x1, y1, 0));
}

describe('clipRegions', () => {
  it('pads the pixels of the boxes in the window by the clear margin and a texel', () => {
    const region = clipRegions(scene([box(-0.25, -0.25, 0.25, 0.25)], [11]), NO_BOXES, camera, FRAME, [
      group,
    ]);

    expect(region).toEqual([{ x: 18, y: 6, width: 28, height: 20 }]);
  });

  it('answers an empty region for a group with no box in the frame', () => {
    const region = clipRegions(scene([box(-0.25, -0.25, 0.25, 0.25)], [50]), NO_BOXES, camera, FRAME, [
      group,
    ]);

    expect(region).toEqual([{ x: 0, y: 0, width: 0, height: 0 }]);
  });

  it('stays inside the frame', () => {
    const region = clipRegions(scene([box(-5, -5, 5, 5)], [11]), NO_BOXES, camera, FRAME, [group]);

    expect(region).toEqual([{ x: 0, y: 0, width: 64, height: 32 }]);
  });
});
