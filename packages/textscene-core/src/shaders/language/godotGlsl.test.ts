/** The negation Godot's text leaves out, and the constants glslang folds, on parsed trees. */

import { describe, expect, it } from 'vitest';
import { dropsNegation, GlslangFolding } from './godotGlsl.js';
import { parse } from './parse.js';
import type { Expression, OperatorApplication } from './shaderTree.js';
import { tokenize } from './tokenizer.js';

const resultOf = (source: string): Expression => parse(tokenize(source)).functions[0]!.result;

const bitsOf = (value: number) => new Uint32Array(new Float32Array([value]).buffer)[0];

describe('dropsNegation', () => {
  it.each([
    ['a negation', 'float f(float a) { return -(-a); }'],
    ['a swizzle of a negation', 'float f(vec2 a) { return -((-a).y); }'],
    ['a negative constant', 'float f(float a) { return -(-1.5) + a; }'],
  ])('drops the negation of %s, whose text starts with a minus', (_, source) => {
    const result = resultOf(source);
    const negation = (
      result.kind === 'operator' && result.operands.length === 2 ? result.operands[0] : result
    )!;
    expect(dropsNegation(negation as OperatorApplication)).toBe(true);
  });

  it('keeps the negation of a sum, whose text starts with a parenthesis', () => {
    expect(
      dropsNegation(resultOf('float f(float a, float b) { return -(a + b); }') as OperatorApplication)
    ).toBe(false);
  });
});

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

  it('folds nothing that reads a parameter', () => {
    expect(
      new GlslangFolding().lanesOf(resultOf('float f(float a) { return 1.0 + 2.0 + a; }'))
    ).toBeUndefined();
  });
});
