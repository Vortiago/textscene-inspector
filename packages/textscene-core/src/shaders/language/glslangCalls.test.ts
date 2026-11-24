import { describe, expect, it } from 'vitest';
import { GlslangFolding } from './glslangFolding.js';
import { godotConstantDouble } from './godotNumber.js';
import { returnedValue } from './parsedTree.testkit.js';

const folded = (body: string, returns = 'float') =>
  new GlslangFolding(godotConstantDouble).lanesOf(returnedValue(`${returns} f() { return ${body}; }`));

/** The double glslang reads from the text Godot writes for the float literal `literal`. */
const double = (literal: number) => godotConstantDouble(Math.fround(literal));

describe('glslang folds a call of angles and trigonometry', () => {
  it('folds radians and degrees as one product and one quotient, in that order', () => {
    expect(folded('radians(30.0)')).toEqual([0.5235987755982988]);
    expect(folded('degrees(0.7)')).toEqual([40.10704497613865]);
  });

  it('folds sin, cos, tan and their inverses in double precision, unrounded', () => {
    const [sine] = folded('sin(0.7)')! as number[];
    expect(sine).toBe(Math.sin(double(0.7)));
    expect(Math.fround(sine!)).not.toBe(sine);
    expect(folded('vec2(cos(0.7), tan(0.7))', 'vec2')).toEqual([
      Math.cos(double(0.7)),
      Math.tan(double(0.7)),
    ]);
    expect(folded('vec3(asin(0.3), acos(0.3), atan(0.3))', 'vec3')).toEqual([
      Math.asin(double(0.3)),
      Math.acos(double(0.3)),
      Math.atan(double(0.3)),
    ]);
  });

  it('folds atan of two arguments as atan2', () => {
    expect(folded('atan(vec2(1.0, -1.0), vec2(-2.0))', 'vec2')).toEqual([
      Math.atan2(1, -2),
      Math.atan2(-1, -2),
    ]);
  });

  it('leaves the hyperbolic functions to the GPU', () => {
    expect(folded('sinh(0.7)')).toBeUndefined();
    expect(folded('atanh(0.3)')).toBeUndefined();
  });
});

describe('glslang folds a call of the exponential functions', () => {
  it('folds pow, exp, log, exp2, log2 and sqrt in double precision', () => {
    expect(folded('pow(1.7, 2.3)')).toEqual([Math.pow(double(1.7), double(2.3))]);
    expect(folded('vec3(exp(1.7), log(1.7), sqrt(1.7))', 'vec3')).toEqual([
      Math.exp(double(1.7)),
      Math.log(double(1.7)),
      Math.sqrt(double(1.7)),
    ]);
    expect(folded('vec2(exp2(1.7), log2(1.7))', 'vec2')).toEqual([2 ** double(1.7), Math.log2(double(1.7))]);
  });

  it('folds inversesqrt as one over the square root', () => {
    expect(folded('inversesqrt(1.7)')).toEqual([1 / Math.sqrt(double(1.7))]);
  });

  it('folds the square root of a negative constant to NaN', () => {
    expect(folded('sqrt(-1.0)')).toEqual([NaN]);
  });
});

describe('glslang folds a call of the common functions', () => {
  it('folds sign of either zero to +0, and of an int to an int', () => {
    expect(Object.is(folded('sign(-0.0)')![0], 0)).toBe(true);
    expect(folded('sign(ivec2(-7, 9))', 'ivec2')).toEqual([-1, 1]);
  });

  it('folds sign of NaN to 1', () => {
    expect(folded('sign(sqrt(-1.0))')).toEqual([1]);
  });

  it('folds abs of the least int to the least int', () => {
    expect(folded('abs(-2147483647 - 1)', 'int')).toEqual([-2147483648]);
  });

  it('folds round as floor(x + 0.5), so a half rounds up', () => {
    expect(folded('vec2(round(-2.5), round(2.5))', 'vec2')).toEqual([-2, 3]);
  });

  it('folds roundEven of a half to the even neighbour', () => {
    expect(folded('vec3(roundEven(2.5), roundEven(3.5), roundEven(-2.5))', 'vec3')).toEqual([2, 4, -2]);
  });

  it('folds trunc of a negative fraction to -0', () => {
    expect(Object.is(folded('trunc(-0.5)')![0], -0)).toBe(true);
  });

  it('folds floor, ceil and fract', () => {
    expect(folded('vec3(floor(-1.5), ceil(-1.5), fract(-0.25))', 'vec3')).toEqual([-2, -1, 0.75]);
  });

  it('folds mod as x - y * floor(x / y)', () => {
    expect(folded('mod(-1.0, 3.0)')).toEqual([2]);
  });

  it('folds min and max as std::min and std::max, which keep the first argument against NaN', () => {
    expect(folded('vec3(min(sqrt(-1.0), 1.0), max(sqrt(-1.0), 1.0), max(1.0, sqrt(-1.0)))', 'vec3')).toEqual([
      NaN,
      NaN,
      1,
    ]);
  });

  it('folds clamp of a vector and two floats, the floats standing for every lane', () => {
    expect(folded('clamp(vec3(-1.0, 0.5, 2.0), 0.0, 1.0)', 'vec3')).toEqual([0, 0.5, 1]);
    expect(folded('clamp(ivec2(-9, 9), 0, 4)', 'ivec2')).toEqual([0, 4]);
  });

  it('folds mix of floats as x * (1 - a) + y * a, and of a bool as a choice', () => {
    expect(folded('mix(0.1, 0.7, 0.3)')).toEqual([
      double(0.1) * (1 - double(0.3)) + double(0.7) * double(0.3),
    ]);
    expect(folded('mix(vec2(1.0), vec2(2.0), bvec2(true, false))', 'vec2')).toEqual([2, 1]);
  });

  it('folds step and smoothstep, sized by the larger of the edge and the value', () => {
    expect(folded('step(0.5, vec2(0.2, 0.7))', 'vec2')).toEqual([0, 1]);
    expect(folded('smoothstep(0.0, 2.0, vec2(-1.0, 0.5))', 'vec2')).toEqual([0, 0.25 * 0.25 * 2.5]);
  });

  it('folds isnan and isinf of the constants that give NaN and infinity', () => {
    expect(folded('bvec2(isnan(sqrt(-1.0)), isinf(1.0 / 0.0))', 'bvec2')).toEqual([true, true]);
  });

  it('leaves modf to the GPU', () => {
    const tree = returnedValue('float f() { float whole = 0.0; return modf(1.5, whole); }');
    expect(new GlslangFolding(godotConstantDouble).lanesOf(tree)).toBeUndefined();
  });
});

