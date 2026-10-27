/**
 * Parity of the Camera3D projection with Godot. Orthographic `size` is the full frustum dimension
 * (diameter), so the half-extent is size/2 (Projection::set_orthogonal divides by 2). With
 * keep_aspect = KEEP_WIDTH on a perspective camera the stored `fov` is horizontal, and three.js
 * wants vertical, so it is converted.
 */
import { describe, it, expect } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Camera3DInWorld } from './Camera3DInWorld.testkit';

import type { TscnNode } from '../../../parser/types';
import { instanceAs } from '../testing/reactThreeTestInstance';
import { Camera3DProjectionType, Camera3DKeepAspect } from '../../../godot/scene/camera3d';

function makeNode(props: Record<string, unknown> = {}): TscnNode {
  return {
    rawProperties: {},
    name: 'Cam',
    type: 'Camera3D',
    children: [],
    properties: { name: 'Cam', fov: 75, size: 1, near: 0.05, far: 4000, ...props } as TscnNode['properties'],
  };
}

describe('Camera3D projection parity', () => {
  it('orthographic size is the full dimension → half-extent = size/2', async () => {
    const r = await ReactThreeTestRenderer.create(
      <Camera3DInWorld node={makeNode({ projection: Camera3DProjectionType.ORTHOGONAL, size: 4 })} />
    );
    const o = instanceAs<THREE.OrthographicCamera>(r.scene.findByType('OrthographicCamera'));
    expect(o.top).toBeCloseTo(2, 5); // size 4 → half-height 2
    expect(o.bottom).toBeCloseTo(-2, 5);
  });

  it('perspective fov with KEEP_WIDTH is converted from horizontal to vertical', async () => {
    const r = await ReactThreeTestRenderer.create(
      <Camera3DInWorld node={makeNode({ fov: 90, keep_aspect: Camera3DKeepAspect.KEEP_WIDTH })} />
    );
    const cam = instanceAs<THREE.PerspectiveCamera>(r.scene.findByType('PerspectiveCamera'));
    expect(cam.fov).toBeCloseTo(58.7155, 3);
    expect(cam.fov).toBeLessThan(90); // vertical fov is narrower than the horizontal
  });

  it('perspective fov with KEEP_WIDTH rounds as Projection::get_fovy does', async () => {
    // Dividing by the aspect and multiplying by 180 last gives ...277; Godot's expression gives ...273.
    const r = await ReactThreeTestRenderer.create(
      <Camera3DInWorld node={makeNode({ fov: 31, keep_aspect: Camera3DKeepAspect.KEEP_WIDTH })} />
    );
    const cam = instanceAs<THREE.PerspectiveCamera>(r.scene.findByType('PerspectiveCamera'));
    expect(cam.fov).toBe(17.732799010746273);
  });

  it('perspective fov with KEEP_HEIGHT (default) is used verbatim', async () => {
    const r = await ReactThreeTestRenderer.create(
      <Camera3DInWorld node={makeNode({ fov: 60, keep_aspect: Camera3DKeepAspect.KEEP_HEIGHT })} />
    );
    const cam = instanceAs<THREE.PerspectiveCamera>(r.scene.findByType('PerspectiveCamera'));
    expect(cam.fov).toBe(60);
  });
});
