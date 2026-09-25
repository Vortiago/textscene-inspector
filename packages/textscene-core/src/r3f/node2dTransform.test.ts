import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  node2DLocalTransform,
  node2dGroupProps,
  node2dGroupSpread,
  threeMatrixFromTransform2D,
  transform2DFromThreeMatrix,
} from './node2dTransform';
import { TRANSFORM2D_IDENTITY, transform2DFromParts } from '../godot/transform2d.js';

describe('node2dGroupProps', () => {
  it('conjugates by diag(1,-1,1): negates Y translation and rotation, preserves scale', () => {
    const r = node2dGroupProps({ position: { x: 100, y: 50 }, rotation: Math.PI / 4, scale: { x: 2, y: 3 } }, 0.5);
    expect(r.position).toEqual([100, -50, 0.5]);
    expect(r.rotation).toEqual([0, 0, -Math.PI / 4]);
    expect(r.scale).toEqual([2, 3, 1]);
  });

  it('omits a matrix when skew is zero/absent (TRS fast path)', () => {
    expect(node2dGroupProps({ position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } }).matrix).toBeUndefined();
    expect(
      node2dGroupProps({ position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, skew: 0 }).matrix
    ).toBeUndefined();
  });

  it('bakes a non-zero skew into a Matrix4 (T·R·Skew·S conjugated by F)', () => {
    const skew = Math.PI / 6;
    const r = node2dGroupProps({ position: { x: 10, y: 20 }, rotation: 0, scale: { x: 1, y: 1 }, skew }, 0.3);
    expect(r.matrix).toBeDefined();
    // Matrix4.elements is column-major. Linear part (rot=0, scale=1):
    // [[1, sin(skew)], [0, cos(skew)]] in three.js space, and the translation is (10, -20, 0.3).
    const e = r.matrix!.elements;
    expect(e[0]).toBeCloseTo(1, 6); // n11 = cos(rot)*sx
    expect(e[1]).toBeCloseTo(0, 6); // n21 = -sin(rot)*sx
    expect(e[4]).toBeCloseTo(Math.sin(skew), 6); // n12 = sin(rot+skew)*sy
    expect(e[5]).toBeCloseTo(Math.cos(skew), 6); // n22 = cos(rot+skew)*sy
    expect(e[12]).toBeCloseTo(10, 6); // n14 = position.x
    expect(e[13]).toBeCloseTo(-20, 6); // n24 = -position.y
    expect(e[14]).toBeCloseTo(0.3, 6); // n34 = z
  });

  it('bakes the matrix the explicit F·L·F formula gives, at every rotation, skew and scale', () => {
    // F·L·F spelled out from `cos`/`sin` directly. `+ 0` folds -0 into +0: the two spellings
    // differ at most in the sign of an exact zero, which no product on the GPU sees.
    const explicit = (rot: number, sx: number, sy: number, skew: number): number[] => [
      Math.cos(rot) * sx, Math.sin(rot + skew) * sy,
      -Math.sin(rot) * sx, Math.cos(rot + skew) * sy,
    ];
    for (const rotation of [0, 0.5, -1.2, Math.PI / 2, Math.PI, 3.7]) {
      for (const skew of [0.25, -0.5, Math.PI / 3, -Math.PI / 2]) {
        for (const [sx, sy] of [[1, 1], [2, -3], [-0.5, 0.25]] as const) {
          const e = node2dGroupProps({ position: { x: 4, y: 5 }, rotation, scale: { x: sx, y: sy }, skew })
            .matrix!.elements;
          // `elements` is column-major, so n12 is e[4] and n21 is e[1].
          const baked = [e[0]!, e[4]!, e[1]!, e[5]!].map((n) => n + 0);
          expect(baked).toEqual(explicit(rotation, sx, sy, skew).map((n) => n + 0));
        }
      }
    }
  });

  it('node2dGroupSpread → TRS props when no skew, matrix props when skewed', () => {
    const trs = node2dGroupSpread(node2dGroupProps({ position: { x: 1, y: 2 }, rotation: 0, scale: { x: 1, y: 1 } }));
    expect(trs).toHaveProperty('position');
    expect(trs).not.toHaveProperty('matrix');

    const skewed = node2dGroupSpread(
      node2dGroupProps({ position: { x: 1, y: 2 }, rotation: 0, scale: { x: 1, y: 1 }, skew: 0.5 })
    );
    expect(skewed).toHaveProperty('matrix');
    expect((skewed as { matrixAutoUpdate: boolean }).matrixAutoUpdate).toBe(false);
  });

  it('defaults z to 0', () => {
    const r = node2dGroupProps({ position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } });
    expect(r.position).toEqual([0, 0, 0]);
  });

  it('is its own inverse on Y so nesting composes (double-conjugation cancels)', () => {
    // A child at the same Godot Y as a parent ends at the same three.js Y.
    const parent = node2dGroupProps({ position: { x: 0, y: 30 }, rotation: 0, scale: { x: 1, y: 1 } });
    const child = node2dGroupProps({ position: { x: 0, y: 30 }, rotation: 0, scale: { x: 1, y: 1 } });
    expect(parent.position[1]).toBe(child.position[1]); // both -30
  });
});

