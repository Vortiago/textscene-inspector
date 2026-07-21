/**
 * `LIGHT_INTENSITY_SCALE`, pinned to the physics rather than to its own value.
 *
 * Asserting `LIGHT_INTENSITY_SCALE === Math.PI` would be a restatement of the
 * source line and could never disagree with it. What follows instead encodes
 * each engine's diffuse equation — read from Godot's `light_storage.cpp` and
 * three's `common.glsl.js` / `lights_physical_pars_fragment.glsl.js` — and
 * checks that the constant makes them agree. A wrong constant fails these; so
 * does a right constant paired with a wrong understanding of either engine.
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
  it('makes three reproduce Godot’s diffuse at every incidence angle', () => {
    const albedo = 0.2140; // Color(0.5, 0.5, 0.5) through sRGB → linear
    for (const nDotL of [1, 0.75, 0.5, 0.25, 0.05]) {
      for (const energy of [0.5, 1, 2.5]) {
        expect(threeDiffuse(albedo, nDotL, energy * LIGHT_INTENSITY_SCALE)).toBeCloseTo(
          godotDiffuse(albedo, nDotL, energy),
          12
        );
      }
    }
  });

  it('renders a fully lit Lambertian surface as exactly its own albedo', () => {
    // The physical statement behind the constant, and what
    // scenes/fixtures/unit-light-transport-direct.tscn shows on screen: under a
    // white energy-1.0 light at normal incidence the surface returns its albedo,
    // so an unshaded patch of that albedo laid on it becomes invisible.
    const albedo = 0.2140;
    expect(threeDiffuse(albedo, 1, 1 * LIGHT_INTENSITY_SCALE)).toBeCloseTo(albedo, 12);
  });

  it('is what the Godot render of that fixture measures', () => {
    // Godot 4.6.3 put the lit plane at 131/255 while ours sat at 106/255 with
    // the old value of 2. These are the measured sRGB bytes, converted here.
    const toLinear = (v: number) => Math.pow((v / 255 + 0.055) / 1.055, 2.4);
    const measuredRatio = toLinear(131) / toLinear(106);
    expect(LIGHT_INTENSITY_SCALE / 2).toBeCloseTo(measuredRatio, 2);
  });
});
