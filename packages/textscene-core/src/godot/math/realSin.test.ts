import { describe, expect, it } from 'vitest';
import { cosReal, sinReal } from './realSin.js';

const f = Math.fround;

describe('sinReal', () => {
  it('rounds as glibc does where the correctly rounded sine is one bit lower', () => {
    expect(f(Math.sin(0.13817688822746277))).toBe(0.13773760199546814);
    expect(sinReal(0.13817688822746277)).toBe(0.13773761689662933);
  });

  it('fuses the multiply-adds, as the FMA build does', () => {
    expect(sinReal(53.42251968383789)).toBe(-0.015443959273397923);
  });

  it('reduces a large operand by 4/π to 192 bits', () => {
    expect(sinReal(f(1e30))).toBe(f(-0.791163445));
    expect(sinReal(f(-1e30))).toBe(f(0.791163445));
  });

  it('returns a tiny operand itself, keeping its sign', () => {
    expect(sinReal(-0)).toBe(-0);
    expect(sinReal(f(1e-30))).toBe(f(1e-30));
  });

  it('gives NaN for an infinite or NaN operand', () => {
    expect(sinReal(Infinity)).toBeNaN();
    expect(sinReal(NaN)).toBeNaN();
  });
});

describe('cosReal', () => {
  it('fuses the multiply-adds, as the FMA build does', () => {
    expect(cosReal(17.278738021850586)).toBe(-2.1572894183918834e-5);
  });

  it('reduces a large operand by 4/π to 192 bits', () => {
    expect(cosReal(f(1e30))).toBe(f(-0.61160481));
  });

  it('gives 1 for a tiny operand', () => {
    expect(cosReal(-0)).toBe(1);
  });

  it('gives NaN for an infinite operand', () => {
    expect(cosReal(-Infinity)).toBeNaN();
  });
});
