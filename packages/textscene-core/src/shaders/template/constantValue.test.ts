import { describe, expect, it } from 'vitest';
import type { Expression } from '../language/shaderTree.js';
import { constantScalar } from './constantValue.js';

const position = { file: 't.glsl', line: 1, column: 1 };

describe('constantScalar', () => {
  it('negates a uint constant into the unsigned range', () => {
    const one = { kind: 'constant', type: 'uint', values: [1], position };
    const negated = { kind: 'operator', type: 'uint', op: 'OP_NEGATE', operands: [one], position };
    expect(constantScalar(negated as unknown as Expression, () => undefined)).toBe(4294967295);
  });

  it('shifts a uint constant right without its sign', () => {
    const high = { kind: 'constant', type: 'uint', values: [0x80000000], position };
    const one = { kind: 'constant', type: 'uint', values: [1], position };
    const shifted = { kind: 'operator', type: 'uint', op: 'OP_SHIFT_RIGHT', operands: [high, one], position };
    expect(constantScalar(shifted as unknown as Expression, () => undefined)).toBe(0x40000000);
  });

  it('picks the branch of a constant ternary its condition names', () => {
    const lane = (type: string, value: number | boolean) => ({
      kind: 'constant',
      type,
      values: [value],
      position,
    });
    const operands = [lane('bool', false), lane('int', 1), lane('int', 2)];
    const select = { kind: 'operator', type: 'int', op: 'OP_SELECT_IF', operands, position };
    expect(constantScalar(select as unknown as Expression, () => undefined)).toBe(2);
  });
});
