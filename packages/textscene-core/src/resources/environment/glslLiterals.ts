/**
 * Emitting numbers into generated GLSL.
 *
 * Shared by the tone-curve and glow shader builders, which both bake CPU-side
 * Godot values in as constants rather than threading them through uniforms.
 */

/**
 * GLSL has no int→float coercion in a constant initialiser, so a whole number
 * has to carry an explicit decimal or the shader fails to compile. A non-finite
 * value becomes `0.0` rather than the `NaN`/`Infinity` that GLSL cannot parse at
 * all — a malformed scene should render without glow, not fail to compile.
 */
export function glslFloat(value: number): string {
  if (!Number.isFinite(value)) return '0.0';
  const text = String(value);
  // Past ~1e21 JavaScript stringifies integers in exponent form, and `1e+21.0`
  // is not a float literal — GLSL wants the exponent to carry the type instead.
  if (text.includes('e')) return text.replace('+', '');
  return Number.isInteger(value) ? `${text}.0` : text;
}
