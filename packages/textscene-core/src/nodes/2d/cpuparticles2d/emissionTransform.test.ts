import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { godotAffineFromWorldMatrix, sameAffine } from './emissionTransform';
import { IDENTITY_AFFINE } from './simulate';

/** Build the three world matrix a Node2D chain produces, then read it back. */
function worldMatrixOf(
  transforms: Array<{ position?: [number, number]; rotation?: number; scale?: [number, number] }>
): THREE.Matrix4 {
  let leaf: THREE.Object3D | null = null;
  let root: THREE.Object3D | null = null;
  for (const t of transforms) {
    const object = new THREE.Object3D();
    // node2dTransform's conjugation: negate the Y translation and the rotation.
    object.position.set(t.position?.[0] ?? 0, 0 - (t.position?.[1] ?? 0), 0);
    object.rotation.z = 0 - (t.rotation ?? 0);
    object.scale.set(t.scale?.[0] ?? 1, t.scale?.[1] ?? 1, 1);
    if (leaf) leaf.add(object);
    else root = object;
    leaf = object;
  }
  root!.updateMatrixWorld(true);
  return leaf!.matrixWorld;
}

describe('godotAffineFromWorldMatrix', () => {
  it('reads back a pure translation with Y un-negated (happy path)', () => {
    const affine = godotAffineFromWorldMatrix(worldMatrixOf([{ position: [10, 20] }]));
    expect(affine.ox).toBeCloseTo(10, 6);
    expect(affine.oy).toBeCloseTo(20, 6);
    expect(affine.ax).toBeCloseTo(1, 6);
    expect(affine.by).toBeCloseTo(1, 6);
  });

  it('reads back a scale unchanged', () => {
    const affine = godotAffineFromWorldMatrix(worldMatrixOf([{ scale: [3, 0.5] }]));
    expect(affine.ax).toBeCloseTo(3, 6);
    expect(affine.by).toBeCloseTo(0.5, 6);
    expect(affine.ay).toBeCloseTo(0, 6);
    expect(affine.bx).toBeCloseTo(0, 6);
  });

  it('un-negates the rotation, so a Godot clockwise angle comes back clockwise', () => {
    const angle = 0.4;
    const affine = godotAffineFromWorldMatrix(worldMatrixOf([{ rotation: angle }]));
    // Godot's Transform2D from a rotation is columns (cos, sin), (-sin, cos).
    expect(affine.ax).toBeCloseTo(Math.cos(angle), 6);
    expect(affine.ay).toBeCloseTo(Math.sin(angle), 6);
    expect(affine.bx).toBeCloseTo(0 - Math.sin(angle), 6);
    expect(affine.by).toBeCloseTo(Math.cos(angle), 6);
  });

  it('composes a parent chain the way Godot composes global transforms', () => {
    const affine = godotAffineFromWorldMatrix(
      worldMatrixOf([{ position: [100, 50] }, { position: [-13, -35], scale: [0.6, 0.6] }])
    );
    expect(affine.ox).toBeCloseTo(87, 6);
    expect(affine.oy).toBeCloseTo(15, 6);
    expect(affine.ax).toBeCloseTo(0.6, 6);
    expect(affine.by).toBeCloseTo(0.6, 6);
  });

  it('reads the identity matrix as the identity affine (edge case)', () => {
    const affine = godotAffineFromWorldMatrix(new THREE.Matrix4());
    expect(affine).toEqual(IDENTITY_AFFINE);
  });
});

describe('sameAffine', () => {
  it('is true for two equal transforms', () => {
    expect(sameAffine({ ...IDENTITY_AFFINE }, { ...IDENTITY_AFFINE })).toBe(true);
  });

  it('is false when any single component differs', () => {
    for (const key of ['ax', 'ay', 'bx', 'by', 'ox', 'oy'] as const) {
      expect(sameAffine(IDENTITY_AFFINE, { ...IDENTITY_AFFINE, [key]: 9 })).toBe(false);
    }
  });
});
