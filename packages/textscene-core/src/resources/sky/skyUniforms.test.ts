/**
 * Godot-space sky properties to shader uniforms. The "ad hoc" conversions have
 * no derivation, so the curve assertions pin the defaults the shader source
 * declares, listed in the first test.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { decodeSkyMaterial } from './decode';
import { skyUniforms, type SkyLight } from './skyUniforms';
import type { ProceduralSkyProperties } from './types';

const procedural = (overrides: Partial<ProceduralSkyProperties> = {}) => ({
  ...(decodeSkyMaterial('ProceduralSkyMaterial', {}) as ProceduralSkyProperties),
  ...overrides,
});

const value = (uniforms: Record<string, { value: unknown }>, name: string) => uniforms[name]?.value;

describe('skyUniforms — ProceduralSkyMaterial curve conversions', () => {
  it('reproduces the shader’s declared defaults from Godot’s authored defaults', () => {
    // uniform float inv_sky_curve    = 4.0;      // from sky_curve    0.15
    // uniform float inv_ground_curve = 30.0;     // from ground_curve 0.02
    // uniform float sun_angle_max    = 0.877;    // from 30 degrees
    // uniform float inv_sun_curve    = 22.78;    // from sun_curve    0.15
    const u = skyUniforms(procedural(), []);
    expect(value(u, 'inv_sky_curve')).toBeCloseTo(4.0, 5);
    expect(value(u, 'inv_ground_curve')).toBeCloseTo(30.0, 5);
    expect(value(u, 'sun_angle_max')).toBeCloseTo(0.866, 3);
    expect(value(u, 'inv_sun_curve')).toBeCloseTo(22.78, 2);
  });

  it('scales the curve uniforms as the authored curve changes', () => {
    const u = skyUniforms(procedural({ sky_curve: 0.3, ground_curve: 0.06 }), []);
    expect(value(u, 'inv_sky_curve')).toBeCloseTo(2.0, 5);
    expect(value(u, 'inv_ground_curve')).toBeCloseTo(10.0, 5);
  });

  it('uploads the cosine of sun_angle_max, so 0 degrees is a point and 90 a hemisphere', () => {
    expect(value(skyUniforms(procedural({ sun_angle_max: 0 }), []), 'sun_angle_max')).toBeCloseTo(1);
    expect(value(skyUniforms(procedural({ sun_angle_max: 90 }), []), 'sun_angle_max')).toBeCloseTo(0);
  });
});

describe('skyUniforms — colours', () => {
  it('converts Godot sRGB colours into three’s linear working space', () => {
    const u = skyUniforms(procedural({ sky_top_color: { r: 0.5, g: 0.5, b: 0.5, a: 1 } }), []);
    const top = value(u, 'sky_top_color') as THREE.Color;
    // sRGB 0.5 is ~0.214 linear. A shader fed the raw 0.5 renders visibly
    // brighter than Godot, which uploads `source_color` uniforms converted.
    expect(top.r).toBeCloseTo(0.214, 3);
  });

  it('multiplies the sky colours by sky_energy_multiplier in sRGB, before the linear conversion', () => {
    // Godot scales the Color, then converts the `source_color` uniform (`sky_material.cpp:41`,
    // `material_storage.cpp:459`): sRGB 0.5 × 4 is sRGB 2.0, about 4.95 linear, not 0.214 × 4.
    const u = skyUniforms(
      procedural({ sky_top_color: { r: 0.5, g: 0.5, b: 0.5, a: 1 }, sky_energy_multiplier: 4 }),
      []
    );
    expect((value(u, 'sky_top_color') as THREE.Color).r).toBeCloseTo(4.95, 2);
  });

  it('multiplies the ground colours by ground_energy_multiplier, not the sky’s', () => {
    const u = skyUniforms(
      procedural({
        ground_bottom_color: { r: 0.2, g: 0.2, b: 0.2, a: 1 },
        sky_energy_multiplier: 4,
        ground_energy_multiplier: 2,
      }),
      []
    );
    // sRGB 0.2 × 2 is sRGB 0.4, about 0.133 linear.
    expect((value(u, 'ground_bottom_color') as THREE.Color).r).toBeCloseTo(0.133, 3);
  });

  it('carries energy_multiplier through as the shader’s exposure', () => {
    expect(value(skyUniforms(procedural({ energy_multiplier: 3 }), []), 'exposure')).toBe(3);
  });
});

describe('skyUniforms — directional lights', () => {
  const light = (overrides: Partial<SkyLight> = {}): SkyLight => ({
    direction: new THREE.Vector3(0, 1, 0),
    color: new THREE.Color(1, 1, 1),
    energy: 1,
    angularRadius: 0,
    ...overrides,
  });

  it('disables all four light slots when the scene has no directional light', () => {
    const u = skyUniforms(procedural(), []);
    for (const i of [0, 1, 2, 3]) {
      expect(value(u, `LIGHT${i}_ENABLED`)).toBe(false);
    }
  });

  it('enables exactly as many slots as there are lights', () => {
    const u = skyUniforms(procedural(), [light(), light()]);
    expect(value(u, 'LIGHT0_ENABLED')).toBe(true);
    expect(value(u, 'LIGHT1_ENABLED')).toBe(true);
    expect(value(u, 'LIGHT2_ENABLED')).toBe(false);
  });

  it('takes only the first four — Godot’s sky shader has four slots', () => {
    const u = skyUniforms(procedural(), [light(), light(), light(), light(), light()]);
    expect(value(u, 'LIGHT3_ENABLED')).toBe(true);
    expect(u.LIGHT4_ENABLED).toBeUndefined();
  });

  it('carries each light’s direction, colour and energy into its own slot', () => {
    const u = skyUniforms(procedural(), [
      light({ direction: new THREE.Vector3(1, 0, 0), energy: 2 }),
      light({ color: new THREE.Color(1, 0, 0), energy: 3 }),
    ]);
    expect((value(u, 'LIGHT0_DIRECTION') as THREE.Vector3).x).toBeCloseTo(1);
    expect(value(u, 'LIGHT0_ENERGY')).toBe(2);
    expect((value(u, 'LIGHT1_COLOR') as THREE.Color).g).toBeCloseTo(0);
    expect(value(u, 'LIGHT1_ENERGY')).toBe(3);
  });

  it('normalises the direction — the shader dots it against a unit eye vector', () => {
    const u = skyUniforms(procedural(), [light({ direction: new THREE.Vector3(0, 5, 0) })]);
    expect((value(u, 'LIGHT0_DIRECTION') as THREE.Vector3).length()).toBeCloseTo(1);
  });
});

describe('skyUniforms — other sky materials', () => {
  it('exposes the panorama sky’s exposure', () => {
    const sky = decodeSkyMaterial('PanoramaSkyMaterial', {})!;
    expect(value(skyUniforms(sky, []), 'exposure')).toBe(1);
  });

  it('exposes the physical sky’s atmosphere scalars under the shader’s own names', () => {
    const sky = decodeSkyMaterial('PhysicalSkyMaterial', { turbidity: '4' })!;
    const u = skyUniforms(sky, []);
    expect(value(u, 'turbidity')).toBe(4);
    expect(value(u, 'rayleigh')).toBe(2);
    expect(value(u, 'mie')).toBe(0.005);
    expect(value(u, 'mie_eccentricity')).toBe(0.8);
  });
});
