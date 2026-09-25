/**
 * The sRGB transfer function both ways, and the 8-bit rounding. The two halves must stay exact
 * inverses: a colour the ColorPicker normalises goes to linear and back, and a byte of drift there
 * shows only in a golden image.
 */
import { describe, expect, it } from 'vitest';
import {
  channelToByte,
  linearChannelToSRGB,
  sRGBChannelToLinear,
  sRGBToLinearRGB,
} from './colorSpace';

const BYTES = Array.from({ length: 256 }, (_, byte) => byte);

describe('sRGBChannelToLinear', () => {
  it('maps the ends and mid-grey onto the IEC 61966-2-1 curve', () => {
    expect(sRGBChannelToLinear(0)).toBe(0);
    expect(sRGBChannelToLinear(1)).toBeCloseTo(1, 12);
    expect(sRGBChannelToLinear(0.5)).toBeCloseTo(0.214041, 6);
  });

  it('keeps the linear segment below 0.04045, as Color::srgb_to_linear does', () => {
    expect(sRGBChannelToLinear(0.04)).toBe(0.04 / 12.92);
  });

  it('takes the power segment at 0.04045 itself, where Godot compares with `<`', () => {
    expect(sRGBChannelToLinear(0.04045)).toBe(Math.pow((0.04045 + 0.055) / 1.055, 2.4));
    expect(sRGBChannelToLinear(0.04045)).not.toBe(0.04045 / 12.92);
  });

  it('extrapolates an HDR channel above 1 rather than clamping it', () => {
    expect(sRGBChannelToLinear(2)).toBeGreaterThan(1);
  });
});

describe('linearChannelToSRGB', () => {
  it('maps the ends and linear mid-grey onto the IEC 61966-2-1 curve', () => {
    expect(linearChannelToSRGB(0)).toBe(0);
    expect(linearChannelToSRGB(1)).toBeCloseTo(1, 12);
    expect(linearChannelToSRGB(0.214041)).toBeCloseTo(0.5, 6);
  });

  it('keeps the linear segment below 0.0031308, as Color::linear_to_srgb does', () => {
    expect(linearChannelToSRGB(0.003)).toBe(12.92 * 0.003);
  });

  it('takes the power segment at 0.0031308 itself, where Godot compares with `<`', () => {
    expect(linearChannelToSRGB(0.0031308)).toBe(1.055 * Math.pow(0.0031308, 1 / 2.4) - 0.055);
    expect(linearChannelToSRGB(0.0031308)).not.toBe(12.92 * 0.0031308);
  });

  it('joins its two segments at the threshold', () => {
    const below = linearChannelToSRGB(0.0031308 - 1e-12);
    const at = linearChannelToSRGB(0.0031308);
    expect(Math.abs(at - below)).toBeLessThan(1e-6);
  });

  it('extrapolates an HDR channel above 1 rather than clamping it', () => {
    expect(linearChannelToSRGB(2)).toBeGreaterThan(1);
  });

  it('keeps a negative channel on the linear segment', () => {
    expect(linearChannelToSRGB(-0.5)).toBe(12.92 * -0.5);
  });
});

describe('the two halves', () => {
  it('bring every sRGB byte back to itself through linear', () => {
    const drifted = BYTES.filter(
      (byte) => channelToByte(linearChannelToSRGB(sRGBChannelToLinear(byte / 255))) !== byte
    );
    expect(drifted).toEqual([]);
  });

  it('drift from each other by no more than float rounding, far inside one byte', () => {
    const drift = BYTES.map((byte) => {
      const start = byte / 255;
      return Math.abs(linearChannelToSRGB(sRGBChannelToLinear(start)) - start);
    });
    const worst = Math.max(...drift);
    expect(worst).toBeLessThan(1e-12);
  });

  it('bring every linear byte back to itself through sRGB', () => {
    const drifted = BYTES.filter(
      (byte) => channelToByte(sRGBChannelToLinear(linearChannelToSRGB(byte / 255))) !== byte
    );
    expect(drifted).toEqual([]);
  });
});

describe('sRGBToLinearRGB', () => {
  it('converts each channel on its own', () => {
    expect(sRGBToLinearRGB(0, 0.5, 1)).toEqual([
      sRGBChannelToLinear(0),
      sRGBChannelToLinear(0.5),
      sRGBChannelToLinear(1),
    ]);
  });
});

describe('channelToByte', () => {
  it('rounds a 0..1 channel to the nearest byte', () => {
    expect(channelToByte(0)).toBe(0);
    expect(channelToByte(1)).toBe(255);
    expect(channelToByte(0.5)).toBe(128);
  });

  it('clamps a channel outside 0..1', () => {
    expect(channelToByte(-0.2)).toBe(0);
    expect(channelToByte(1.7)).toBe(255);
  });
});
