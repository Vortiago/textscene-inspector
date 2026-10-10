/**
 * StandardMaterial3D anisotropy, parse layer. Godot's −1..1 `anisotropy` passes through signed,
 * gated on `anisotropy_enabled`. The flowmap's render contract lives in
 * Component.material-anisotropy.test.tsx.
 */
import { describe, expect, it } from 'vitest';
import { parseStandardMaterial3DScalars } from './scalars';

const anisotropyOf = (properties: Record<string, string>) =>
  parseStandardMaterial3DScalars(properties).anisotropy;

describe('parseStandardMaterial3DScalars: anisotropy', () => {
  it('parses a positive anisotropy when enabled', () => {
    expect(anisotropyOf({ anisotropy_enabled: 'true', anisotropy: '0.8' })).toBe(0.8);
  });

  it('keeps the sign of a negative anisotropy, which picks the stretched axis', () => {
    expect(anisotropyOf({ anisotropy_enabled: 'true', anisotropy: '-0.8' })).toBe(-0.8);
  });

  it("takes Godot's default 0 when enabled with no strength", () => {
    // A .tscn omits default-valued properties, and Godot's `anisotropy` default is 0.
    expect(anisotropyOf({ anisotropy_enabled: 'true' })).toBe(0);
  });

  it.each([
    ['2.5', 1],
    ['-2.5', -1],
  ])('clamps an over-range anisotropy of %s to %s and keeps its sign (edge case)', (raw, clamped) => {
    expect(anisotropyOf({ anisotropy_enabled: 'true', anisotropy: raw })).toBe(clamped);
  });

  it.each<Record<string, string>>([
    { anisotropy: '-0.8' },
    { anisotropy_enabled: 'false', anisotropy: '0.8' },
  ])(
    'reads 0 without anisotropy_enabled, as Godot applies anisotropy only behind the flag (error case)',
    (properties) => {
      expect(anisotropyOf(properties)).toBe(0);
    }
  );

  it('leaves the other scalars to parse when anisotropy is on', () => {
    const result = parseStandardMaterial3DScalars({
      anisotropy_enabled: 'true',
      anisotropy: '0.5',
      metallic: '0.6',
      roughness: '0.3',
    });
    expect([result.anisotropy, result.metalness, result.roughness]).toEqual([0.5, 0.6, 0.3]);
  });
});
