import { describe, expect, it } from 'vitest';
import { unitByte } from './unitByte';

describe('unitByte', () => {
  it('keeps 0 and 1 exact', () => {
    expect(unitByte(0)).toBe(0);
    expect(unitByte(1)).toBe(1);
  });

  it('truncates to the byte below', () => {
    // 0.5 × 255 = 127.5, which the cast truncates to 127.
    expect(unitByte(0.5)).toBe(127 / 255);
  });

  it('narrows to float32 before it scales', () => {
    // 0.7 as float32 is 0.699999988…, so 178.4999… truncates to 178.
    expect(unitByte(0.7)).toBe(178 / 255);
  });

  it('clamps a value outside 0..1 to the byte range', () => {
    expect(unitByte(-0.5)).toBe(0);
    expect(unitByte(1.5)).toBe(1);
  });
});
