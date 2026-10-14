/**
 * The density a FogVolume adds to a froxel, run from the light pass's own GLSL, against Godot
 * 4.6.3's fog shaders (`scene/resources/3d/fog_material.cpp:158-163`,
 * `renderer_rd/shaders/environment/volumetric_fog.glsl:209-226`).
 */
import { describe, expect, it } from 'vitest';
import { scalarGlslFunction } from '../testing/glslScalar';
import { FOG_VOLUME_GLSL } from './fogVolumeShader';

const fogMaterialDensity = scalarGlslFunction(FOG_VOLUME_GLSL, 'fogMaterialDensity');
const defaultFogCoverage = scalarGlslFunction(FOG_VOLUME_GLSL, 'defaultFogCoverage');
const densityUnits = scalarGlslFunction(FOG_VOLUME_GLSL, 'densityUnits');
const densityTexel = scalarGlslFunction(FOG_VOLUME_GLSL, 'densityTexel');

/** A box FogMaterial of density 1, size 3, no height falloff and the default edge fade 0.1. */
const boxDensity = (sdf: number) => fogMaterialDensity(1, 0, 0, sdf, 3, 0.1);

describe('the FogMaterial density', () => {
  it('adds the full density at the centre of a 3-unit box, 1.5 units from every face', () => {
    expect(boxDensity(-1.5)).toBe(1);
  });

  it('adds nothing outside the box', () => {
    expect(boxDensity(0.5)).toBe(0);
  });

  it('fades halfway between the centre and a face by the edge fade', () => {
    expect(boxDensity(-0.75)).toBeCloseTo(0.5 ** 0.1, 6);
  });

  it('adds nothing outside the shape under an edge fade of 0, as Godot draws it (edge case)', () => {
    expect(fogMaterialDensity(1, 0, 0, 0.5, 3, 0)).toBe(0);
  });

  it('adds the full density right up to the edge under an edge fade of 0', () => {
    expect(fogMaterialDensity(1, 0, 0, -0.01, 3, 0)).toBe(1);
  });

  it('halves the density per unit of height above the origin under a falloff of 1', () => {
    expect(fogMaterialDensity(1, 2, 1, -1.5, 3, 0.1)).toBeCloseTo(0.25, 6);
  });

  it('keeps the full density below the origin, where the falloff clamps at 1 (edge case)', () => {
    expect(fogMaterialDensity(1, -2, 1, -1.5, 3, 0.1)).toBe(1);
  });

  it('keeps a negative density, which carves fog out', () => {
    expect(fogMaterialDensity(-2, 0, 0, -1.5, 3, 0.1)).toBe(-2);
  });
});

describe('the default fog material coverage', () => {
  it('covers a cell inside the shape fully', () => {
    expect(defaultFogCoverage(-1)).toBe(1);
  });

  it('fades over the tenth of a unit inside the edge', () => {
    expect(defaultFogCoverage(-0.05)).toBeCloseTo(0.5, 6);
  });

  it('covers nothing outside the shape (edge case)', () => {
    expect(defaultFogCoverage(0.05)).toBe(0);
  });
});

describe('the density units a volume adds', () => {
  it('adds a density in 1024ths', () => {
    expect(densityUnits(0.5)).toBe(512);
  });

  it('adds nothing for a density under one unit (edge case)', () => {
    expect(densityUnits(0.0009)).toBe(0);
  });

  it('truncates a negative density towards zero', () => {
    expect(densityUnits(-0.0015)).toBe(-1);
  });
});

describe('the density texture texel a coordinate samples', () => {
  it('samples the texel a coordinate falls in, across a 64-texel axis', () => {
    expect(densityTexel(0.5, 64)).toBe(32);
  });

  it("stops at the first texel's centre, so the texture clamps to its edge as Godot binds it", () => {
    expect(densityTexel(0, 64)).toBe(0.5);
  });

  it("stops at the last texel's centre, so no neighbour in the atlas bleeds in (edge case)", () => {
    expect(densityTexel(1, 64)).toBe(63.5);
  });
});
