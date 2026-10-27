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

  it('is negative for a mirrored box, whose faces front inward', () => {
    expect(enclosedVolume(box().scale(-1, 1, 1))).toBeCloseTo(-24, 9);
  });
});
