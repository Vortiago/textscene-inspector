/**
 * Strict-verification harness (WI-R3F-9, group G) — 7 assertions covering
 * Camera3D projection-related properties.
 *
 * Assertions: 60–66 of `docs/archive/STRICT-VERIFICATION.md`.
 */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Camera3D } from './Component';
import type { TscnNode } from '../../../parser/types';
import type { Camera3DProperties } from './types';
import { ProjectionMode, KeepAspectMode } from './types';

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
  return { name: base.name ?? 'Cam', type: 'Camera3D', children: [], properties: base };
}

describe('Camera3D projection (assertions 60–66)', () => {
  it('#60 fov → PerspectiveCamera.fov', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Camera3D node={makeNode({ fov: 60 })} />
    );
    const cam = renderer.scene.findByType('PerspectiveCamera');
    expect((cam.instance as { fov: number }).fov).toBe(60);
  });

  it('#61 near → camera.near (clamped to >= 0.001)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Camera3D node={makeNode({ near: 0.1 })} />
    );
    const cam = renderer.scene.findByType('PerspectiveCamera');
    expect((cam.instance as { near: number }).near).toBe(0.1);
  });

  it('#62 far → camera.far', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Camera3D node={makeNode({ near: 0.1, far: 500 })} />
    );
    const cam = renderer.scene.findByType('PerspectiveCamera');
    expect((cam.instance as { far: number }).far).toBe(500);
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
      <Camera3D
        node={makeNode({ projection: ProjectionMode.PROJECTION_ORTHOGONAL, size: 4 })}
      />
    );
    const cam = renderer.scene.findByType('OrthographicCamera');
    const o = cam.instance as { top: number; bottom: number; left: number; right: number };
    // Godot `size` is the full frustum height (diameter) → half-extent = size/2.
    expect(o.top).toBe(2);
    expect(o.bottom).toBe(-2);
    expect(o.right).toBeCloseTo(2 * (16 / 9), 5);
    expect(o.left).toBeCloseTo(-2 * (16 / 9), 5);
  });

  it('#66 keep_aspect KEEP_WIDTH vs KEEP_HEIGHT → aspect correction applied', async () => {
    // KEEP_WIDTH should change the framing relative to KEEP_HEIGHT. The
    // current implementation uses a fixed 16:9 aspect and does not branch
    // on keep_aspect. This assertion catches that gap by rendering both
    // modes and expecting a different left/right value when KEEP_WIDTH is
    // requested at the same size.
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
    const widthCam = widthRenderer.scene.findByType('OrthographicCamera').instance as {
      right: number;
      top: number;
    };
    const heightCam = heightRenderer.scene.findByType('OrthographicCamera').instance as {
      right: number;
      top: number;
    };
    // Different keep_aspect modes should produce different frustums at the
    // same `size`. If this fails, keep_aspect is being ignored.
    expect(widthCam.right === heightCam.right && widthCam.top === heightCam.top).toBe(false);
  });
});
