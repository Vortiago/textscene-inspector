/**
 * The fog's shadow terms, run from the light pass's own GLSL, against the values Godot 4.6.3's
 * `volumetric_fog_process.glsl` gives (`.glsl:418-422`, `:509`, `:566`, `:573`).
 */
import { describe, expect, it } from 'vitest';
import { scalarGlslFunction } from '../testing/glslScalar';
import { FOG_LIGHT_FRAGMENT } from './volumetricFogShaders';

const fogShadow = scalarGlslFunction(FOG_LIGHT_FRAGMENT, 'fogShadow');
const fogShadowFade = scalarGlslFunction(FOG_LIGHT_FRAGMENT, 'fogShadowFade');
const fogShadowAttenuation = scalarGlslFunction(FOG_LIGHT_FRAGMENT, 'fogShadowAttenuation');
const spotCellDepth = scalarGlslFunction(FOG_LIGHT_FRAGMENT, 'spotCellDepth');
const skyRoughness = scalarGlslFunction(FOG_LIGHT_FRAGMENT, 'skyRoughness');

describe('the fog shadow term', () => {
  it('darkens a cell a tenth of a unit behind the caster to 1/e', () => {
    // Depths 0.51 and 0.5 of a 10-unit range: the cell lies 0.1 units past the caster.
    expect(fogShadow(0.51, 0.5, 10)).toBeCloseTo(Math.exp(-1), 6);
  });

  it('leaves a cell in front of the caster unshadowed (edge case)', () => {
    expect(fogShadow(0.49, 0.5, 10)).toBe(1);
  });

  it('darkens faster over a longer depth range', () => {
    expect(fogShadow(0.51, 0.5, 30)).toBeCloseTo(Math.exp(-3), 6);
  });
});

describe('the directional fog shadow fade', () => {
  it('keeps the shadow before the fade starts', () => {
    expect(fogShadowFade(0.2, 7, 8, 10)).toBe(0.2);
  });

  it('lifts the shadow halfway at the middle of the fade', () => {
    expect(fogShadowFade(0.2, 9, 8, 10)).toBeCloseTo(0.6, 6);
  });

  it('leaves no shadow past the fade (edge case)', () => {
    expect(fogShadowFade(0.2, 12, 8, 10)).toBe(1);
  });

  it('keeps the shadow of a split sun no fit has faded (edge case)', () => {
    expect(fogShadowFade(0.2, 12, 0, 0)).toBe(0.2);
  });
});

describe('the fog shadow attenuation', () => {
  it('darkens a full shadow to one less the opacity', () => {
    expect(fogShadowAttenuation(0, 0.75)).toBeCloseTo(0.25, 6);
  });

  it('leaves a lit cell lit at any opacity (edge case)', () => {
    expect(fogShadowAttenuation(1, 0.75)).toBe(1);
  });
});

describe('the spot fog cell depth', () => {
  it('pushes a cell away from the light by the bias', () => {
    expect(spotCellDepth(0.5, 0.02)).toBeCloseTo(0.52, 6);
  });

  it('leaves a cell where it is with no bias (edge case)', () => {
    expect(spotCellDepth(0.5, 0)).toBe(0.5);
  });
});

describe('the sky roughness the ambient reads the sky at', () => {
  it('reads a clear froxel at mip 2 of 7', () => {
    expect(skyRoughness(0)).toBeCloseTo(2 / 7, 6);
  });

  it('reads a denser froxel at a blurrier mip', () => {
    expect(skyRoughness(0.05)).toBeCloseTo(2.25 / 7, 6);
  });

  it('stops at the coarsest mip (edge case)', () => {
    expect(skyRoughness(4)).toBe(1);
  });
});
