/** Render-side constants that match three.js light output to Godot. No parse or lint code imports them. */

/**
 * Godot `light_energy` → three `intensity`. Godot multiplies energy by PI in the light buffer
 * (`light_storage.cpp`, non-physical units, every light type), and `diffuse_brdf_NL` divides it
 * out. three keeps 1/PI in `BRDF_Lambert`, so `intensity = energy * PI`. A Godot 4.6.3 render
 * asks for 2 × 1.5748, against PI = 2 × 1.5708.
 */
export const LIGHT_INTENSITY_SCALE = Math.PI;
