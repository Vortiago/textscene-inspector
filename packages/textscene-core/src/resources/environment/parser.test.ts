/**
 * Environment parser tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as logger from '../../logger';
import { parseEnvironment } from './parser';
import { BackgroundMode } from './types';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('parseEnvironment', () => {
  it('should parse default environment with all defaults', () => {
    const result = parseEnvironment({});

    expect(result.background_mode).toBe(BackgroundMode.BG_CLEAR_COLOR);
    expect(result.background_color).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(result.background_energy_multiplier).toBe(1.0);
    expect(result.volumetric_fog_enabled).toBe(false);
    expect(result.volumetric_fog_density).toBe(0.05);
    expect(result.volumetric_fog_albedo).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(result.volumetric_fog_emission).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(result.adjustment_enabled).toBe(false);
    expect(result.adjustment_brightness).toBe(1.0);
    expect(result.adjustment_contrast).toBe(1.0);
    expect(result.adjustment_saturation).toBe(1.0);
    expect(result.ssr_enabled).toBe(false);
  });

  it('should parse BG_COLOR mode with custom color', () => {
    const result = parseEnvironment({
      background_mode: '1',
      background_color: 'Color(0.15, 0.12, 0.1, 1)',
    });

    expect(result.background_mode).toBe(BackgroundMode.BG_COLOR);
    expect(result.background_color).toEqual({ r: 0.15, g: 0.12, b: 0.1, a: 1 });
  });

  it('should parse BG_SKY mode', () => {
    const result = parseEnvironment({
      background_mode: '2',
    });

    expect(result.background_mode).toBe(BackgroundMode.BG_SKY);
  });

  it('should parse volumetric fog settings', () => {
    const result = parseEnvironment({
      volumetric_fog_enabled: 'true',
      volumetric_fog_density: '0.001',
      volumetric_fog_albedo: 'Color(0.8, 0.8, 0.9, 1)',
      volumetric_fog_emission: 'Color(0.1, 0.05, 0, 1)',
    });

    expect(result.volumetric_fog_enabled).toBe(true);
    expect(result.volumetric_fog_density).toBe(0.001);
    expect(result.volumetric_fog_albedo).toEqual({ r: 0.8, g: 0.8, b: 0.9, a: 1 });
    expect(result.volumetric_fog_emission).toEqual({ r: 0.1, g: 0.05, b: 0, a: 1 });
  });

  it('should parse adjustment settings', () => {
    const result = parseEnvironment({
      adjustment_enabled: 'true',
      adjustment_brightness: '1.05',
      adjustment_contrast: '1.1',
      adjustment_saturation: '1.2',
    });

    expect(result.adjustment_enabled).toBe(true);
    expect(result.adjustment_brightness).toBe(1.05);
    expect(result.adjustment_contrast).toBe(1.1);
    expect(result.adjustment_saturation).toBe(1.2);
  });

  it('should parse SSR enabled flag', () => {
    const result = parseEnvironment({
      ssr_enabled: 'true',
    });

    expect(result.ssr_enabled).toBe(true);
  });

  it('should parse background energy multiplier', () => {
    const result = parseEnvironment({
      background_mode: '1',
      background_color: 'Color(0.5, 0.5, 0.5, 1)',
      background_energy_multiplier: '1.5',
    });

    expect(result.background_mode).toBe(BackgroundMode.BG_COLOR);
    expect(result.background_energy_multiplier).toBe(1.5);
  });

  it('should handle all background modes', () => {
    for (let mode = 0; mode <= 5; mode++) {
      const result = parseEnvironment({
        background_mode: String(mode),
      });
      expect(result.background_mode).toBe(mode);
    }
  });

  it('should default tonemap and sky when absent', () => {
    const result = parseEnvironment({});

    expect(result.tonemap_mode).toBe(0);
    expect(result.tonemap_white).toBe(1.0);
    expect(result.tonemap_exposure).toBe(1.0);
    expect(result.sky).toBeUndefined();
  });

  it('should parse the witnessed BG_SKY + tonemap form (no silent drop)', () => {
    const result = parseEnvironment({
      background_mode: '2',
      sky: 'SubResource("Sky_lexvt")',
      tonemap_mode: '2',
      tonemap_white: '6.0',
      tonemap_exposure: '1.3',
    });

    expect(result.background_mode).toBe(BackgroundMode.BG_SKY);
    expect(result.sky).toBe('SubResource("Sky_lexvt")');
    expect(result.tonemap_mode).toBe(2);
    expect(result.tonemap_white).toBe(6.0);
    expect(result.tonemap_exposure).toBe(1.3);
  });

  it('honours authored values for scalars', () => {
    const r = parseEnvironment({
      background_energy_multiplier: '2.5',
      tonemap_white: '3',
      fog_density: '0.2',
      background_mode: '2',
      tonemap_mode: '3',
    });
    expect(r.background_energy_multiplier).toBe(2.5);
    expect(r.tonemap_white).toBe(3);
    expect(r.fog_density).toBe(0.2);
    expect(r.background_mode).toBe(2);
    expect(r.tonemap_mode).toBe(3);
  });

  it('float scalars fall back to their default on garbage (never NaN) and warn', () => {
    const r = parseEnvironment({
      background_energy_multiplier: 'garbage',
      fog_density: 'garbage',
      ambient_light_energy: 'garbage',
      adjustment_saturation: 'garbage',
    });
    expect(r.background_energy_multiplier).toBe(1.0);
    expect(r.fog_density).toBe(0.01);
    expect(r.ambient_light_energy).toBe(1.0);
    expect(r.adjustment_saturation).toBe(1.0);
    expect(Number.isNaN(r.background_energy_multiplier)).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('int scalars fall back to their default on garbage (never NaN)', () => {
    const r = parseEnvironment({
      background_mode: 'garbage',
      tonemap_mode: 'garbage',
      fog_mode: 'garbage',
    });
    expect(r.background_mode).toBe(0);
    expect(r.tonemap_mode).toBe(0);
    expect(r.fog_mode).toBe(0);
    expect(Number.isNaN(r.tonemap_mode)).toBe(false);
  });

  it('honours a valid color', () => {
    const r = parseEnvironment({ background_color: 'Color(1, 0, 0, 1)' });
    expect(r.background_color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('a present-but-malformed color falls back to field default (no throw)', () => {
    expect(() => parseEnvironment({ background_color: 'Color(oops)' })).not.toThrow();
    const r = parseEnvironment({ background_color: 'Color(oops)', ambient_light_color: 'nope' });
    expect(r.background_color).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(r.ambient_light_color).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('preserves each color field its own (non-black) default when malformed', () => {
    const r = parseEnvironment({ fog_light_color: 'garbage' });
    expect(r.fog_light_color).toEqual({ r: 0.518, g: 0.553, b: 0.608, a: 1 });
  });
});
