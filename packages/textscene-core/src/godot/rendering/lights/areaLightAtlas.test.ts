import { describe, expect, it } from 'vitest';
import { AREA_LIGHT_ATLAS_BLUR_GROUP_SIDE, AREA_LIGHT_ATLAS_BLUR_KERNEL } from './areaLightAtlas';

/** The mipmap blur is `copy.glsl`'s simple Gaussian, whose taps go from the centre out. */
describe('the area light atlas mipmap blur', () => {
  it('uses the SIGMA2 kernel of copy.glsl:119', () => {
    expect(AREA_LIGHT_ATLAS_BLUR_KERNEL).toEqual([0.214607, 0.189879, 0.131514, 0.071303]);
  });

  it('weighs a row of taps to about 1 (edge case)', () => {
    const [centre, ...outer] = AREA_LIGHT_ATLAS_BLUR_KERNEL;
    expect(centre + 2 * outer.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 4);
  });

  it('reads 8 texels wide for each thread group (copy.glsl:9)', () => {
    expect(AREA_LIGHT_ATLAS_BLUR_GROUP_SIDE).toBe(8);
  });
});
