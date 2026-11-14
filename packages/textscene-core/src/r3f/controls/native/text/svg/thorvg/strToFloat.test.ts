import { describe, expect, it } from 'vitest';
import { strToFloat } from './strToFloat';

describe('strToFloat', () => {
  it('reads an integer, a fraction and a signed number, and ends after them', () => {
    expect(strToFloat('42 7')).toEqual({ value: 42, end: 2 });
    expect(strToFloat('  -0.5,')).toEqual({ value: -0.5, end: 6 });
    expect(strToFloat('+.25')).toEqual({ value: 0.25, end: 4 });
  });

  it('reads in single precision', () => {
    expect(strToFloat('0.1').value).toBe(Math.fround(0.1));
    expect(strToFloat('16777217').value).toBe(16777216);
  });

  it('reads an exponent, scaled in single precision steps', () => {
    expect(strToFloat('1.5e3')).toEqual({ value: 1500, end: 5 });
    expect(strToFloat('2E-2').value).toBe(Math.fround(Math.fround(2) / Math.fround(100)));
    expect(strToFloat('1e10').value).toBe(Math.fround(1e8 * 100));
  });

  it('ends at a number that ends in a dot, and reads nothing there', () => {
    expect(strToFloat('5.')).toEqual({ value: 5, end: 0 });
    expect(strToFloat('5. 6')).toEqual({ value: 5, end: 2 });
  });

  it('reads the number before an em unit, and ends after it', () => {
    expect(strToFloat('10.5em')).toEqual({ value: 10.5, end: 6 });
  });

  it('ends an exponent with no digits as ThorVG does', () => {
    expect(strToFloat('.ex')).toEqual({ value: 0, end: 0 });
    expect(strToFloat('5e')).toEqual({ value: 5, end: 1 });
    expect(strToFloat('5ex')).toEqual({ value: 5, end: 2 });
  });

  it('reads infinity and NaN, and an overflow as zero', () => {
    expect(strToFloat('-Infinity')).toEqual({ value: -Infinity, end: 9 });
    expect(strToFloat('nan').value).toBeNaN();
    expect(strToFloat('1e39')).toEqual({ value: 0, end: 4 });
    expect(strToFloat('inx')).toEqual({ value: 0, end: 0 });
  });

  it('reads nothing from text that is no number', () => {
    expect(strToFloat('abc')).toEqual({ value: 0, end: 0 });
  });

  it('starts at the offset it is given', () => {
    expect(strToFloat('M10,20', 4)).toEqual({ value: 20, end: 6 });
  });
});
