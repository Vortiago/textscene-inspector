import { describe, expect, it } from 'vitest';
import { EmissionOperator, emissionScalars, resolveEmission } from './emission';

/** `((c + 0.055) / 1.055) ^ 2.4` — Godot's `Color::srgb_to_linear`, unclamped. */
function linear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

describe('emissionScalars', () => {
  it('is fully off when emission is disabled', () => {
    const s = emissionScalars({ r: 1, g: 1, b: 1, a: 1 }, 4, false);
    expect(s.emissive).toEqual([0, 0, 0]);
    expect(s.emissiveIntensity).toBe(0);
  });

  it('converts sRGB→linear and leaves the energy as the intensity below 1', () => {
    const s = emissionScalars({ r: 0.5, g: 0.5, b: 0.5, a: 1 }, 3);
    // Peak floors at 1, so an in-range colour keeps energy as the intensity.
    expect(s.emissiveIntensity).toBeCloseTo(3, 6);
    expect(s.emissive[0]).toBeCloseTo(linear(0.5), 6);
  });

  it('converts BEFORE taking the peak, so an HDR colour keeps its hue', () => {
    const s = emissionScalars({ r: 2, g: 0.5, b: 0, a: 1 }, 1);
    const peak = linear(2);
    expect(s.emissiveIntensity).toBeCloseTo(peak, 6);
    expect(s.emissive[0]).toBeCloseTo(1, 6);
    expect(s.emissive[1]).toBeCloseTo(linear(0.5) / peak, 6);
    // Converting after normalising would give linear(0.5 / 2) / 1 instead —
    // a different, more saturated colour.
    expect(s.emissive[1]).not.toBeCloseTo(linear(0.5 / 2), 4);
  });

  it('reconstructs the linear colour when intensity and colour are multiplied back', () => {
    const s = emissionScalars({ r: 2, g: 0.5, b: 0, a: 1 }, 2);
    // What the shader ultimately computes is emissive * intensity, and that must
    // equal Godot's linear(emission) * energy channel for channel.
    expect(s.emissive[0] * s.emissiveIntensity).toBeCloseTo(linear(2) * 2, 5);
    expect(s.emissive[1] * s.emissiveIntensity).toBeCloseTo(linear(0.5) * 2, 5);
  });

  it('treats an absent colour as black, matching Godot\'s default', () => {
    const s = emissionScalars(undefined, 2);
    expect(s.emissive).toEqual([0, 0, 0]);
    expect(s.emissiveIntensity).toBeCloseTo(2, 6);
  });

  it('never yields a negative intensity', () => {
    expect(emissionScalars({ r: 1, g: 1, b: 1, a: 1 }, -5).emissiveIntensity).toBe(0);
  });
});

describe('resolveEmission', () => {
  const red = emissionScalars({ r: 1, g: 0, b: 0, a: 1 }, 2);
  const black = emissionScalars(undefined, 2);

  it('ADD without a texture is the colour at its energy', () => {
    const r = resolveEmission(red, EmissionOperator.ADD, false);
    expect(r.emissive).toEqual(red.emissive);
    expect(r.emissiveIntensity).toBeCloseTo(2, 6);
  });

  it('ADD with a texture and a black colour becomes a white emissive', () => {
    // Godot computes `(0 + tex) * energy`; three spells that as white × energy.
    // Multiplying the authored black through would render nothing at all.
    const r = resolveEmission(black, EmissionOperator.ADD, true);
    expect(r.emissive).toEqual([1, 1, 1]);
    expect(r.emissiveIntensity).toBeCloseTo(2, 6);
  });

  it('ADD with a texture and a lit colour falls back to multiplying (documented gap)', () => {
    const r = resolveEmission(red, EmissionOperator.ADD, true);
    expect(r.emissive).toEqual(red.emissive);
  });

  it('MULTIPLY without a texture is no emission at all', () => {
    // `hint_default_black` makes the absent sampler read zero, and Godot then
    // multiplies the colour by it.
    const r = resolveEmission(red, EmissionOperator.MULTIPLY, false);
    expect(r.emissive).toEqual([0, 0, 0]);
    expect(r.emissiveIntensity).toBe(0);
  });

  it('MULTIPLY with a texture passes the colour through unchanged', () => {
    const r = resolveEmission(red, EmissionOperator.MULTIPLY, true);
    expect(r.emissive).toEqual(red.emissive);
    expect(r.emissiveIntensity).toBeCloseTo(2, 6);
  });

  it('defaults to ADD when no operator is given', () => {
    expect(resolveEmission(black, undefined, true).emissive).toEqual([1, 1, 1]);
  });
});
