import { describe, expect, it } from 'vitest';
import type { TreeCamera } from './sceneRuntime';
import { ViewportCameras } from './viewportCameras';

const camera3D = (name: string): TreeCamera => ({
  path: `Main/${name}`,
  dimension: '3D',
  viewport: null,
  rawProperties: {},
});

/** Cameras over a tree the test swaps, as a load that adds or drops a camera swaps it. */
function camerasOver(initial: readonly TreeCamera[]) {
  let tree = initial;
  const cameras = new ViewportCameras({ cameras: () => tree, enabledText: () => undefined }, () => {});
  return { cameras, swapTree: (next: readonly TreeCamera[]) => (tree = next) };
}

describe('ViewportCameras', () => {
  it('hands a leaving current Camera3D over to the next camera (camera_3d.cpp:215-219)', () => {
    const [a, b, c] = [camera3D('A'), camera3D('B'), camera3D('C')];
    const { cameras, swapTree } = camerasOver([a, b, c]);
    cameras.makeCurrent3D(b.path);
    swapTree([a, c]);
    expect(cameras.camera3D(null)).toBe(a.path);
  });

  it('leaves no current Camera3D when the last one leaves (edge case)', () => {
    const a = camera3D('A');
    const { cameras, swapTree } = camerasOver([a]);
    cameras.makeCurrent3D(a.path);
    swapTree([]);
    expect(cameras.camera3D(null)).toBeNull();
  });

  it('throws for a path no camera of the tree holds', () => {
    const { cameras } = camerasOver([camera3D('A')]);
    expect(() => cameras.makeCurrent3D('Main/Missing')).toThrow(
      'expected a camera inside the tree at Main/Missing, found none'
    );
  });
});
