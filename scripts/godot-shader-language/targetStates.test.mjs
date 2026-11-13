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
});
