import { describe, expect, it } from 'vitest';
import { unitByte } from './unitByte';

describe('unitByte', () => {
  it.each([0, 1])('keeps %s exact', (value) => {
    expect(unitByte(value)).toBe(value);
  });

  // `pnpm ref:godot --mode 2d` draws a Polygon2D Color(0.08, 0.08, 0.10) as rgb(20, 20, 25),
  // Color(0.40, 0.90, 0.50) as rgb(102, 229, 127) and Color(0.85, 0.85, 0.80) as rgb(216, 216, 204).
  it.each([
    [0.1, 25],
    [0.5, 127],
    [0.85, 216],
    [0.9, 229],
  ])('truncates %s to byte %s, never rounds', (value, byte) => {
    expect(unitByte(value)).toBe(byte / 255);
  });

  it('narrows to float32 before it scales', () => {
    // 0.7 as float32 is 0.699999988…, so 178.4999… truncates to 178.
    expect(unitByte(0.7)).toBe(178 / 255);
  });

  it.each([
    [-0.5, 0],
    [1.5, 1],
  ])('clamps %s outside 0..1 to %s', (value, clamped) => {
    expect(unitByte(value)).toBe(clamped);
  });
});
