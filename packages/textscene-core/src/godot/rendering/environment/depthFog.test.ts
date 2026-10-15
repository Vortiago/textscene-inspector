import { describe, expect, it } from 'vitest';
import { FogMode, depthFogDensityDefault, depthFogRange, renderedDepthFogRange } from './depthFog';

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

describe('renderedDepthFogRange', () => {
  it('ends at the far plane for an end of 0', () => {
    expect(renderedDepthFogRange({ begin: 10, end: 0 }, 400)).toEqual({ begin: 10, end: 400 });
  });

  it('keeps the begin a millimetre short of the end', () => {
    expect(renderedDepthFogRange({ begin: 20, end: 20 }, 400)).toEqual({ begin: 19.999, end: 20 });
  });

  it('passes an ordered range through', () => {
    expect(renderedDepthFogRange({ begin: 10, end: 100 }, 400)).toEqual({ begin: 10, end: 100 });
  });
});