describe('node2DLocalTransform', () => {
  it('builds the transform from every part a parsed Node2D carries', () => {
    const parts = { position: { x: 4, y: 5 }, rotation: 0.5, scale: { x: 2, y: -3 }, skew: 0.25 };
    expect(node2DLocalTransform(parts)).toEqual(
      transform2DFromParts(0.5, { x: 2, y: -3 }, 0.25, { x: 4, y: 5 })
    );
  });

  it('reads an empty bag as the identity, each part at its Node2D default', () => {
    expect(node2DLocalTransform({})).toEqual(TRANSFORM2D_IDENTITY);
  });

  it('defaults only the absent parts', () => {
    expect(node2DLocalTransform({ position: { x: 7, y: -2 } })).toEqual({
      ...TRANSFORM2D_IDENTITY,
      tx: 7,
      ty: -2,
    });
  });
});

describe('threeMatrixFromTransform2D', () => {
  it('conjugates by F: the off-diagonal terms and the Y origin negate, at depth z', () => {
    const e = threeMatrixFromTransform2D({ a: 1, b: 2, c: 3, d: 4, tx: 5, ty: 6 }, 0.25).elements;
    // `elements` is column-major: n11 n21 n31 n41, n12 ….
    expect([e[0], e[1], e[4], e[5]]).toEqual([1, -2, -3, 4]);
    expect([e[12], e[13], e[14]]).toEqual([5, -6, 0.25]);
  });

  it('keeps a zero origin at +0, and z at 0 by default', () => {
    const e = threeMatrixFromTransform2D(TRANSFORM2D_IDENTITY).elements;
    // `toEqual` tells -0 from +0, so this pins the `0 - ty` spelling.
    expect([e[12], e[13], e[14]]).toEqual([0, 0, 0]);
  });

  it('bakes the same matrix node2dGroupProps bakes for a sheared item', () => {
    const local = { position: { x: 4, y: 5 }, rotation: 0.5, scale: { x: 2, y: -3 }, skew: 0.25 };
    const baked = node2dGroupProps(local, 0.3).matrix!;
    expect(threeMatrixFromTransform2D(node2DLocalTransform(local), 0.3).elements).toEqual(
      baked.elements
    );
  });
});

describe('transform2DFromThreeMatrix', () => {
  /** Build the three world matrix a Node2D chain produces, then read it back. */
  function worldMatrixOf(
    transforms: Array<{ position?: [number, number]; rotation?: number; scale?: [number, number] }>
  ): THREE.Matrix4 {
    let leaf: THREE.Object3D | null = null;
    let root: THREE.Object3D | null = null;
    for (const t of transforms) {
      const object = new THREE.Object3D();
      // node2dGroupProps' conjugation: negate the Y translation and the rotation.
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

  it('reads back a pure translation with Y un-negated (happy path)', () => {
    const transform = transform2DFromThreeMatrix(worldMatrixOf([{ position: [10, 20] }]));
    expect(transform.tx).toBeCloseTo(10, 6);
    expect(transform.ty).toBeCloseTo(20, 6);
    expect(transform.a).toBeCloseTo(1, 6);
    expect(transform.d).toBeCloseTo(1, 6);
  });

  it('reads back a scale unchanged', () => {
    const transform = transform2DFromThreeMatrix(worldMatrixOf([{ scale: [3, 0.5] }]));
    expect(transform.a).toBeCloseTo(3, 6);
    expect(transform.d).toBeCloseTo(0.5, 6);
    expect(transform.b).toBeCloseTo(0, 6);
    expect(transform.c).toBeCloseTo(0, 6);
  });

  it('un-negates the rotation, so a Godot clockwise angle comes back clockwise', () => {
    const angle = 0.4;
    const transform = transform2DFromThreeMatrix(worldMatrixOf([{ rotation: angle }]));
    // Godot's Transform2D from a rotation is columns (cos, sin), (-sin, cos).
    expect(transform.a).toBeCloseTo(Math.cos(angle), 6);
    expect(transform.b).toBeCloseTo(Math.sin(angle), 6);
    expect(transform.c).toBeCloseTo(0 - Math.sin(angle), 6);
    expect(transform.d).toBeCloseTo(Math.cos(angle), 6);
  });

  it('composes a parent chain the way Godot composes global transforms', () => {
    const transform = transform2DFromThreeMatrix(
      worldMatrixOf([{ position: [100, 50] }, { position: [-13, -35], scale: [0.6, 0.6] }])
    );
    expect(transform.tx).toBeCloseTo(87, 6);
    expect(transform.ty).toBeCloseTo(15, 6);
    expect(transform.a).toBeCloseTo(0.6, 6);
    expect(transform.d).toBeCloseTo(0.6, 6);
  });

  it('reads the identity matrix as the identity transform (edge case)', () => {
    expect(transform2DFromThreeMatrix(new THREE.Matrix4())).toEqual(TRANSFORM2D_IDENTITY);
  });

  it('inverts threeMatrixFromTransform2D exactly', () => {
    const t = transform2DFromParts(0.7, { x: 2, y: -0.5 }, 0.3, { x: 5, y: -6 });
    expect(transform2DFromThreeMatrix(threeMatrixFromTransform2D(t, 0.4))).toEqual(t);
  });
});
