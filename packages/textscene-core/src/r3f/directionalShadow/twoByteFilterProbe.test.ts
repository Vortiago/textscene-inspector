import { describe, expect, it } from 'vitest';
import { isFullPrecisionByte } from './twoByteFilterProbe.js';

describe('the two-byte filter probe', () => {
  it('reads half a depth step as a full-precision filter', () => {
    expect(isFullPrecisionByte(128)).toBe(true);
  });

  it('reads a whole depth as a filter that rounds each byte to 8 bits', () => {
    expect([isFullPrecisionByte(0), isFullPrecisionByte(255)]).toEqual([false, false]);
  });
});
