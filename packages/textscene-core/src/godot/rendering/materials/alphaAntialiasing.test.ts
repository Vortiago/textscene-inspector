import { describe, expect, it } from 'vitest';
import {
  AlphaAntiAliasing,
  hashAntialiasing,
  scissorAntialiasing,
  turnsOnAlphaToCoverage,
} from './alphaAntialiasing';
import type { EnumValue } from '../../classdb/enumNames.js';

describe('scissorAntialiasing', () => {
  it('moves the edge past the scissor threshold', () => {
    expect(scissorAntialiasing(AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE, 0.5, 0.3)).toEqual({
      mode: AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE,
      scissorThreshold: 0.5,
      edge: 0.8,
    });
  });

  it('clamps the moved edge to 1 (edge case)', () => {
    expect(
      scissorAntialiasing(AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE_AND_TO_ONE, 0.5, 1)?.edge
    ).toBe(1);
  });

  it('gives nothing while the mode is OFF (error case)', () => {
    expect(scissorAntialiasing(AlphaAntiAliasing.ALPHA_ANTIALIASING_OFF, 0.5, 0.3)).toBeNull();
  });
});

describe('hashAntialiasing', () => {
  it('keeps the edge as authored and cuts nothing before it', () => {
    expect(hashAntialiasing(AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE, 0.3)).toEqual({
      mode: AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE,
      scissorThreshold: 0,
      edge: 0.3,
    });
  });

  it('keeps an edge past 1 unclamped, as the hash path does (edge case)', () => {
    expect(hashAntialiasing(AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE, 1.5)?.edge).toBe(1.5);
  });

  it('gives nothing while the mode is OFF (error case)', () => {
    expect(hashAntialiasing(AlphaAntiAliasing.ALPHA_ANTIALIASING_OFF, 0.3)).toBeNull();
  });
});

describe('turnsOnAlphaToCoverage', () => {
  it.each([
    AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE,
    AlphaAntiAliasing.ALPHA_ANTIALIASING_ALPHA_TO_COVERAGE_AND_TO_ONE,
  ])('turns it on for mode %i', (mode) => {
    expect(turnsOnAlphaToCoverage(mode)).toBe(true);
  });

  it('leaves it off while the mode is OFF', () => {
    expect(turnsOnAlphaToCoverage(AlphaAntiAliasing.ALPHA_ANTIALIASING_OFF)).toBe(false);
  });

  it('leaves it off for a mode past the enum, which emits no render mode (error case)', () => {
    expect(turnsOnAlphaToCoverage(3 as EnumValue<typeof AlphaAntiAliasing>)).toBe(false);
  });
});
