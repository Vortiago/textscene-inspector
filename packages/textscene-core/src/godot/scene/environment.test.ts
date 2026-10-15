import { describe, expect, it } from 'vitest';
import { depthFogDensityDefault, depthFogRange, GLOW_BLEND_MODE_DEFAULT } from './environment';
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
