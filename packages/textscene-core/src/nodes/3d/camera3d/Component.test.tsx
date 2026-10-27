import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Camera3D } from './Component';
import { makeCameraNode } from './cameraNode.testkit';

import { instanceAs } from '../testing/reactThreeTestInstance';
import { Camera3DProjectionType } from '../../../godot/scene/camera3d';

describe('<Camera3D>', () => {
  it('renders a PerspectiveCamera for projection=0', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Camera3D node={makeCameraNode()} />);
    const cameras = renderer.scene.findAllByType('PerspectiveCamera');
    expect(cameras.length).toBeGreaterThan(0);
  });

  it('renders an OrthographicCamera for projection=1', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Camera3D node={makeCameraNode({ projection: Camera3DProjectionType.ORTHOGONAL, size: 5 })} />
    );
    const cameras = renderer.scene.findAllByType('OrthographicCamera');
    expect(cameras.length).toBeGreaterThan(0);
  });

  it('applies fov property to the perspective camera', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Camera3D node={makeCameraNode({ fov: 60 })} />);
    const cam = renderer.scene.findByType('PerspectiveCamera');
    expect(instanceAs<THREE.PerspectiveCamera>(cam).fov).toBe(60);
  });

  it('clamps near to >= 0.001', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Camera3D node={makeCameraNode({ near: 0 })} />);
    const cam = renderer.scene.findByType('PerspectiveCamera');
    expect(instanceAs<THREE.PerspectiveCamera>(cam).near).toBeGreaterThanOrEqual(0.001);
  });

  it('ensures far > near (adds 0.1 margin if needed)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Camera3D node={makeCameraNode({ near: 10, far: 5 })} />
    );
    const cam = renderer.scene.findByType('PerspectiveCamera');
    const { near, far } = instanceAs<THREE.PerspectiveCamera>(cam);
    expect(far).toBeGreaterThan(near);
  });

  it('uses the node name on the camera object', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Camera3D node={makeCameraNode({ name: 'MainCam' })} />
    );
    const cam = renderer.scene.findByProps({ name: 'MainCam' });
    expect(cam).toBeDefined();
  });

  it('applies orthographic size to left/right/top/bottom', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Camera3D node={makeCameraNode({ projection: Camera3DProjectionType.ORTHOGONAL, size: 4 })} />
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
