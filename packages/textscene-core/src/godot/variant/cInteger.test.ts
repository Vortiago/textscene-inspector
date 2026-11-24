import { describe, expect, it } from 'vitest';
import {
  divideInt32,
  divideInt64,
  doubleToInt32,
  doubleToInt64,
  GodotCrash,
  INT64_MAX,
  INT64_MIN,
  int64ToFloat32,
  remainderInt32,
  remainderInt64,
  wrapInt32,
  wrapInt64,
} from './cInteger.js';

describe('wrapInt64 and wrapInt32', () => {
  it('keeps a value in range', () => {
    expect([wrapInt64(-5n), wrapInt32(-5n), wrapInt32(-5)]).toEqual([-5n, -5, -5]);
  });

  it('wraps past the top to the bottom', () => {
    expect([wrapInt64(INT64_MAX + 1n), wrapInt32(2n ** 31n)]).toEqual([INT64_MIN, -(2 ** 31)]);
  });
});

describe('doubleToInt64 and doubleToInt32', () => {
  it('truncates toward zero', () => {
    expect([doubleToInt64(-2.9), doubleToInt32(2.9)]).toEqual([-2n, 2]);
  });

  it('gives the lowest integer for NaN, as cvttsd2si does', () => {
    expect([doubleToInt64(NaN), doubleToInt32(NaN)]).toEqual([INT64_MIN, -(2 ** 31)]);
  });

  it('gives the lowest integer for a value out of range', () => {
    expect([doubleToInt64(2 ** 63), doubleToInt32(2 ** 31)]).toEqual([INT64_MIN, -(2 ** 31)]);
  });
});

describe('int64ToFloat32', () => {
  it('keeps an int a float holds', () => {
    expect(int64ToFloat32(-16777216n)).toBe(-16777216);
  });

  it('rounds a tie to the even float', () => {
    expect([int64ToFloat32(16777217n), int64ToFloat32(16777219n)]).toEqual([16777216, 16777220]);
  });

  it('rounds once, not through a double', () => {
    expect(int64ToFloat32(2n ** 60n + 2n ** 36n + 1n)).toBe(2 ** 60 + 2 ** 37);
  });
});

describe('divideInt64 and remainderInt64', () => {
  it('truncates toward zero', () => {
    expect([divideInt64(-7n, 2n), remainderInt64(-7n, 2n)]).toEqual([-3n, -1n]);
  });

  it('crashes on the one quotient out of range', () => {
    expect(() => divideInt64(INT64_MIN, -1n)).toThrow(GodotCrash);
  });

  it('crashes on the remainder of that quotient too', () => {
    expect(() => remainderInt64(INT64_MIN, -1n)).toThrow(GodotCrash);
  });
});

describe('divideInt32 and remainderInt32', () => {
  it('truncates toward zero', () => {
    expect([divideInt32(-7, 2), remainderInt32(7, -2)]).toEqual([-3, 1]);
  });

  it('crashes on a zero divisor', () => {
    expect(() => divideInt32(1, 0)).toThrow(GodotCrash);
  });

  it('crashes on the quotient out of range', () => {
    expect(() => remainderInt32(-(2 ** 31), -1)).toThrow(GodotCrash);
  });
});
