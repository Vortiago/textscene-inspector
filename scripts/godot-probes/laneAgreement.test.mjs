import { describe, expect, it } from 'vitest';
import { lanesAgree } from './laneAgreement.mjs';

const QUIET_NAN = 0x7fc00000;
const NEGATIVE_QUIET_NAN = 0xffc00000;

describe('whether a lane agrees with Godot', () => {
  it('passes a float NaN lane of either sign', () => {
    expect(lanesAgree(QUIET_NAN, NEGATIVE_QUIET_NAN, true)).toBe(true);
  });

  it('fails a float NaN lane against zero', () => {
    expect(lanesAgree(QUIET_NAN, 0, true)).toBe(false);
  });

  it('fails a float NaN lane against an infinity', () => {
    expect(lanesAgree(QUIET_NAN, 0x7f800000, true)).toBe(false);
  });

  it('fails negative zero against positive zero', () => {
    expect(lanesAgree(0x80000000, 0, true)).toBe(false);
  });

  it('compares an int lane bit for bit, even with the bits of two NaNs', () => {
    expect(lanesAgree(QUIET_NAN, NEGATIVE_QUIET_NAN, false)).toBe(false);
  });
});
