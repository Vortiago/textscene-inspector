import { describe, expect, it } from 'vitest';
import { appendAll, replaceAll, writeAt } from './arrayWrite.js';

const LONGER_THAN_A_SPREAD = 1_000_000;

describe('arrayWrite', () => {
  it('appends more elements than a spread into push takes', () => {
    const target = [0];
    appendAll(target, new Array<number>(LONGER_THAN_A_SPREAD).fill(1));
    expect(target).toHaveLength(LONGER_THAN_A_SPREAD + 1);
  });

  it('replaces the whole content', () => {
    const target = [1, 2, 3];
    replaceAll(target, [4]);
    expect(target).toEqual([4]);
  });

  it('overwrites from a start index', () => {
    const target = [1, 2, 3, 4];
    writeAt(target, 1, [8, 9]);
    expect(target).toEqual([1, 8, 9, 4]);
  });
});
