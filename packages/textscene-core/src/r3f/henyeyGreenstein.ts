/**
 * Godot's Henyey-Greenstein phase function as GLSL, which the physical sky's Mie scattering and
 * the volumetric fog's lights share (`volumetric_fog_process.glsl:252-255`). Both concatenate this
 * one text, so the two cannot drift apart.
 */
export const HENYEY_GREENSTEIN_GLSL = /* glsl */ `
float henyey_greenstein(float cos_theta, float g) {
  const float k = 0.0795774715459;
  return k * (1.0 - g * g) / (pow(1.0 + g * g - 2.0 * g * cos_theta, 1.5));
}
`;
