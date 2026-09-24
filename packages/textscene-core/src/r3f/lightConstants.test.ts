/**
 * `LIGHT_INTENSITY_SCALE` against each engine's diffuse equation, from Godot's `light_storage.cpp`
 * and three's `common.glsl.js` / `lights_physical_pars_fragment.glsl.js`, not against its own
 * value. A wrong constant fails, and so does a right one with a wrong reading of either engine.
 */
import { describe, expect, it } from 'vitest';
import { LIGHT_INTENSITY_SCALE } from './lightConstants';

/** three: `irradiance = dotNL * color * intensity`, then `BRDF_Lambert = albedo / PI`. */
function threeDiffuse(albedo: number, nDotL: number, intensity: number): number {
  return (albedo / Math.PI) * nDotL * intensity;
}

/**
 * Godot: `light_data.energy = energy * PI` (`light_storage.cpp`, the
 * non-physical-units branch), then `diffuse_brdf_NL = cNdotL * (1 / M_PI)`.
 */
function godotDiffuse(albedo: number, nDotL: number, energy: number): number {
  return albedo * (energy * Math.PI) * (nDotL / Math.PI);
}

describe('LIGHT_INTENSITY_SCALE', () => {
  it('makes three reproduce Godot’s diffuse', () => {
    // Both sides are linear in N·L and energy, so one pair settles it. `albedo` is Color(0.5, 0.5,
    // 0.5) converted from sRGB to linear, and cancels. A Lambertian surface under a white
    // energy-1.0 light renders its own albedo: in scenes/fixtures/unit-light-transport-direct.tscn
    // an unshaded patch of that albedo disappears into the lit plane.
    const albedo = 0.2140;
    expect(threeDiffuse(albedo, 1, 1 * LIGHT_INTENSITY_SCALE)).toBeCloseTo(
      godotDiffuse(albedo, 1, 1),
      12
    );
    expect(threeDiffuse(albedo, 1, 1 * LIGHT_INTENSITY_SCALE)).toBeCloseTo(albedo, 12);
  });

  it('is what the Godot render of that fixture measures', () => {
    // Measured sRGB bytes: Godot 4.6.3 puts the lit plane at 131/255, and a scale of 2 gives 106.
    const toLinear = (v: number) => Math.pow((v / 255 + 0.055) / 1.055, 2.4);
    const measuredRatio = toLinear(131) / toLinear(106);
    expect(LIGHT_INTENSITY_SCALE / 2).toBeCloseTo(measuredRatio, 2);
  });
});
