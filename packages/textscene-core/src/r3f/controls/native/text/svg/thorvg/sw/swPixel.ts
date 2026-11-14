/**
 * The software engine's pixel arithmetic (`tvgSwCommon.h`, `tvgRender.h`): premultiplied ARGB
 * words blended by an alpha of 0 to 255, in unsigned 32-bit arithmetic that wraps. A shift of a
 * word is `>>>`, as a word at or past 2^31 reads as negative to `>>`.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */

/** `MULTIPLY`: both arguments cut to a byte, as its parameters are `uint8_t`. */
export const multiply = (c: number, a: number): number => ((c & 0xff) * (a & 0xff) + 0xff) >> 8;

export const alphaOf = (c: number): number => c >>> 24;
export const inverseAlphaOf = (c: number): number => ~c >>> 24;

/** `ALPHA_BLEND`: each channel of `c` scaled by `a`. */
export function alphaBlend(c: number, a: number): number {
  const scale = a + 1;
  const high = (((c >>> 8) & 0x00ff00ff) * scale) & 0xff00ff00;
  const low = ((((c & 0x00ff00ff) * scale) >>> 8) & 0x00ff00ff) >>> 0;
  return (high + low) >>> 0;
}

/** `INTERPOLATE`: `s` over `d` by `a`, each channel. */
export function interpolate(s: number, d: number, a: number): number {
  const high =
    (Math.imul(((s >>> 8) & 0xff00ff) - ((d >>> 8) & 0xff00ff), a) + (d & 0xff00ff00)) & 0xff00ff00;
  const low = (((Math.imul((s & 0xff00ff) - (d & 0xff00ff), a) >>> 8) + (d & 0xff00ff)) & 0xff00ff) >>> 0;
  return (high + low) >>> 0;
}

/**
 * `INTERPOLATE8`. Its `~a` is a negative `int`, not `255 - a`, so it gives `s - d` at an alpha of
 * 255 and 0 at an alpha of 0, and the sum is cut to a byte.
 */
export const interpolate8 = (s: number, d: number, a: number): number =>
  (((s * a + 0xff) >> 8) + ((d * ~a + 0xff) >> 8)) & 0xff;

/** `opBlendNormal`: `s` scaled by `a`, over `d`. */
export function blendNormal(s: number, d: number, a: number): number {
  const t = alphaBlend(s, a);
  return (t + alphaBlend(d, inverseAlphaOf(t))) >>> 0;
}

/** `opBlendPreNormal`: a premultiplied `s` over `d`. */
export const blendPreNormal = (s: number, d: number): number => (s + alphaBlend(d, inverseAlphaOf(s))) >>> 0;

/** `_argbJoin`. */
export const argbJoin = (r: number, g: number, b: number, a: number): number =>
  ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;

/** `_argbLuma`: 0.0721 B + 0.7154 G + 0.2125 R of an ARGB word. */
export const argbLuma = (v: number): number =>
  (((v & 0xff) * 19 + ((v >>> 8) & 0xff) * 183 + ((v >>> 16) & 0xff) * 54) >> 8) & 0xff;

/** `rasterUnpremultiply` of one word. */
export function unpremultiply(data: number): number {
  const a = data >>> 24;
  if (a === 255 || a === 0) return data;
  const r = Math.min(0xff, Math.trunc(((data >>> 8) & 0xff00) / a));
  const g = Math.min(0xff, Math.trunc((data & 0xff00) / a));
  const b = Math.min(0xff, Math.trunc(((data << 8) & 0xff00) / a));
  return ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
}

/** `rasterPremultiply` of one word. */
export function premultiply(c: number): number {
  const a = c >>> 24;
  return (
    ((c & 0xff000000) +
      ((((c >>> 8) & 0xff) * a) & 0xff00) +
      ((((c & 0x00ff00ff) * a) >>> 8) & 0x00ff00ff)) >>>
    0
  );
}
