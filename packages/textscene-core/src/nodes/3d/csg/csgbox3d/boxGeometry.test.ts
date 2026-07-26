import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildCsgBoxGeometry } from './boxGeometry';

function build(size = { x: 2, y: 2, z: 2 }, flipFaces = false) {
  return buildCsgBoxGeometry({ size, flipFaces });
}

describe('buildCsgBoxGeometry', () => {
  it('emits twelve triangles, two per face', () => {
    expect(build().getAttribute('position').count / 3).toBe(12);
  });

  it('centres the box on the origin and halves the size per side', () => {
    const geometry = build({ x: 3, y: 0.2, z: 12 });
    geometry.computeBoundingBox();
    const b = geometry.boundingBox!;
    // Positions live in a Float32Array, so 0.1 is not exactly 0.1.
    for (const [actual, expected] of [
      [b.min.x, -1.5],
      [b.min.y, -0.1],
      [b.min.z, -6],
      [b.max.x, 1.5],
      [b.max.y, 0.1],
      [b.max.z, 6],
    ] as const) {
      expect(actual).toBeCloseTo(expected, 6);
    }
  });

  it('covers all six axis directions exactly once', () => {
    // The index trick that generates the faces is easy to get subtly wrong in a way
    // that duplicates one face and drops its opposite, which still looks like a box
    // from most angles.
    const geometry = build();
    const n = geometry.getAttribute('normal');
    const seen = new Set<string>();
    for (let i = 0; i < n.count; i++) {
      seen.add([n.getX(i), n.getY(i), n.getZ(i)].map((v) => Math.round(v)).join(','));
    }
    expect(seen).toEqual(
      new Set(['1,0,0', '-1,0,0', '0,1,0', '0,-1,0', '0,0,1', '0,0,-1'])
    );
  });

  it('keeps every face flat: a box has no smooth_faces property', () => {
    const geometry = build();
    const n = geometry.getAttribute('normal');
    for (let t = 0; t < 12; t++) {
      const a = new THREE.Vector3(n.getX(t * 3), n.getY(t * 3), n.getZ(t * 3));
      const b = new THREE.Vector3(n.getX(t * 3 + 1), n.getY(t * 3 + 1), n.getZ(t * 3 + 1));
      expect(a.distanceTo(b)).toBeLessThan(1e-6);
    }
  });

  it('negates every normal when flip_faces is on', () => {
    const plain = build().getAttribute('normal');
    const flipped = build({ x: 2, y: 2, z: 2 }, true).getAttribute('normal');
    for (let i = 0; i < plain.count; i++) {
      expect(flipped.getX(i)).toBeCloseTo(-plain.getX(i), 6);
      expect(flipped.getY(i)).toBeCloseTo(-plain.getY(i), 6);
      expect(flipped.getZ(i)).toBeCloseTo(-plain.getZ(i), 6);
    }
  });

  it('produces an outward-facing solid, not an inside-out one', () => {
    // Each face's normal must point away from the centre; getting the winding
    // conversion backwards inverts the whole box and it renders as its own interior.
    const geometry = build();
    const p = geometry.getAttribute('position');
    const n = geometry.getAttribute('normal');
    for (let i = 0; i < p.count; i++) {
      const position = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
      const normal = new THREE.Vector3(n.getX(i), n.getY(i), n.getZ(i));
      expect(position.dot(normal)).toBeGreaterThan(0);
    }
  });
});
