import { describe, expect, it } from 'vitest';
import { coveringSets, testedNames, variantText } from './defineSets.mjs';

const lines = (text) => text.split('\n').map((each) => ({ text: each }));

describe('testedNames', () => {
  it('lists the names the conditions test, sorted', () => {
    expect(testedNames(lines('#ifdef B\n#if defined(A) && C > 1'), new Set())).toEqual(['A', 'B', 'C']);
  });

  it('leaves out a name the stage defines itself, a skipped one and the material names', () => {
    const text =
      '#define OWN\n#ifdef OWN\n#ifdef GENERAL\n#ifdef MATERIAL_UNIFORMS_USED\n#ifdef SKY_CODE_USED';
    expect(testedNames(lines(text), new Set(['GENERAL']))).toEqual([]);
  });
});

describe('coveringSets', () => {
  /** A stage with `#ifdef A`, and `#ifdef B` inside it. */
  const nested = (set) => [
    ...(set.includes('A') ? ['a'] : []),
    ...(set.includes('A') && set.includes('B') ? ['ab'] : []),
  ];

  it('adds a name to a set while that takes a new branch', () => {
    expect(coveringSets(['A', 'B'], nested)).toEqual([[], ['A'], ['A', 'B']]);
  });

  it('makes no set of a variant the preprocessor refuses', () => {
    expect(coveringSets(['A'], (set) => (set.length > 0 ? undefined : []))).toEqual([[]]);
  });
});

describe('variantText', () => {
  it('writes the names as one of Godot modes', () => {
    expect(variantText(['A', 'B'])).toBe('\n#define A\n#define B\n');
  });
});
