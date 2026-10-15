/**
 * The tone-mapping white against Godot 4.6.3's `servers/rendering/storage/environment_storage.cpp`:
 * `environment_get_white` (l. 226) floors the authored white per curve, and
 * `environment_get_tonemap_parameters` (l. 274) normalises from it. Numbers are worked to full
 * precision, not through the helpers.
 */

import { describe, expect, it } from 'vitest';
import { ToneMapper, resolvedWhite, toneMappingWhiteParam } from './toneMapping.js';

describe('resolvedWhite — Godot’s environment_get_white floors', () => {
  it('passes an authored white through once it clears the floor (happy path)', () => {
    expect(resolvedWhite(ToneMapper.FILMIC, 6)).toBe(6);
    expect(resolvedWhite(ToneMapper.ACES, 6)).toBe(6);
    expect(resolvedWhite(ToneMapper.REINHARDT, 6)).toBe(6);
    expect(resolvedWhite(ToneMapper.AGX, 16.29)).toBe(16.29);
  });

  it('floors every SDR curve at 1.0, which is what keeps SCREEN glow working', () => {
    expect(resolvedWhite(ToneMapper.FILMIC, 0.5)).toBe(1);
    expect(resolvedWhite(ToneMapper.ACES, 0.5)).toBe(1);
    expect(resolvedWhite(ToneMapper.REINHARDT, 0.5)).toBe(1);
  });

  it('floors AgX at 2.0 — its shoulder needs the headroom (edge case)', () => {
    expect(resolvedWhite(ToneMapper.AGX, 1)).toBe(2);
    expect(resolvedWhite(ToneMapper.AGX, 0)).toBe(2);
  });

  it('ignores the authored white entirely for LINEAR, which does not normalise', () => {
    expect(resolvedWhite(ToneMapper.LINEAR, 6)).toBe(1);
    expect(resolvedWhite(ToneMapper.LINEAR, 0.1)).toBe(1);
  });

  it('lands an out-of-range mode in Godot’s own else-branch (error path)', () => {
    // `environment_get_white` tests LINEAR, then FILMIC/ACES, then AGX, and
    // falls through to Reinhard, so anything unrecognised gets `max(1, white)`.
    // `tonemap_mode` is decoded leniently, so a hand-edited scene reaches this.
    expect(resolvedWhite(99, 0.25)).toBe(1);
    expect(resolvedWhite(-1, 4)).toBe(4);
  });
});

describe('toneMappingWhiteParam: the shader’s tonemapper_params.x', () => {
  it('squares the white for REINHARDT', () => {
    expect(toneMappingWhiteParam(ToneMapper.REINHARDT, 1)).toBe(1);
    expect(toneMappingWhiteParam(ToneMapper.REINHARDT, 6)).toBe(36);
  });

  it('evaluates Hable’s biased curve at white for FILMIC', () => {
    // A = 0.22·2², B = 0.30·2, C = 0.10, D = 0.20, E = 0.01, F = 0.30.
    expect(toneMappingWhiteParam(ToneMapper.FILMIC, 1)).toBeCloseTo(0.5783549783549783, 12);
    expect(toneMappingWhiteParam(ToneMapper.FILMIC, 6)).toBeCloseTo(0.8733446519524618, 12);
  });

  it('evaluates the ACES curve at the bias-scaled white for ACES', () => {
    // Both ACES matrices have rows summing to 1, so a grey scales by the 1.8 bias. At white = 1:
    // (1.8 · (1.8 + 0.0245786) − 0.000090537) / (1.8 · (0.983729 · 1.8 + 0.432951) + 0.238081).
    expect(toneMappingWhiteParam(ToneMapper.ACES, 1)).toBeCloseTo(0.7810713385593705, 12);
    expect(toneMappingWhiteParam(ToneMapper.ACES, 6)).toBeCloseTo(0.9770112517226739, 12);
  });

  it('hands AGX the high-clip point itself, not a curve value', () => {
    expect(toneMappingWhiteParam(ToneMapper.AGX, 16.29)).toBe(16.29);
    expect(toneMappingWhiteParam(ToneMapper.AGX, 20)).toBe(20);
  });

  it('normalises by nothing for LINEAR', () => {
    expect(toneMappingWhiteParam(ToneMapper.LINEAR, 6)).toBe(1);
  });

  it('applies the floor before the curve, not after (regression)', () => {
    // A white under 1.0 must produce the same parameter as white = 1.0: Godot
    // floors in `environment_get_white`, upstream of every curve. Taking the
    // curve at the raw value instead would normalise against a divisor smaller
    // than 1 and blow the whole image out.
    expect(toneMappingWhiteParam(ToneMapper.REINHARDT, 0.5)).toBe(1);
    expect(toneMappingWhiteParam(ToneMapper.FILMIC, 0.5)).toBeCloseTo(
      toneMappingWhiteParam(ToneMapper.FILMIC, 1),
      12
    );
    expect(toneMappingWhiteParam(ToneMapper.ACES, 0)).toBeCloseTo(
      toneMappingWhiteParam(ToneMapper.ACES, 1),
      12
    );
    expect(toneMappingWhiteParam(ToneMapper.AGX, 1)).toBe(2);
  });

  it('falls back to no normalisation for a mode with no curve (error path)', () => {
    expect(toneMappingWhiteParam(99, 4)).toBe(1);
  });
});
