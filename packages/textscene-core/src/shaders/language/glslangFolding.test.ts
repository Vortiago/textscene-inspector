/** The constants glslang folds, on parsed trees. */

import { describe, expect, it } from 'vitest';
import { returnedValue as resultOf } from './parsedTree.testkit.js';
import { GlslangFolding } from './glslangFolding.js';

const bitsOf = (value: number) => new Uint32Array(new Float32Array([value]).buffer)[0];

describe('GlslangFolding', () => {
  it('folds a sum of constants in double precision and leaves the rounding to the emitter', () => {
    const lanes = new GlslangFolding().lanesOf(resultOf('float f() { return 58.656 + 74.377; }'));
    expect(lanes).toEqual([58.6559982299805 + 74.3769989013672]);
    expect(bitsOf(lanes![0] as number)).toBe(0x43050873);
  });

  it('folds a swizzle of a constant and a scalar operand for every lane', () => {
    expect(
      new GlslangFolding().lanesOf(resultOf('vec2 f() { return vec3(1.0, 2.0, 4.0).zx * 0.5; }'))
    ).toEqual([2, 0.5]);
  });

  it('folds a shift as the x86-64 build does, the count modulo 32', () => {
    expect(new GlslangFolding().lanesOf(resultOf('uint f() { return 9u << 85u; }'))).toEqual([0x01200000]);
  });

  it('folds a conversion of a constant in a constructor, as a C++ cast', () => {
    expect(new GlslangFolding().lanesOf(resultOf('uint f() { return uint(-65); }'))).toEqual([4294967231]);
    expect(new GlslangFolding().lanesOf(resultOf('float f() { return 0.5 + float(true); }'))).toEqual([1.5]);
  });

  it('folds a uint division by zero to the largest uint', () => {
    expect(
      new GlslangFolding().lanesOf(resultOf('uvec2 f() { return uvec2(7u, 8u) / uvec2(0u, 2u); }'))
    ).toEqual([0xffffffff, 4]);
  });

  it('folds a matrix times a vector as sums of products', () => {
    expect(
      new GlslangFolding().lanesOf(
        resultOf('vec2 f() { return mat2(vec2(1.0, 2.0), vec2(3.0, 4.0)) * vec2(1.0, 10.0); }')
      )
    ).toEqual([31, 42]);
  });

  it('folds an equality of matrices to one boolean', () => {
    expect(new GlslangFolding().lanesOf(resultOf('bool f() { return mat2(2.0) == mat2(2.0); }'))![0]).toBe(
      true
    );
  });

  it('folds an equality of equalities as glslang sizes them: by the left operand of each', () => {
    const folding = new GlslangFolding();
    expect(folding.lanesOf(resultOf('bool f() { return (vec2(1.0) == vec2(2.0)) == (1 == 2); }'))![0]).toBe(
      false
    );
    expect(folding.lanesOf(resultOf('bool f() { return (1 == 2) == (3 == 4); }'))).toEqual([true]);
  });

  it('folds nothing that reads an argument', () => {
    expect(
      new GlslangFolding().lanesOf(resultOf('float f(float a) { return 1.0 + 2.0 + a; }'))
    ).toBeUndefined();
  });
});
