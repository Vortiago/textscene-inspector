import { describe, expect, it } from 'vitest';
import { fadedSurfaceAlpha, type AlphaPassSurface } from './fadedSurfaceAlpha';

const OPAQUE_SURFACE: AlphaPassSurface = {
  opacity: 1,
  transparent: false,
  depthWrite: true,
  alphaPassDepthWrite: false,
};

describe('fadedSurfaceAlpha', () => {
  it('leaves the surface as it is for an opaque geometry instance', () => {
    expect(fadedSurfaceAlpha(OPAQUE_SURFACE, 0)).toEqual({
      opacity: 1,
      transparent: false,
      depthWrite: true,
    });
  });

  it('multiplies the fade alpha into the surface opacity', () => {
    const surface = { ...OPAQUE_SURFACE, opacity: 0.5, transparent: true };
    expect(fadedSurfaceAlpha(surface, 0.3).opacity).toBe((0.5 * 178) / 255);
  });

  it('moves an opaque surface to the blended pass', () => {
    expect(fadedSurfaceAlpha(OPAQUE_SURFACE, 0.3).transparent).toBe(true);
  });

  it('writes no depth in the alpha pass by default', () => {
    expect(fadedSurfaceAlpha(OPAQUE_SURFACE, 0.3).depthWrite).toBe(false);
  });

  it("writes depth in the alpha pass where the surface's depth draw mode says so", () => {
    expect(fadedSurfaceAlpha({ ...OPAQUE_SURFACE, alphaPassDepthWrite: true }, 0.3).depthWrite).toBe(true);
  });
});
