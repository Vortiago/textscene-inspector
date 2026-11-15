import { describe, expect, it } from 'vitest';
import { compareProbe, coverageFailures } from './compare.mjs';

const ENDS_GODOT = {
  source: '',
  inputs: [],
  rejected: { stage: 'Godot', message: 'Godot ends with signal 8' },
};

describe('the verdict on a shader that ends Godot', () => {
  it('passes when the transpiler refuses it as an expression Godot aborts on', () => {
    const actual = { error: 'Godot 4.6.3 aborts on this expression: it traps.', isRefusal: true };
    expect(compareProbe(ENDS_GODOT, actual).passed).toBe(true);
  });

  it('fails when the transpiler refuses it for another reason', () => {
    const actual = { error: 'OP_CALL is not transpiled yet (#1825).', isRefusal: true };
    expect(compareProbe(ENDS_GODOT, actual).passed).toBe(false);
  });
});

describe('the coverage verdict with known probe differences', () => {
  const probe = { name: 'call-min-vec2-float', rows: ['min(vec2,float)'] };
  const differs = {
    passed: false,
    lanes: 64,
    mismatches: 1,
    maxUlp: Infinity,
    detail: 'lane 34: Godot 80000000, transpilation 00000000',
  };
  const known = {
    'call-min-vec2-float': {
      owner: '#1826',
      cause: 'driver',
      lanesOff: 1,
      first: 'lane 34: Godot 80000000, transpilation 00000000',
    },
  };

  it('passes a probe that differs as its listed entry says', () => {
    expect(coverageFailures([probe], new Map([[probe.name, differs]]), known)).toEqual([]);
  });

  it('fails a listed probe that differs in another lane', () => {
    const other = { ...differs, mismatches: 2 };

    expect(coverageFailures([probe], new Map([[probe.name, other]]), known)).toEqual([
      'call-min-vec2-float (min(vec2,float)): lane 34: Godot 80000000, transpilation 00000000, where knownProbeDifferences.mjs lists 1 lane off from lane 34: Godot 80000000, transpilation 00000000',
    ]);
  });

  it('fails a listed probe that equals Godot now', () => {
    const equal = { passed: true, lanes: 64, mismatches: 0, maxUlp: 0, detail: undefined };

    expect(coverageFailures([probe], new Map([[probe.name, equal]]), known)).toEqual([
      'call-min-vec2-float equals Godot now: remove it from knownProbeDifferences.mjs',
    ]);
  });

  it('fails a probe that differs and is not listed', () => {
    expect(coverageFailures([probe], new Map([[probe.name, differs]]), {})).toEqual([
      'call-min-vec2-float (min(vec2,float)): lane 34: Godot 80000000, transpilation 00000000',
    ]);
  });
});
