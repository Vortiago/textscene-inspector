import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Camera3DInWorld } from './Camera3DInWorld.testkit';
import type { TscnNode } from '../../../parser/types';
import type { Camera3DProperties } from './types';

import { instanceAs } from '../testing/reactThreeTestInstance';
import { Camera3DProjectionType, Camera3DKeepAspect } from '../../../godot/scene/camera3d';

function makeNode(overrides: Partial<Camera3DProperties> = {}): TscnNode {
  const base: Camera3DProperties = {
    name: 'MyCamera',
    projection: Camera3DProjectionType.PERSPECTIVE,
    fov: 75,
    size: 1,
    near: 0.05,
    far: 4000,
    keep_aspect: Camera3DKeepAspect.KEEP_HEIGHT,
    h_offset: 0,
    v_offset: 0,
    frustum_offset: { x: 0, y: 0 },
    current: false,
    cull_mask: 0xfffff,
    doppler_tracking: 0,
    ...overrides,
  };
  return {
    rawProperties: {},
    name: base.name ?? 'MyCamera',
    type: 'Camera3D',
    children: [],
    properties: base,
  };
}

describe('<Camera3D>', () => {
  it('renders a PerspectiveCamera for projection=0', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Camera3DInWorld node={makeNode()} />);
    const cameras = renderer.scene.findAllByType('PerspectiveCamera');
    expect(cameras.length).toBeGreaterThan(0);
  });

  it('renders an OrthographicCamera for projection=1', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Camera3DInWorld node={makeNode({ projection: Camera3DProjectionType.ORTHOGONAL, size: 5 })} />
    );
    const cameras = renderer.scene.findAllByType('OrthographicCamera');
    expect(cameras.length).toBeGreaterThan(0);
  });

  it('applies fov property to the perspective camera', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Camera3DInWorld node={makeNode({ fov: 60 })} />);
    const cam = renderer.scene.findByType('PerspectiveCamera');
    expect(instanceAs<THREE.PerspectiveCamera>(cam).fov).toBe(60);
  });

  it('clamps near to >= 0.001', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Camera3DInWorld node={makeNode({ near: 0 })} />);
    const cam = renderer.scene.findByType('PerspectiveCamera');
    expect(instanceAs<THREE.PerspectiveCamera>(cam).near).toBeGreaterThanOrEqual(0.001);
  });

  it('ensures far > near (adds 0.1 margin if needed)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Camera3DInWorld node={makeNode({ near: 10, far: 5 })} />
    );
    const cam = renderer.scene.findByType('PerspectiveCamera');
    const { near, far } = instanceAs<THREE.PerspectiveCamera>(cam);
    expect(far).toBeGreaterThan(near);
  });

  it('uses the node name on the camera object', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Camera3DInWorld node={makeNode({ name: 'MainCam' })} />
    );
    const cam = renderer.scene.findByProps({ name: 'MainCam' });
    expect(cam).toBeDefined();
  });

  it('applies orthographic size to left/right/top/bottom', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Camera3DInWorld node={makeNode({ projection: Camera3DProjectionType.ORTHOGONAL, size: 4 })} />
    );
    const cam = renderer.scene.findByType('OrthographicCamera');
    const o = instanceAs<THREE.OrthographicCamera>(cam);
    // Godot `size` is the full frustum height → half-extent = size/2.
    expect(o.top).toBe(2);
    expect(o.bottom).toBe(-2);
    // halfWidth = (size/2) * 16/9
    expect(o.right).toBeCloseTo(2 * (16 / 9), 5);
    expect(o.left).toBeCloseTo(-2 * (16 / 9), 5);
  });
});
