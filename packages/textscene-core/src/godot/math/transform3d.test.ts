import { describe, expect, it } from 'vitest';
import { identityTransform3D } from './transform3d.js';

describe('identityTransform3D', () => {
  it('holds the identity basis rows and a zero origin', () => {
    expect(identityTransform3D()).toEqual({
      basis_x: { x: 1, y: 0, z: 0 },
      basis_y: { x: 0, y: 1, z: 0 },
      basis_z: { x: 0, y: 0, z: 1 },
      origin: { x: 0, y: 0, z: 0 },
    });
  });

  it('returns a fresh value each call, so a caller may mutate it (edge case)', () => {
    const first = identityTransform3D();
    first.origin.x = 5;
    expect(identityTransform3D().origin.x).toBe(0);
  });
});
