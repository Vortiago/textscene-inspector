import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { decomposeForR3F, node3dGroupSpread } from './nodeTransform';
import { parseTransform3D } from '../utils/transform';

const SHEARED = parseTransform3D(
  'Transform3D(0.835518, 0.307015, 0, -0.529877, 1.08924, 0, 0, 0, 1, 0.666667, 0.5, 0)'
);
const ROTATED_AND_SCALED = parseTransform3D('Transform3D(0, -2, 0, 3, 0, 0, 0, 0, -1, 1, 2, 3)');

describe('decomposeForR3F', () => {
  it('carries a sheared basis as the exact matrix, rows as Godot stores them', () => {
    const { matrix } = decomposeForR3F(SHEARED);
    expect(matrix).toBeDefined();
    expect(matrix!.toArray()).toEqual(
      new THREE.Matrix4()
        .set(0.835518, 0.307015, 0, 0.666667, -0.529877, 1.08924, 0, 0.5, 0, 0, 1, 0, 0, 0, 0, 1)
        .toArray()
    );
  });

  it('leaves the matrix out for a rotation with a non-uniform scale', () => {
    expect(decomposeForR3F(ROTATED_AND_SCALED).matrix).toBeUndefined();
  });

  it('leaves the matrix out for an absent transform', () => {
    expect(decomposeForR3F(undefined).matrix).toBeUndefined();
  });
});

describe('node3dGroupSpread', () => {
  it('spreads the discrete parts when there is no shear', () => {
    const spread = node3dGroupSpread(decomposeForR3F(ROTATED_AND_SCALED));
    expect(Object.keys(spread).sort()).toEqual(['position', 'rotation', 'scale']);
  });

  it('spreads the matrix with matrixAutoUpdate off when there is a shear', () => {
    const spread = node3dGroupSpread(decomposeForR3F(SHEARED));
    expect(Object.keys(spread).sort()).toEqual(['matrix', 'matrixAutoUpdate']);
    expect(spread).toMatchObject({ matrixAutoUpdate: false });
  });
});