describe('glslang folds a call of the geometric functions', () => {
  it('folds length, distance and dot as sums from zero in double precision', () => {
    expect(folded('length(vec2(3.0, 4.0))')).toEqual([5]);
    expect(folded('distance(vec2(1.0, 1.0), vec2(4.0, 5.0))')).toEqual([5]);
    expect(folded('dot(vec3(0.1, 0.2, 0.3), vec3(0.4, 0.5, 0.6))')).toEqual([
      0 + double(0.1) * double(0.4) + double(0.2) * double(0.5) + double(0.3) * double(0.6),
    ]);
  });

  it('folds normalize as each lane over the length', () => {
    expect(folded('normalize(vec2(3.0, 4.0))', 'vec2')).toEqual([3 / 5, 4 / 5]);
  });

  it('folds cross', () => {
    expect(folded('cross(vec3(1.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0))', 'vec3')).toEqual([0, 0, 1]);
  });

  it('folds faceforward to N when dot(Nref, I) is negative, and to -N otherwise', () => {
    expect(folded('faceforward(vec2(1.0, 2.0), vec2(1.0, 0.0), vec2(-1.0, 0.0))', 'vec2')).toEqual([1, 2]);
    expect(folded('faceforward(vec2(1.0, 2.0), vec2(1.0, 0.0), vec2(1.0, 0.0))', 'vec2')).toEqual([-1, -2]);
  });

  it('folds reflect as I - 2 * dot(N, I) * N', () => {
    expect(folded('reflect(vec2(1.0, -1.0), vec2(0.0, 1.0))', 'vec2')).toEqual([1, 1]);
  });

  it('folds refract to zero lanes past the critical angle', () => {
    expect(folded('refract(vec2(0.8, -0.6), vec2(0.0, 1.0), 2.0)', 'vec2')).toEqual([0, 0]);
  });

  it('folds refract below the critical angle', () => {
    const k = 1 - 0.5 * 0.5 * (1 - double(-0.6) * double(-0.6));
    const scale = 0.5 * double(-0.6) + Math.sqrt(k);
    expect(folded('refract(vec2(0.8, -0.6), vec2(0.0, 1.0), 0.5)', 'vec2')).toEqual([
      0.5 * double(0.8) - scale * 0,
      0.5 * double(-0.6) - scale * 1,
    ]);
  });
});

describe('glslang folds a call of the matrix functions', () => {
  it('folds outerProduct column by column', () => {
    expect(folded('outerProduct(vec2(1.0, 2.0), vec2(3.0, 4.0))', 'mat2')).toEqual([3, 6, 4, 8]);
  });

  it('leaves matrixCompMult, transpose, determinant and inverse to the GPU', () => {
    expect(folded('matrixCompMult(mat2(1.0), mat2(2.0))', 'mat2')).toBeUndefined();
    expect(folded('transpose(mat2(1.0))', 'mat2')).toBeUndefined();
    expect(folded('determinant(mat2(1.0))')).toBeUndefined();
    expect(folded('inverse(mat2(1.0))', 'mat2')).toBeUndefined();
  });
});

describe('glslang folds a call of the vector relational functions', () => {
  it('folds lessThan, greaterThan, equal and notEqual lane by lane', () => {
    expect(folded('lessThan(vec2(1.0, 2.0), vec2(2.0, 1.0))', 'bvec2')).toEqual([true, false]);
    expect(folded('greaterThan(ivec2(1, 2), ivec2(2, 1))', 'bvec2')).toEqual([false, true]);
    expect(folded('equal(bvec2(true, false), bvec2(true, true))', 'bvec2')).toEqual([true, false]);
    expect(folded('notEqual(uvec2(1u, 2u), uvec2(1u, 3u))', 'bvec2')).toEqual([false, true]);
  });

  it('folds lessThanEqual as not greater, so NaN is less or equal', () => {
    expect(
      folded(
        'bvec2(lessThanEqual(vec2(sqrt(-1.0)), vec2(1.0)).x, greaterThanEqual(vec2(sqrt(-1.0)), vec2(1.0)).x)',
        'bvec2'
      )
    ).toEqual([true, true]);
  });

  it('folds any, all and not', () => {
    expect(folded('bvec2(any(bvec2(false, true)), all(bvec2(false, true)))', 'bvec2')).toEqual([true, false]);
    expect(folded('not(bvec2(false, true))', 'bvec2')).toEqual([true, false]);
  });
});

describe('glslang folds calls of calls', () => {
  it('folds a call whose argument is a folded call', () => {
    expect(folded('sin(cos(0.5))')).toEqual([Math.sin(Math.cos(0.5))]);
  });

  it('folds no call that reads an argument', () => {
    expect(
      new GlslangFolding(godotConstantDouble).lanesOf(returnedValue('float f(float a) { return sin(a); }'))
    ).toBeUndefined();
  });
});
