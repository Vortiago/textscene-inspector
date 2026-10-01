/** Render-side constants that match three.js light output to Godot. No parse or lint code imports them. */

/**
 * Godot `light_energy` → three `intensity`. Godot multiplies energy by PI in the light buffer
 * (`light_storage.cpp`, non-physical units, every light type), and `diffuse_brdf_NL` divides it
 * out. three keeps 1/PI in `BRDF_Lambert`, so `intensity = energy * PI`. A Godot 4.6.3 render
 * asks for 2 × 1.5748, against PI = 2 × 1.5708.
 */
export const LIGHT_INTENSITY_SCALE = Math.PI;

/**
 * Shadow-map resolution for an omni or spot light. three's default 512 looks blocky next to Godot.
 * 2048 stays cheap for one headless frame. A directional light takes Godot's own atlas size
 * instead (`godot/directionalShadow.ts`), since its map spans the whole fitted view.
 */
export const SHADOW_MAP_SIZE = 2048;

/**
 * Receiver offset along the normal, in world units, before the shadow lookup. Unlike a depth bias
 * it suppresses acne on lit slopes without detaching the shadow, as Godot's shadows touch their
 * casters. Shared by the omni and spot lights. A directional light counts its normal bias in
 * texels, as Godot does (`r3f/directionalShadow/`).
 */
export const SHADOW_NORMAL_BIAS = 0.04;
