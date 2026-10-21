import { describe, expect, it } from 'vitest';
import { int32Elements } from './packedInt32';

describe('int32Elements', () => {
  it('reads each element as the int32 Godot stores', () => {
    expect(int32Elements(' 1, -5, 2e1, 3000000000 ')).toEqual([1, -5, 20, -1294967296]);
  });

  it('refuses a body with an element the tokenizer cannot read (error path)', () => {
    expect(int32Elements('1, x')).toBeNull();
    expect(int32Elements('1,, 2')).toBeNull();
    expect(int32Elements('true')).toBeNull();
  });

  it('reads an element no int32 holds as NaN (edge case)', () => {
    expect(int32Elements('inf, 7, 1e20')).toEqual([NaN, 7, NaN]);
  });

  it('reads an empty or blank body as no elements (edge case)', () => {
    expect(int32Elements('')).toEqual([]);
    expect(int32Elements('  ')).toEqual([]);
  });
});
