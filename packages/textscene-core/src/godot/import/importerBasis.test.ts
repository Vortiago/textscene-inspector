/**
 * Every expected scale is the float32 bit pattern Godot 4.6.3 prints for the same basis, built
 * through `Basis(Quaternion)`, `orthonormalized()`, `from_scale` and `Transform3D *`.
 */

import { describe, expect, it } from 'vitest';
import {
  IDENTITY_BASIS,
  gltfNodeBasis,
  rowScaledBasis,
  transformChainScale,
  unwrapSpace,
} from './importerBasis';

function float32(bits: number): number {
  const view = new DataView(new ArrayBuffer(4));
  view.setUint32(0, bits);
  return view.getFloat32(0);
}

const scaleOf = (...bits: number[]): number[] => bits.map(float32);

describe('transformChainScale', () => {
  it('measures a quarter turn about X, as zdm2 carries it, at exactly 1', () => {
    const zdm2 = gltfNodeBasis({ rotation: [0.7071068286895752, 0, 0, 0.7071068286895752] });

    expect(transformChainScale([zdm2, IDENTITY_BASIS])).toEqual([1, 1, 1]);
  });

  it("measures a rotated, scaled node at Godot's rounded column lengths", () => {
    const node = gltfNodeBasis({ rotation: [0.1, 0.7, 0.1, 0.7], scale: [-1.5, 1, 1] });

    expect(transformChainScale([node])).toEqual(scaleOf(0x3fbfffff, 0x3f800000, 0x3f800000));
  });

  it('multiplies the chain from the mesh node up to the root', () => {
    const child = gltfNodeBasis({ rotation: [0.1, 0.7, 0.1, 0.7], scale: [-1.5, 1, 1] });
    const parent = gltfNodeBasis({
      rotation: [0.19156526, 0.28734789, -0.38313052, 0.76626104],
      scale: [2, 0.5, 3.3],
    });

    expect(transformChainScale([child, parent])).toEqual(scaleOf(0x40983660, 0x3f854747, 0x40000000));
  });

  it('reads a node matrix by columns', () => {
    const node = gltfNodeBasis({ matrix: [0, 0.6, 0.8, 0, 0, -1.6, 1.2, 0, 3, 0, 0, 0, 1, 2, 3, 1] });

    expect(transformChainScale([node])).toEqual([1, 2, 3]);
  });

  it("includes a root scaled by the sidecar's unbaked root scale", () => {
    const child = gltfNodeBasis({ rotation: [0.1, 0.7, 0.1, 0.7], scale: [-1.5, 1, 1] });
    const root = rowScaledBasis(IDENTITY_BASIS, [0.1, 0.1, 0.1]);

    expect(transformChainScale([child, root])).toEqual(scaleOf(0x3e199999, 0x3dcccccd, 0x3dcccccd));
  });

  it('measures an empty chain at 1 (edge case)', () => {
    expect(transformChainScale([])).toEqual([1, 1, 1]);
  });
});

describe('unwrapSpace', () => {
  it('scales each position by the axis scale', () => {
    const xyz = Float32Array.from([1, 2, 3]);

    unwrapSpace([2, 3, 4]).transformPositions(xyz);

    expect(Array.from(xyz)).toEqual([2, 6, 12]);
  });

  it('turns a normal by the inverse scale, normalised', () => {
    const xyz = Float32Array.from([1, 1, 0]);

    unwrapSpace([1, 2, 1]).transformNormals(xyz);

    expect(Array.from(xyz)).toEqual([Math.fround(2 / Math.sqrt(5)), Math.fround(1 / Math.sqrt(5)), 0]);
  });

  it('keeps the scale basis for a normal under a zero axis, as the editor build does (edge case)', () => {
    // `ERR_FAIL_COND(det == 0)` under `MATH_CHECKS` leaves the basis as it is (`basis.cpp:45-47`).
    const xyz = Float32Array.from([0, 1, 0]);

    unwrapSpace([0, 1, 1]).transformNormals(xyz);

    expect(Array.from(xyz)).toEqual([0, 1, 0]);
  });

  it('writes a -0 position as +0, as the zero origin is added (edge case)', () => {
    const xyz = Float32Array.from([-0, 1, 1]);

    unwrapSpace([1, 1, 1]).transformPositions(xyz);

    expect(Object.is(xyz[0], 0)).toBe(true);
  });
});
