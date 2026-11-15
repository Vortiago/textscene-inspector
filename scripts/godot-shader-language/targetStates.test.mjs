/** Each transpiled row's state on each target names its lowering. */

import { describe, expect, it } from 'vitest';
import { targetStates } from './targetStates.mjs';

const operatorRow = (id, args) => ({ id, family: 'operator', args });

describe('targetStates', () => {
  it('names an operator whose TSL node is the GLSL operator native on both targets', () => {
    expect(targetStates(operatorRow('OP_ADD(vec2,vec2)', ['vec2', 'vec2']))).toEqual({
      webgl2: 'native',
      webgpu: 'native',
    });
  });

  it.each([
    ['OP_DIV(mat3,float)', ['mat3', 'float'], 'lowered: product with the reciprocal'],
    ['OP_SUB(mat2,float)', ['mat2', 'float'], 'lowered: column by column'],
    ['OP_ADD(float,mat3)', ['float', 'mat3'], 'lowered: column by column'],
    ['OP_MUL(mat4,float)', ['mat4', 'float'], 'lowered: column by column'],
    ['OP_DIV(float,mat2)', ['float', 'mat2'], 'lowered: column by column'],
    ['OP_EQUAL(ivec2,ivec2)', ['ivec2', 'ivec2'], 'lowered: all(equal(a, b))'],
    [
      'OP_ASSIGN_DIV(mat4,float)',
      ['mat4', 'float'],
      'lowered: written to the argument value, product with the reciprocal',
    ],
    ['OP_POST_INCREMENT(int)', ['int'], 'lowered: written to the argument value'],
  ])('names the lowering of %s', (id, args, state) => {
    expect(targetStates(operatorRow(id, args)).webgl2).toBe(state);
  });

  it('names the diagonal of a matrix of one float', () => {
    expect(
      targetStates({ id: 'mat2(float)', family: 'constructor', returns: 'mat2', args: ['float'] }).webgpu
    ).toBe('lowered: diagonal of columns');
  });

  it('names a built-in function three/tsl has native on both targets', () => {
    expect(targetStates({ id: 'sin(vec2)', family: 'function', returns: 'vec2', args: ['vec2'] })).toEqual({
      webgl2: 'native',
      webgpu: 'native',
    });
  });

  it.each([
    ['roundEven(vec2)', ['vec2'], 'lowered: floor(x) + mod(floor(x), 2) at a half'],
    ['isnan(vec2)', ['vec2'], 'lowered: x != x'],
    ['isinf(float)', ['float'], 'lowered: abs(x) == infinity'],
    ['matrixCompMult(mat2,mat2)', ['mat2', 'mat2'], 'lowered: column by column'],
    ['outerProduct(vec3,vec3)', ['vec3', 'vec3'], 'lowered: column by column'],
    ['modf(vec2,vec2)', ['vec2', 'vec2'], 'lowered: trunc(x) and x - trunc(x)'],
    ['mix(vec3,vec3,bvec3)', ['vec3', 'vec3', 'bvec3'], 'lowered: select by lane'],
  ])('names the composite of %s on both targets', (id, args, state) => {
    expect(targetStates({ id, family: 'function', returns: args[0], args })).toEqual({
      webgl2: state,
      webgpu: state,
    });
  });

  it.each([
    ['bitCount(uvec2)', ['uvec2'], 'lowered: sums of bit pairs, nibbles and bytes'],
    [
      'umulExtended(uint,uint,uint,uint)',
      ['uint', 'uint', 'uint', 'uint'],
      'lowered: products of 16-bit halves',
    ],
    ['ldexp(vec2,ivec2)', ['vec2', 'ivec2'], 'lowered: three products by powers of two'],
  ])('names the composite of the high_end function %s', (id, args, state) => {
    expect(targetStates({ id, family: 'function (high_end)', returns: args[0], args }).webgl2).toBe(state);
  });

  it("names three's WebGL 2 function of a 4x8 pack, which WGSL has natively", () => {
    const row = { id: 'packSnorm4x8(vec4)', family: 'function (high_end)', returns: 'uint', args: ['vec4'] };
    expect(targetStates(row)).toEqual({ webgl2: "lowered: three's tsl_packSnorm4x8", webgpu: 'native' });
  });
});
