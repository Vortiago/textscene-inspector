/**
 * The sRGB transfer function, and the 8-bit rounding. The float halves must stay inverses: a colour
 * the ColorPicker normalises goes to linear and back, and a byte of drift there shows only in a
 * golden image.
 */
import { describe, expect, it } from 'vitest';
import {
  channelToByte,
  linearChannelToSRGBF32,
  sRGBChannelToLinear,
  sRGBChannelToLinearF32,
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

describe('linearChannelToSRGBF32', () => {
  it('keeps the linear segment below 0.0031308, as Color::linear_to_srgb does', () => {
    expect(linearChannelToSRGBF32(0.003)).toBe(Math.fround(Math.fround(12.92) * Math.fround(0.003)));
  });

  it('joins its two segments at the threshold', () => {
    const below = linearChannelToSRGBF32(0.0031307);
    const at = linearChannelToSRGBF32(0.0031308);
    expect(Math.abs(at - below)).toBeLessThan(1e-5);
  });

  it('extrapolates an HDR channel above 1 rather than clamping it', () => {
    expect(linearChannelToSRGBF32(2)).toBeGreaterThan(1);
  });

  it('keeps a negative channel on the linear segment', () => {
    expect(linearChannelToSRGBF32(-0.5)).toBe(Math.fround(Math.fround(12.92) * -0.5));
  });
});

describe('the two float halves', () => {
  it('bring every sRGB byte back to itself through linear', () => {
    const drifted = BYTES.filter(
      (byte) => channelToByte(linearChannelToSRGBF32(sRGBChannelToLinearF32(byte / 255))) !== byte
    );
    expect(drifted).toEqual([]);
  });

  it('bring every linear byte back to itself through sRGB', () => {
    const drifted = BYTES.filter(
      (byte) => channelToByte(sRGBChannelToLinearF32(linearChannelToSRGBF32(byte / 255))) !== byte
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

  it('multiplies in float, so a float32 0.9 lands on 229.5 and rounds up, as get_b8 does', () => {
    expect(channelToByte(Math.fround(0.9))).toBe(230);
  });

  it('clamps a channel outside 0..1 (edge case)', () => {
    expect(channelToByte(-0.2)).toBe(0);
    expect(channelToByte(1.7)).toBe(255);
  });
});

// Measured: Godot 4.6.3 prints `Color(0.5, 0.02, 1.5).srgb_to_linear()` and
// `Color(0.2, 0.001, 2.0).linear_to_srgb()` with these channels, to the last float bit.
describe('sRGBChannelToLinearF32', () => {
  it("matches Godot's float Color::srgb_to_linear on the curve, the linear segment and above 1", () => {
    expect([0.5, 0.02, 1.5].map(sRGBChannelToLinearF32)).toEqual([
      0.21404114365577698, 0.0015479875728487968, 2.5371556282043457,
    ]);
  });
});

describe('linearChannelToSRGBF32', () => {
  it("matches Godot's float Color::linear_to_srgb on the curve, the linear segment and above 1", () => {
    expect([0.2, 0.001, 2.0].map(linearChannelToSRGBF32)).toEqual([
      0.4845292568206787, 0.012920000590384007, 1.3532559871673584,
    ]);
  });
});
