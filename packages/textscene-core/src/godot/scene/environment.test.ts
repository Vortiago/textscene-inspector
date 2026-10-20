import { describe, expect, it } from 'vitest';
import {
  AMBIENT_SOURCE_NAMES,
  AmbientSource,
  BACKGROUND_MODE_NAMES,
  BackgroundMode,
  depthFogDensityDefault,
  depthFogRange,
  FOG_MODE_NAMES,
  GLOW_BLEND_MODE_DEFAULT,
  REFLECTION_SOURCE_NAMES,
  SDFGI_Y_SCALE_NAMES,
} from './environment';
import { FogMode } from '../rendering/environment/depthFog';
import { GlowBlendMode } from '../rendering/environment/glow';

describe('depthFogDensityDefault', () => {
  it('is 0.01 for an exponential fog', () => {
    expect(depthFogDensityDefault(FogMode.EXPONENTIAL)).toBe(0.01);
  });

  it('is 1 for a depth fog, which set_fog_mode stores', () => {
    expect(depthFogDensityDefault(FogMode.DEPTH)).toBe(1);
  });
});

describe('depthFogRange', () => {
  it("keeps Godot's defaults for a scene that stores neither end", () => {
    expect(depthFogRange({})).toEqual({ begin: 10, end: 100 });
  });

  it('drags the end along with a begin past it', () => {
    expect(depthFogRange({ begin: 150 })).toEqual({ begin: 150, end: 150 });
  });

  it('drags the begin back with an end before it', () => {
    expect(depthFogRange({ end: 5 })).toEqual({ begin: 5, end: 5 });
  });

  it('stores the end last, so it wins over a begin past it', () => {
    expect(depthFogRange({ begin: 50, end: 20 })).toEqual({ begin: 20, end: 20 });
  });
});

describe('GLOW_BLEND_MODE_DEFAULT', () => {
  it('is Screen, which Environment() sets', () => {
    // `scene/resources/environment.h:172`.
    expect(GLOW_BLEND_MODE_DEFAULT).toBe(GlowBlendMode.SCREEN);
  });
});

describe('BACKGROUND_MODE_NAMES', () => {
  it('names the six modes by their constants, without BG_MAX (environment.h:41-48)', () => {
    expect(BACKGROUND_MODE_NAMES).toEqual({
      0: 'BG_CLEAR_COLOR',
      1: 'BG_COLOR',
      2: 'BG_SKY',
      3: 'BG_CANVAS',
      4: 'BG_KEEP',
      5: 'BG_CAMERA_FEED',
    });
  });

  it('keeps the integers the enum stores', () => {
    expect(BackgroundMode.BG_CAMERA_FEED).toBe(5);
  });
});

describe('AMBIENT_SOURCE_NAMES', () => {
  it('names the four sources without AMBIENT_SOURCE_ (environment.h:51-56)', () => {
    expect(AMBIENT_SOURCE_NAMES).toEqual({ 0: 'BG', 1: 'DISABLED', 2: 'COLOR', 3: 'SKY' });
  });

  it('keeps the integers the enum stores', () => {
    expect(AmbientSource.SKY).toBe(3);
  });
});

describe('REFLECTION_SOURCE_NAMES', () => {
  it('names the three sources without REFLECTION_SOURCE_ (environment.h:58-62)', () => {
    expect(REFLECTION_SOURCE_NAMES).toEqual({ 0: 'BG', 1: 'DISABLED', 2: 'SKY' });
  });
});

describe('SDFGI_Y_SCALE_NAMES', () => {
  it('names the three scales as the constants spell them (environment.h:72-76)', () => {
    expect(SDFGI_Y_SCALE_NAMES).toEqual({
      0: 'Y_SCALE_50_PERCENT',
      1: 'Y_SCALE_75_PERCENT',
      2: 'Y_SCALE_100_PERCENT',
    });
  });
});

describe('FOG_MODE_NAMES', () => {
  it('names the two modes without FOG_MODE_ (environment.h:78-81)', () => {
    expect(FOG_MODE_NAMES).toEqual({ 0: 'EXPONENTIAL', 1: 'DEPTH' });
  });
});
