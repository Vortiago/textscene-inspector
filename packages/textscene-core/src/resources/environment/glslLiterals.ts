/**
 * Numbers as GLSL literals, for the tone-curve and glow shader builders, which bake
 * Godot values in as constants rather than uniforms.
 */

/**
 * GLSL has no int→float coercion in a constant initialiser, so a whole number
 * carries an explicit decimal. A non-finite value becomes `0.0`, since GLSL cannot
 * parse `NaN` or `Infinity`: a malformed scene renders without glow.
 */
export function glslFloat(value: number): string {
  if (!Number.isFinite(value)) return '0.0';
  const text = String(value);
  // Past ~1e21 JavaScript stringifies integers in exponent form, and `1e+21.0`
  // is not a float literal: the exponent carries the type instead.
  if (text.includes('e')) return text.replace('+', '');
  return Number.isInteger(value) ? `${text}.0` : text;
}
