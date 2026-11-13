import { describe, expect, it } from 'vitest';
import { hashIntArray } from './hashFuncs';

describe('hashIntArray', () => {
  // Printed by Godot 4.6.3: `print([0, 1].hash())` and the others.
  it.each([
    [[0, 1], 1996449155],
    [[3, 7], 2288432370],
    [[2, 536870913], 563863509],
    [[5, -1], 935429685],
  ])('hashes %j as Godot does', (ints, expected) => {
    expect(hashIntArray(ints)).toBe(expected);
  });
});
