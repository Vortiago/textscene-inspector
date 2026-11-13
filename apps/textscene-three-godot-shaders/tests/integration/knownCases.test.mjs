import { describe, expect, it } from 'vitest';
import { settledKnownCases, staleKnownPrograms } from './randomPrograms.mjs';

const verdict = (passed, lanes) => ({ passed, lanes, mismatches: passed ? 0 : 1, maxUlp: 1, detail: 'd' });

describe('the fixed known-difference cases on the page', () => {
  it('fails a case whose own program equals Godot now', () => {
    const results = [{ knownCase: { difference: 'mat2-double-sum' }, verdict: verdict(true, 4) }];
    expect(settledKnownCases(results)).toEqual([
      'known difference mat2-double-sum equals Godot now: remove it from knownDifferences.mjs',
    ]);
  });

  it('keeps a case that still differs in its bits', () => {
    expect(
      settledKnownCases([{ knownCase: { difference: 'mat2-double-sum' }, verdict: verdict(false, 4) }])
    ).toEqual([]);
  });

  it('fails a program a case names that equals Godot now, so the link goes and the case stays', () => {
    const results = [{ program: { name: 'random-1847-143' }, verdict: verdict(true, 4) }];
    expect(staleKnownPrograms(results)).toEqual([
      'random-1847-143 equals Godot now: remove it as the program of its case in knownDifferences.mjs',
    ]);
  });
});
