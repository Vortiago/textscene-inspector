import { describe, expect, it } from 'vitest';
import { degreesText, realText, rgbaText, tupleText } from './valueText';

describe('rgbaText', () => {
  it('writes a Color as rgba with 0-255 channels and a 2-decimal alpha', () => {
    expect(rgbaText([1, 0.5, 0, 1])).toBe('rgba(255, 128, 0, 1.00)');
  });

  it('rounds channels to integers and keeps a fractional alpha', () => {
    expect(rgbaText([0.662745, 0.247059, 1, 0.8])).toBe('rgba(169, 63, 255, 0.80)');
  });

  it('rounds a single-precision channel as Godot does', () => {
    expect(rgbaText([Math.fround(0.7), 0, 0, 1])).toBe('rgba(179, 0, 0, 1.00)');
  });
});

describe('degreesText', () => {
  it('writes radians as degrees to two places', () => {
    expect(degreesText(Math.PI / 2)).toBe('90.00');
  });
});

describe('tupleText', () => {
  it('writes each single-precision number at its shortest', () => {
    expect(tupleText([1, Math.fround(0.4)])).toBe('(1, 0.4)');
  });
});

describe('realText', () => {
  it('writes a single-precision number at its shortest', () => {
    expect(realText(Math.fround(0.05))).toBe('0.05');
  });

  it.each([
    [Infinity, 'inf'],
    [-Infinity, '-inf'],
    [NaN, 'nan'],
  ])('writes %s as Godot spells it', (real, text) => {
    expect(realText(real)).toBe(text);
  });

  it('writes a double-precision number whole', () => {
    expect(realText(0.1 + 0.2)).toBe('0.30000000000000004');
  });
});
