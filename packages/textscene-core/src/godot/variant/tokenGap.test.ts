import { describe, expect, it } from 'vitest';
import { isTokenGap } from './tokenGap';

describe('isTokenGap', () => {
  it.each([0, 9, 10, 31, 32])('skips the code %i', (code) => {
    expect(isTokenGap(code)).toBe(true);
  });

  it.each([33, 0x7f, 0xa0, 0xfeff])('reads the code %i', (code) => {
    expect(isTokenGap(code)).toBe(false);
  });
});
