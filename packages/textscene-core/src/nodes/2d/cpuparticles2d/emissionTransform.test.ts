import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { godotTransform2DFromWorldMatrix, sameTransform2D } from './emissionTransform';
import { TRANSFORM2D_IDENTITY } from '../../../godot/transform2d.js';

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

describe('godotTransform2DFromWorldMatrix', () => {
  it('reads back a pure translation with Y un-negated (happy path)', () => {
    const transform = godotTransform2DFromWorldMatrix(worldMatrixOf([{ position: [10, 20] }]));
    expect(transform.tx).toBeCloseTo(10, 6);
    expect(transform.ty).toBeCloseTo(20, 6);
    expect(transform.a).toBeCloseTo(1, 6);
    expect(transform.d).toBeCloseTo(1, 6);
  });

  it('reads back a scale unchanged', () => {
    const transform = godotTransform2DFromWorldMatrix(worldMatrixOf([{ scale: [3, 0.5] }]));
    expect(transform.a).toBeCloseTo(3, 6);
    expect(transform.d).toBeCloseTo(0.5, 6);
    expect(transform.b).toBeCloseTo(0, 6);
    expect(transform.c).toBeCloseTo(0, 6);
  });

  it('un-negates the rotation, so a Godot clockwise angle comes back clockwise', () => {
    const angle = 0.4;
    const transform = godotTransform2DFromWorldMatrix(worldMatrixOf([{ rotation: angle }]));
    // Godot's Transform2D from a rotation is columns (cos, sin), (-sin, cos).
    expect(transform.a).toBeCloseTo(Math.cos(angle), 6);
    expect(transform.b).toBeCloseTo(Math.sin(angle), 6);
    expect(transform.c).toBeCloseTo(0 - Math.sin(angle), 6);
    expect(transform.d).toBeCloseTo(Math.cos(angle), 6);
  });

  it('composes a parent chain the way Godot composes global transforms', () => {
    const transform = godotTransform2DFromWorldMatrix(
      worldMatrixOf([{ position: [100, 50] }, { position: [-13, -35], scale: [0.6, 0.6] }])
    );
    expect(transform.tx).toBeCloseTo(87, 6);
    expect(transform.ty).toBeCloseTo(15, 6);
    expect(transform.a).toBeCloseTo(0.6, 6);
    expect(transform.d).toBeCloseTo(0.6, 6);
  });

  it('reads the identity matrix as the identity transform (edge case)', () => {
    const transform = godotTransform2DFromWorldMatrix(new THREE.Matrix4());
    expect(transform).toEqual(TRANSFORM2D_IDENTITY);
  });
});

describe('sameTransform2D', () => {
  it('is true for two equal transforms', () => {
    expect(sameTransform2D({ ...TRANSFORM2D_IDENTITY }, { ...TRANSFORM2D_IDENTITY })).toBe(true);
  });

  it('is false when any single component differs', () => {
    for (const key of ['a', 'b', 'c', 'd', 'tx', 'ty'] as const) {
      expect(sameTransform2D(TRANSFORM2D_IDENTITY, { ...TRANSFORM2D_IDENTITY, [key]: 9 })).toBe(false);
    }
  });
});
