/**
 * The light pose a shadow radiates from.
 *
 * Godot builds the occluder cull rect from the cookie
 * (`RendererCanvasCull::_light_find_shadow`: `texture_size * texture_scale`,
 * offset by `texture_offset`) and radiates the shadow from the light node's own
 * origin, which `offset` does NOT move. These pin both halves of that split.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { sameShadowLight, sampleShadowLight } from './shadowLightPose';

/** A cookie quad of `size` at `offset`, under a CanvasItem group at `at`. */
function quadUnder(
  at: { x: number; y: number },
  offset: { x: number; y: number } = { x: 0, y: 0 },
  size = 200,
  transform: (group: THREE.Group) => void = () => {}
): THREE.Mesh {
  const root = new THREE.Group();
  const item = new THREE.Group();
  item.position.set(at.x, at.y, 0);
  transform(item);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size));
  mesh.position.set(offset.x, offset.y, 0);
  item.add(mesh);
  root.add(item);
  return mesh;
}

describe('sampleShadowLight', () => {
  it('takes the shadow origin from the light node, not the cookie centre', () => {
    const pose = sampleShadowLight(quadUnder({ x: 400, y: -324 }))!;
    expect(pose.x).toBe(400);
    expect(pose.y).toBe(-324);
  });

  it('bounds the rect by the cookie, which is what Godot culls occluders against', () => {
    const pose = sampleShadowLight(quadUnder({ x: 400, y: -324 }, { x: 0, y: 0 }, 1024))!;
    expect(pose.rect).toEqual({ minX: -112, minY: -836, maxX: 912, maxY: 188 });
  });

  it('moves the rect with offset but leaves the origin where the node is', () => {
    const pose = sampleShadowLight(quadUnder({ x: 0, y: 0 }, { x: 50, y: -20 }, 200))!;
    expect([pose.x, pose.y]).toEqual([0, 0]);
    expect(pose.rect).toEqual({ minX: -50, minY: -120, maxX: 150, maxY: 80 });
  });

  it('scales the rect with the node transform', () => {
    const pose = sampleShadowLight(quadUnder({ x: 0, y: 0 }, { x: 0, y: 0 }, 200, (g) =>
      g.scale.set(2, 0.5, 1)
    ))!;
    expect(pose.rect).toEqual({ minX: -200, minY: -50, maxX: 200, maxY: 50 });
  });

  it('bounds a rotated cookie by its corners, never by its edges', () => {
    // A 45° square's AABB grows by √2, so an axis-aligned box built from the
    // untransformed extents would under-cover it and cull a real occluder.
    const pose = sampleShadowLight(quadUnder({ x: 0, y: 0 }, { x: 0, y: 0 }, 200, (g) => {
      g.rotation.z = Math.PI / 4;
    }))!;
    expect(pose.rect.maxX).toBeCloseTo(100 * Math.SQRT2, 4);
    expect(pose.rect.minY).toBeCloseTo(-100 * Math.SQRT2, 4);
  });

  it('accumulates every ancestor transform, not just the immediate parent', () => {
    const mesh = quadUnder({ x: 100, y: -50 });
    (mesh.parent!.parent as THREE.Group).position.set(300, -90, 0);
    const pose = sampleShadowLight(mesh)!;
    expect([pose.x, pose.y]).toEqual([400, -140]);
  });

  it('is null for a quad that is not in a tree yet', () => {
    expect(sampleShadowLight(null)).toBeNull();
    expect(sampleShadowLight(new THREE.Mesh(new THREE.PlaneGeometry(1, 1)))).toBeNull();
  });

  it('is null for geometry with no bounds to take a rect from', () => {
    const mesh = quadUnder({ x: 0, y: 0 });
    mesh.geometry = new THREE.BufferGeometry();
    expect(sampleShadowLight(mesh)).toBeNull();
  });
});

describe('sameShadowLight', () => {
  const pose = () => sampleShadowLight(quadUnder({ x: 10, y: 20 }));

  it('holds for two samples of an unmoved light', () => {
    expect(sameShadowLight(pose(), pose())).toBe(true);
  });

  it('holds for two nulls, so an absent light republishes nothing', () => {
    expect(sameShadowLight(null, null)).toBe(true);
  });

  it('breaks when the light moves', () => {
    expect(sameShadowLight(pose(), sampleShadowLight(quadUnder({ x: 11, y: 20 })))).toBe(false);
  });

  it('breaks when only the reach changed', () => {
    const wider = sampleShadowLight(quadUnder({ x: 10, y: 20 }, { x: 0, y: 0 }, 400));
    expect(sameShadowLight(pose(), wider)).toBe(false);
  });

  it('breaks between a pose and no pose', () => {
    expect(sameShadowLight(pose(), null)).toBe(false);
    expect(sameShadowLight(null, pose())).toBe(false);
  });
});
