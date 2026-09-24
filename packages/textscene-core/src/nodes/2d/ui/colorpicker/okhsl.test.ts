import { describe, expect, it } from 'vitest';
import { okhslToSrgb, srgbToOkhsl } from './okhsl';

describe('srgbToOkhsl', () => {
  it('black is the exact early return (ok_color.h:545-547)', () => {
    expect(srgbToOkhsl({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, l: 0 });
  });

  it('pure red matches an independent transcription of ok_color.h:542-593', () => {
    // h*360 = 29.23deg, the OKHSL hue that ok_color reports for sRGB red.
    const { h, s, l } = srgbToOkhsl({ r: 1, g: 0, b: 0 });
    expect(h).toBeCloseTo(0.0812052366, 6);
    expect(s).toBeCloseTo(1, 6);
    expect(l).toBeCloseTo(0.5680846525, 6);
  });

  it('pure green matches an independent transcription of ok_color.h:542-593', () => {
    const { h, s, l } = srgbToOkhsl({ r: 0, g: 1, b: 0 });
    expect(h).toBeCloseTo(0.3958203858, 6);
    expect(s).toBeCloseTo(1, 5);
    expect(l).toBeCloseTo(0.8445289645, 6);
  });
});

describe('okhslToSrgb', () => {
  it('l=1 is the exact early return, white (ok_color.h:490-493)', () => {
    expect(okhslToSrgb(0.3, 0.5, 1)).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it('l=0 is the exact early return, black (ok_color.h:495-498)', () => {
    expect(okhslToSrgb(0.3, 0.5, 0)).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('round-trips a chromatic colour through srgbToOkhsl (ok_color.h:484-593 are exact inverses)', () => {
    const { h, s, l } = srgbToOkhsl({ r: 0.2, g: 0.4, b: 0.8 });
    const back = okhslToSrgb(h, s, l);
    expect(back.r).toBeCloseTo(0.2, 3);
    expect(back.g).toBeCloseTo(0.4, 3);
    expect(back.b).toBeCloseTo(0.8, 3);
  });
});
