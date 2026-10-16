/**
 * Strict-verification harness for Camera3D's projection-related properties.
 */

import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Camera3D } from './Component';
import type { TscnNode } from '../../../parser/types';
import type { Camera3DProperties } from './types';
import { ProjectionMode, KeepAspectMode } from './types';
import { instanceAs } from '../testing/reactThreeTestInstance';

function makeNode(overrides: Partial<Camera3DProperties> = {}): TscnNode {
  const base: Camera3DProperties = {
    name: 'Cam',
    projection: ProjectionMode.PROJECTION_PERSPECTIVE,
    fov: 75,
    size: 1,
    near: 0.05,
    far: 4000,
    keep_aspect: KeepAspectMode.KEEP_HEIGHT,
    h_offset: 0,
    v_offset: 0,
    frustum_offset: { x: 0, y: 0 },
    current: false,
    cull_mask: 0xfffff,
    doppler_tracking: 0,
    ...overrides,
  };
  return { rawProperties: {}, name: base.name ?? 'Cam', type: 'Camera3D', children: [], properties: base };
}

describe('Camera3D projection (assertions 60–66)', () => {
  it('#60 fov → PerspectiveCamera.fov', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Camera3D node={makeNode({ fov: 60 })} />);
    const cam = renderer.scene.findByType('PerspectiveCamera');
    expect(instanceAs<THREE.PerspectiveCamera>(cam).fov).toBe(60);
  });

  it('#61 near → camera.near (clamped to >= 0.001)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Camera3D node={makeNode({ near: 0.1 })} />);
    const cam = renderer.scene.findByType('PerspectiveCamera');
    expect(instanceAs<THREE.PerspectiveCamera>(cam).near).toBe(0.1);
  });

  it('#62 far → camera.far', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Camera3D node={makeNode({ near: 0.1, far: 500 })} />
    );
    const cam = renderer.scene.findByType('PerspectiveCamera');
    expect(instanceAs<THREE.PerspectiveCamera>(cam).far).toBe(500);
  });

  it('#63 projection=1 (ORTHOGRAPHIC) → OrthographicCamera used, not PerspectiveCamera', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Camera3D node={makeNode({ projection: ProjectionMode.PROJECTION_ORTHOGONAL, size: 5 })} />
    );
    expect(renderer.scene.findAllByType('OrthographicCamera').length).toBeGreaterThan(0);
    expect(renderer.scene.findAllByType('PerspectiveCamera').length).toBe(0);
  });

  it('#64 projection=0 (PERSPECTIVE) → PerspectiveCamera used', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Camera3D node={makeNode({ projection: ProjectionMode.PROJECTION_PERSPECTIVE })} />
    );
    expect(renderer.scene.findAllByType('PerspectiveCamera').length).toBeGreaterThan(0);
    expect(renderer.scene.findAllByType('OrthographicCamera').length).toBe(0);
  });

  it('#65 size (ortho) → OrthographicCamera frustum width matches', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Camera3D node={makeNode({ projection: ProjectionMode.PROJECTION_ORTHOGONAL, size: 4 })} />
    );
    const cam = renderer.scene.findByType('OrthographicCamera');
    const o = instanceAs<THREE.OrthographicCamera>(cam);
    // Godot `size` is the full frustum height (diameter) → half-extent = size/2.
    expect(o.top).toBe(2);
    expect(o.bottom).toBe(-2);
    expect(o.right).toBeCloseTo(2 * (16 / 9), 5);
    expect(o.left).toBeCloseTo(-2 * (16 / 9), 5);
  });

  it('#66 keep_aspect KEEP_WIDTH vs KEEP_HEIGHT → aspect correction applied', async () => {
    // KEEP_WIDTH changes the framing relative to KEEP_HEIGHT: at the same size the two modes
    // render different left/right values.
    const widthRenderer = await ReactThreeTestRenderer.create(
      <Camera3D
        node={makeNode({
          projection: ProjectionMode.PROJECTION_ORTHOGONAL,
          size: 4,
          keep_aspect: KeepAspectMode.KEEP_WIDTH,
        })}
      />
    );
    const heightRenderer = await ReactThreeTestRenderer.create(
      <Camera3D
        node={makeNode({
          projection: ProjectionMode.PROJECTION_ORTHOGONAL,
          size: 4,
          keep_aspect: KeepAspectMode.KEEP_HEIGHT,
        })}
      />
    );
    const widthCam = instanceAs<THREE.OrthographicCamera>(
      widthRenderer.scene.findByType('OrthographicCamera')
    );
    const heightCam = instanceAs<THREE.OrthographicCamera>(
      heightRenderer.scene.findByType('OrthographicCamera')
    );
    // Different keep_aspect modes should produce different frustums at the
    // same `size`. If this fails, keep_aspect is being ignored.
    expect(widthCam.right === heightCam.right && widthCam.top === heightCam.top).toBe(false);
  });

  it('rebuilds the projection when `size` changes', async () => {
    const orthographic = (size: number) =>
      makeNode({ projection: ProjectionMode.PROJECTION_ORTHOGONAL, size });
    const renderer = await ReactThreeTestRenderer.create(<Camera3D node={orthographic(8)} />);
    await renderer.update(<Camera3D node={orthographic(2)} />);
    const o = instanceAs<THREE.OrthographicCamera>(renderer.scene.findByType('OrthographicCamera'));
    expect(o.projectionMatrix.elements[5]).toBeCloseTo(2 / 2, 6);
  });

  it('builds the perspective projection matrix from `fov`', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Camera3D node={makeNode({ fov: 90 })} />);
    const p = instanceAs<THREE.PerspectiveCamera>(renderer.scene.findByType('PerspectiveCamera'));
    // A perspective matrix scales y by 1 / tan(fovy / 2), and tan(45°) is 1.
    expect(p.projectionMatrix.elements[5]).toBeCloseTo(1, 6);
  });
});
