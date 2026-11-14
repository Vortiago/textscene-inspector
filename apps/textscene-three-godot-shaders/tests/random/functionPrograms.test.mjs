import { describe, expect, it } from 'vitest';
import { probeSignature } from '../../../../scripts/godot-probes/probeShader.mjs';
import { transpilerVerdict } from '../verdicts/judge.mjs';
import { generateFunctionPrograms } from './functionPrograms.mjs';
import { generatePrograms, TRANSPILED_ROWS } from './programs.mjs';

const SET = generateFunctionPrograms({ seed: 7, count: 60 });

/** How many programs of the set hold `pattern` in their text. */
const holding = (pattern) => SET.filter((program) => pattern.test(program.source)).length;

describe('the generator of programs with functions', () => {
  it('gives the same programs for the same seed', () => {
    const again = generateFunctionPrograms({ seed: 7, count: 60 });
    expect(again.map((program) => [program.source, program.inputs])).toEqual(
      SET.map((program) => [program.source, program.inputs])
    );
  });

  it('leaves the expression programs of the seed as they are', () => {
    const names = new Set(generatePrograms({ seed: 7, count: 40 }).map((program) => program.name));
    expect(SET.filter((program) => names.has(program.name))).toEqual([]);
  });

  it('uses only transpiled rows', () => {
    const transpiled = new Set(TRANSPILED_ROWS.map((row) => row.id));
    expect(SET.flatMap((program) => program.rows).filter((id) => !transpiled.has(id))).toEqual([]);
  });

  it('writes programs the transpiler reads', () => {
    const refused = SET.map((program) => ({ program, verdict: transpilerVerdict(program.source) }))
      .filter(({ verdict }) => !verdict.accepted)
      .map(({ program, verdict }) => `${program.name}: ${verdict.message ?? verdict.crashed}`);
    expect(refused).toEqual([]);
  });

  it('writes programs the probe harness runs', () => {
    for (const program of SET) expect(() => probeSignature(program.source)).not.toThrow();
  });

  it.each([
    ['an out parameter', /\bout \w+ b\d/],
    ['an inout parameter', /\binout \w+ b\d/],
    ['a const in parameter', /\bconst in \w+ b\d/],
    ['a struct argument or result', /^struct S0/m],
    ['an array parameter', /\b(?:in|out|inout) \w+ b\d\[\d\]/],
    ['an array result', /^\w+\[\d\] h\d\(/m],
    ['a void function', /^void h\d\(/m],
    ['an early return in a branch', /\) return\b/],
    ['an early return in a loop', /for \(int i = 0; [^}]*\breturn\b/],
    ['a call of one function from another', /^\w+(?:\[\d\])? h[1-9]\([^)]*\) \{[^\n]*\bh\d\(/m],
    ['an element written through an index another argument writes', /\bh\d\([^;]*\b(l\d+), [^;]*\[\1\]/],
    ['a swizzle as a written place', /\bh\d\([^;]*\bl\d+\.[xyzw]+[,)]/],
  ])('holds %s', (_, pattern) => {
    expect(holding(pattern)).toBeGreaterThan(0);
  });
});
