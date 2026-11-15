import { describe, expect, it } from 'vitest';
import { linesAddedInEvery } from './linesAddedInEvery.mjs';

describe('linesAddedInEvery', () => {
  it("keeps a line only where every base's diff adds it", () => {
    const sinceTip = [
      ['main.ts', new Set([1, 2])],
      ['topic.ts', new Set([5])],
    ];
    const sinceMain = [['topic.ts', new Set([5, 6])]];

    expect(linesAddedInEvery([sinceTip, sinceMain])).toEqual([['topic.ts', new Set([5])]]);
  });

  it('keeps the lines of one base as they are', () => {
    const only = [
      ['a.ts', new Set([3])],
      ['b.ts', new Set([1, 2])],
    ];

    expect(linesAddedInEvery([only])).toEqual(only);
  });

  it('drops a file whose lines no base shares (edge case)', () => {
    expect(linesAddedInEvery([[['a.ts', new Set([1])]], [['a.ts', new Set([2])]]])).toEqual([]);
  });
});
