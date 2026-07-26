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
  return Number.isInteger(value) ? `${value}.0` : String(value);
}
