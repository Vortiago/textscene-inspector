import { describe, expect, it } from 'vitest';
import { degreesText, rgbaText, tupleText } from './valueText';

describe('rgbaText', () => {
  it('writes a Color as rgba with 0-255 channels and a 2-decimal alpha', () => {
    expect(rgbaText([1, 0.5, 0, 1])).toBe('rgba(255, 128, 0, 1.00)');
  });

  it('rounds channels to integers and keeps a fractional alpha', () => {
    expect(rgbaText([0.662745, 0.247059, 1, 0.8])).toBe('rgba(169, 63, 255, 0.80)');
  });
});

describe('degreesText', () => {
  it('writes radians as degrees to two places', () => {
    expect(degreesText(Math.PI / 2)).toBe('90.00');
  });
});

describe('tupleText', () => {
  it('writes each number as JavaScript does', () => {
    expect(tupleText([1, 0.5])).toBe('(1, 0.5)');
  });
});
