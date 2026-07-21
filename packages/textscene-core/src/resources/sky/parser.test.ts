/**
 * Sky resource parsing — `[sub_resource type="Sky"]` and the three sky
 * materials behind it.
 *
 * Every default asserted here is the value Godot's own constructor installs
 * (`scene/resources/3d/sky_material.cpp`), not a value read back out of this
 * parser. A sky that omits a property must render exactly as Godot's does,
 * and the omitted case is the common one: the editor's preview sky sets only
 * the four colours.
 *
 * Values stay in GODOT space here — `sky_curve` is the authored 0.15, not the
 * shader's `0.6 / 0.15`. The engine does that conversion when it uploads
 * uniforms, so we do it at the same boundary (`skyUniforms.ts`).
 */
import { describe, expect, it } from 'vitest';
import { parseSkyMaterial, resolveSky } from './parser';
import type { TscnInternalResource } from '../../parser/types';

describe('parseSkyMaterial — ProceduralSkyMaterial', () => {
  it('applies Godot’s constructor defaults for a bare material', () => {
    const sky = parseSkyMaterial('ProceduralSkyMaterial', {});
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
    const sky = parseSkyMaterial('ProceduralSkyMaterial', {
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
    const sky = parseSkyMaterial('ProceduralSkyMaterial', { sky_curve: '0.5' });
    expect(sky).toMatchObject({ ground_curve: 0.02, sun_angle_max: 30 });
  });

  it('falls back to the default for a malformed scalar rather than NaN', () => {
    const sky = parseSkyMaterial('ProceduralSkyMaterial', { sky_curve: 'not-a-number' });
    expect(sky).toMatchObject({ sky_curve: 0.15 });
  });
});

describe('parseSkyMaterial — PanoramaSkyMaterial', () => {
  it('carries the panorama reference and Godot’s energy default', () => {
    const sky = parseSkyMaterial('PanoramaSkyMaterial', {
      panorama: 'ExtResource("1_sky")',
    });
    expect(sky).toEqual({
      kind: 'panorama',
      panorama: 'ExtResource("1_sky")',
      energy_multiplier: 1,
    });
  });

  it('parses with no panorama at all — an unset texture is a black sky, not an error', () => {
    expect(parseSkyMaterial('PanoramaSkyMaterial', {})).toEqual({
      kind: 'panorama',
      panorama: undefined,
      energy_multiplier: 1,
    });
  });
});

describe('parseSkyMaterial — PhysicalSkyMaterial', () => {
  it('applies Godot’s constructor defaults', () => {
    expect(parseSkyMaterial('PhysicalSkyMaterial', {})).toEqual({
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
      parseSkyMaterial('PhysicalSkyMaterial', { turbidity: '2.5', mie_eccentricity: '-0.5' })
    ).toMatchObject({ turbidity: 2.5, mie_eccentricity: -0.5 });
  });
});

describe('parseSkyMaterial — unsupported', () => {
  it('returns null for a sky material type we do not implement', () => {
    // Godot ships exactly three; a null here means "render no sky", never a
    // silently mis-parsed one.
    expect(parseSkyMaterial('SomeAddonSkyMaterial', {})).toBeNull();
  });
});

describe('resolveSky', () => {
  const proceduralMaterial: TscnInternalResource = {
    id: 'ProcSky_1',
    type: 'ProceduralSkyMaterial',
    data: { sky_top_color: 'Color(0.1, 0.2, 0.3, 1)' },
  };
  const sky: TscnInternalResource = {
    id: 'Sky_1',
    type: 'Sky',
    data: { sky_material: 'SubResource("ProcSky_1")' },
  };

  it('walks Environment.sky → Sky.sky_material → the material', () => {
    const resolved = resolveSky('SubResource("Sky_1")', [sky, proceduralMaterial]);
    expect(resolved).toMatchObject({
      kind: 'procedural',
      sky_top_color: { r: 0.1, g: 0.2, b: 0.3, a: 1 },
    });
  });

  it('returns null when the Sky carries no material', () => {
    const bare: TscnInternalResource = { id: 'Sky_1', type: 'Sky', data: {} };
    expect(resolveSky('SubResource("Sky_1")', [bare])).toBeNull();
  });

  it('returns null when the reference points at a missing sub-resource', () => {
    expect(resolveSky('SubResource("Nope")', [sky, proceduralMaterial])).toBeNull();
  });

  it('returns null when the reference points at something that is not a Sky', () => {
    // BG_SKY with `sky` pointing at, say, an Environment must not be coerced.
    expect(resolveSky('SubResource("ProcSky_1")', [sky, proceduralMaterial])).toBeNull();
  });

  it('returns null for an absent reference', () => {
    expect(resolveSky(undefined, [sky, proceduralMaterial])).toBeNull();
  });

  it('resolves a Sky whose material is an ExtResource — .tres skies are shared files', () => {
    const external: TscnInternalResource = {
      id: 'Sky_1',
      type: 'Sky',
      data: { sky_material: 'ExtResource("1_shared")' },
    };
    // We cannot follow an ExtResource synchronously, so this is null rather
    // than a wrong sky; the caller falls back to no sky.
    expect(resolveSky('SubResource("Sky_1")', [external])).toBeNull();
  });
});
