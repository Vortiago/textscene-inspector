/**
 * Parity: Camera3D projection vs Godot.
 * - Orthographic `size` is the FULL frustum dimension (diameter), so the
 *   half-extent is size/2 (Godot's Projection::set_orthogonal divides by 2).
 * - With keep_aspect = KEEP_WIDTH on a perspective camera, the stored `fov`
 *   is the HORIZONTAL fov; three.js wants vertical, so it must be converted.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Camera3D } from './Component';
import { ProjectionMode, KeepAspectMode } from './types';
import type { TscnNode } from '../../../parser/types';

function makeNode(props: Record<string, unknown> = {}): TscnNode {
  return {
    name: 'Cam',
    type: 'Camera3D',
    children: [],
    properties: { name: 'Cam', fov: 75, size: 1, near: 0.05, far: 4000, ...props } as TscnNode['properties'],
  };
}

const DEFAULT_ASPECT = 16 / 9;

describe('Camera3D projection parity', () => {
  it('orthographic size is the full dimension → half-extent = size/2', async () => {
    const r = await ReactThreeTestRenderer.create(
      <Camera3D node={makeNode({ projection: ProjectionMode.PROJECTION_ORTHOGONAL, size: 4 })} />
    );
    const o = r.scene.findByType('OrthographicCamera').instance as THREE.OrthographicCamera;
    expect(o.top).toBeCloseTo(2, 5); // size 4 → half-height 2
    expect(o.bottom).toBeCloseTo(-2, 5);
  });

  it('perspective fov with KEEP_WIDTH is converted from horizontal to vertical', async () => {
    const r = await ReactThreeTestRenderer.create(
      <Camera3D node={makeNode({ fov: 90, keep_aspect: KeepAspectMode.KEEP_WIDTH })} />
    );
    const cam = r.scene.findByType('PerspectiveCamera').instance as THREE.PerspectiveCamera;
    const expectedVertical =
      (2 * Math.atan(Math.tan((90 * Math.PI) / 180 / 2) / DEFAULT_ASPECT) * 180) / Math.PI;
    expect(cam.fov).toBeCloseTo(expectedVertical, 3);
    expect(cam.fov).toBeLessThan(90); // vertical fov is narrower than the horizontal
  });

  it('perspective fov with KEEP_HEIGHT (default) is used verbatim', async () => {
    const r = await ReactThreeTestRenderer.create(
      <Camera3D node={makeNode({ fov: 60, keep_aspect: KeepAspectMode.KEEP_HEIGHT })} />
    );
    const cam = r.scene.findByType('PerspectiveCamera').instance as THREE.PerspectiveCamera;
    expect(cam.fov).toBe(60);
  });
});
