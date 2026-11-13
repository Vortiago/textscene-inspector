/** The constants glslang folds, on parsed trees. */

import { describe, expect, it } from 'vitest';
import { GlslangFolding } from './glslangFolding.js';
import { parse } from './parse.js';
import type { Expression } from './shaderTree.js';
import { tokenize } from './tokenizer.js';

/** The expression of the first statement, a `return`. */
function resultOf(source: string): Expression {
  const [statement] = parse(tokenize(source)).functions[0]!.body.statements;
  if (statement?.kind !== 'control flow') throw new Error(`expected a return first in ${source}`);
  return statement.expressions[0]!;
}

const bitsOf = (value: number) => new Uint32Array(new Float32Array([value]).buffer)[0];

describe('GlslangFolding', () => {
  it('folds a sum of constants in double precision and leaves the rounding to the emitter', () => {
    const lanes = new GlslangFolding().lanesOf(resultOf('float f() { return 58.656 + 74.377; }'));
    expect(lanes).toEqual([58.6559982299805 + 74.3769989013672]);
    expect(bitsOf(lanes![0]!)).toBe(0x43050873);
  });

  it('folds a swizzle of a constant and a scalar operand for every lane', () => {
    expect(
      new GlslangFolding().lanesOf(resultOf('vec2 f() { return vec3(1.0, 2.0, 4.0).zx * 0.5; }'))
    ).toEqual([2, 0.5]);
  });

  it('folds nothing that reads an argument', () => {
    expect(
      new GlslangFolding().lanesOf(resultOf('float f(float a) { return 1.0 + 2.0 + a; }'))
    ).toBeUndefined();
  });
});
