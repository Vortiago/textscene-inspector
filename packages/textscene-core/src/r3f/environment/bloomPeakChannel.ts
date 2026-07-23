/**
 * Godot's glow bright-pass gates on the PEAK RGB channel, not Rec. 709
 * luminance. `postprocessing`'s `BloomEffect` gates on luminance, which is the
 * wrong measure for Godot parity: a saturated blue emissive (blue ≈ 2.3
 * pre-tonemap) has luminance ≈ 0.33 — DIMMER than a lit white floor (≈ 0.6) —
 * so a luminance threshold can never bloom it without also blooming the floor.
 * A peak-channel threshold separates them exactly as Godot's HDR threshold does
 * (measured: emissive peak 2.3 blooms, floor/plane/sky peaks < 0.7 stay crisp).
 *
 * Kept as a pure string rewrite (no three / postprocessing imports) so it is
 * unit-testable and the version-fragility of reaching into a third-party shader
 * is guarded in one place: `LUMINANCE_EXPR` is the exact expression
 * `postprocessing`'s `LuminanceMaterial` uses, and a co-located test asserts the
 * installed library still ships it — so a `postprocessing` upgrade that renames
 * it fails loudly in CI instead of silently reverting glow to luminance gating.
 */

/** The luminance expression in postprocessing's `LuminanceMaterial` fragment. */
export const LUMINANCE_EXPR = /luminance\(\s*texel\.rgb\s*\)/;

/** Peak of the three channels — Godot's HDR glow discriminator. */
const PEAK_CHANNEL_EXPR = 'max(max(texel.r, texel.g), texel.b)';

/** The mutable slice of a three `ShaderMaterial` this rewrite touches. */
export interface PatchableMaterial {
  fragmentShader: string;
  needsUpdate: boolean;
}

/**
 * Rewrite a `LuminanceMaterial`'s bright-pass to gate on the peak channel.
 * Returns whether the rewrite applied — `false` (a no-op) when the expected
 * expression is absent, so the caller can warn rather than silently ship the
 * wrong (luminance) discriminator.
 */
export function gateBloomOnPeakChannel(material: PatchableMaterial): boolean {
  if (!LUMINANCE_EXPR.test(material.fragmentShader)) return false;
  material.fragmentShader = material.fragmentShader.replace(LUMINANCE_EXPR, PEAK_CHANNEL_EXPR);
  material.needsUpdate = true;
  return true;
}
