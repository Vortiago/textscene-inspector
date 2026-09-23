/**
 * Sky resource decode: `Sky` and the three sky materials. Every default is the
 * value Godot's constructor installs (`scene/resources/3d/sky_material.cpp`).
 * Values stay in Godot space: `sky_curve` is the authored 0.15, and `build.ts`
 * converts it on upload.
 */
import { describe, expect, it } from 'vitest';
import { decodeSkyMaterial, skyMaterialRef } from './decode';

describe('decodeSkyMaterial — ProceduralSkyMaterial', () => {
  it('applies Godot’s constructor defaults for a bare material', () => {
    const sky = decodeSkyMaterial('ProceduralSkyMaterial', {});
    expect(sky).toEqual({
      kind: 'procedural',
      sky_top_color: { r: 0.385, g: 0.454, b: 0.55, a: 1 },
      sky_horizon_color: { r: 0.6463, g: 0.6558, b: 0.6708, a: 1 },
      sky_curve: 0.15,
      sky_energy_multiplier: 1,
      ground_bottom_color: { r: 0.2, g: 0.169, b: 0.133, a: 1 },
      ground_horizon_color: { r: 0.6463, g: 0.6558, b: 0.6708, a: 1 },
      ground_curve: 0.02,
      ground_energy_multiplier: 1,
      sun_angle_max: 30,
      sun_curve: 0.15,
      energy_multiplier: 1,
    });
  });

  it('reads authored colours and scalars', () => {
    const sky = decodeSkyMaterial('ProceduralSkyMaterial', {
      sky_top_color: 'Color(0.1, 0.2, 0.3, 1)',
      ground_bottom_color: 'Color(0.4, 0.5, 0.6, 1)',
      sky_curve: '0.5',
      energy_multiplier: '2.5',
    });
    expect(sky).toMatchObject({
      sky_top_color: { r: 0.1, g: 0.2, b: 0.3, a: 1 },
      ground_bottom_color: { r: 0.4, g: 0.5, b: 0.6, a: 1 },
      sky_curve: 0.5,
      energy_multiplier: 2.5,
    });
  });

  it('keeps the untouched properties at their defaults when one is authored', () => {
    const sky = decodeSkyMaterial('ProceduralSkyMaterial', { sky_curve: '0.5' });
    expect(sky).toMatchObject({ ground_curve: 0.02, sun_angle_max: 30 });
  });

  it('falls back to the default for a malformed scalar rather than NaN', () => {
    const sky = decodeSkyMaterial('ProceduralSkyMaterial', { sky_curve: 'not-a-number' });
    expect(sky).toMatchObject({ sky_curve: 0.15 });
  });
});

describe('decodeSkyMaterial — PanoramaSkyMaterial', () => {
  it('carries the panorama reference and Godot’s energy default', () => {
    const sky = decodeSkyMaterial('PanoramaSkyMaterial', {
      panorama: 'ExtResource("1_sky")',
    });
    expect(sky).toEqual({
      kind: 'panorama',
      panorama: 'ExtResource("1_sky")',
      energy_multiplier: 1,
    });
  });

  it('parses with no panorama at all — an unset texture is a black sky, not an error', () => {
    expect(decodeSkyMaterial('PanoramaSkyMaterial', {})).toEqual({
      kind: 'panorama',
      panorama: undefined,
      energy_multiplier: 1,
    });
  });
});

describe('decodeSkyMaterial — PhysicalSkyMaterial', () => {
  it('applies Godot’s constructor defaults', () => {
    expect(decodeSkyMaterial('PhysicalSkyMaterial', {})).toEqual({
      kind: 'physical',
      rayleigh_coefficient: 2,
      rayleigh_color: { r: 0.3, g: 0.405, b: 0.6, a: 1 },
      mie_coefficient: 0.005,
      mie_eccentricity: 0.8,
      mie_color: { r: 0.69, g: 0.729, b: 0.812, a: 1 },
      turbidity: 10,
      sun_disk_scale: 1,
      ground_color: { r: 0.1, g: 0.07, b: 0.034, a: 1 },
      energy_multiplier: 1,
    });
  });

  it('reads authored atmosphere scalars', () => {
    expect(
      decodeSkyMaterial('PhysicalSkyMaterial', { turbidity: '2.5', mie_eccentricity: '-0.5' })
    ).toMatchObject({ turbidity: 2.5, mie_eccentricity: -0.5 });
  });
});

describe('decodeSkyMaterial — unsupported', () => {
  it('returns null for a sky material type we do not implement', () => {
    // Godot ships three. Null means "render no sky", never a mis-parsed one.
    expect(decodeSkyMaterial('SomeAddonSkyMaterial', {})).toBeNull();
  });
});

describe('skyMaterialRef — the Sky indirection', () => {
  it('returns the sky_material reference a Sky points at (happy path)', () => {
    expect(skyMaterialRef('Sky', { sky_material: 'SubResource("Sky_dark")' })).toBe(
      'SubResource("Sky_dark")'
    );
  });

  it('follows the external form identically — Godot does not distinguish them', () => {
    expect(skyMaterialRef('Sky', { sky_material: 'ExtResource("2_abc")' })).toBe(
      'ExtResource("2_abc")'
    );
  });

  it('is undefined for a Sky that sets no material (edge case)', () => {
    expect(skyMaterialRef('Sky', {})).toBeUndefined();
  });

  it('is undefined for anything that is not a Sky (error path)', () => {
    // A non-Sky has no material to follow, the same answer as a Sky with none.
    expect(skyMaterialRef('ProceduralSkyMaterial', { sky_material: 'SubResource("x")' })).toBeUndefined();
    expect(skyMaterialRef(undefined, undefined)).toBeUndefined();
  });

  it('ignores a non-string sky_material rather than passing it on (error path)', () => {
    expect(skyMaterialRef('Sky', { sky_material: 42 })).toBeUndefined();
  });
});
