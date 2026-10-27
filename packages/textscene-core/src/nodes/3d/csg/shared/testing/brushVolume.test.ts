import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { enclosedVolume } from './brushVolume';

/** A 2 × 3 × 4 box, offset from the origin so no tetrahedron is degenerate by symmetry. */
const box = () => new THREE.BoxGeometry(2, 3, 4).translate(5, -1, 2);

describe('enclosedVolume', () => {
  it('measures an indexed box as its width times its height times its depth', () => {
    expect(enclosedVolume(box())).toBeCloseTo(24, 9);
  });

  it('measures a non-indexed box the same', () => {
    expect(enclosedVolume(box().toNonIndexed())).toBeCloseTo(24, 9);
  });

  it('is negative for a box turned inside out', () => {
    const inverted = box();
    const index = inverted.getIndex()!;
    for (let i = 0; i < index.count; i += 3) {
      const second = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, second);
    }

    expect(enclosedVolume(inverted)).toBeCloseTo(-24, 9);
  });
});
