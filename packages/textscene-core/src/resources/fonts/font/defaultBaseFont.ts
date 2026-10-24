/**
 * The base of a `FontVariation` with no `base_font`: the theme's default font
 * (`FontVariation::_get_base_font_or_default`, `scene/resources/font.cpp:2987-3039`). It takes the
 * default as an argument, since the Control theme lookup owns the project's font.
 */
import type { FontResource } from './types';
import { perObject } from '../../../utils/perObject';

/**
 * Keyed by default font, then by variation, so a variation answers one object per default and a
 * metrics cache keyed on it keeps its hits.
 */
const resolvedOver = perObject((defaultFont: FontResource) =>
  perObject((font: FontResource) => replaceMissingBase(font, defaultFont))
);

/** Whether a variation chain from `font` down ends with a variation that names no `base_font`. */
export function endsWithoutBase(font: FontResource | null): boolean {
  while (font?.kind === 'variation') {
    if (!font.baseFont) return true;
    font = font.baseFont;
  }
  return false;
}

function replaceMissingBase(font: FontResource, defaultFont: FontResource): FontResource {
  if (font.kind !== 'variation') return font;
  return {
    ...font,
    baseFont: font.baseFont ? replaceMissingBase(font.baseFont, defaultFont) : defaultFont,
  };
}

/**
 * `font` with `defaultFont` under any `FontVariation` that names no `base_font`. A null `defaultFont`
 * is the bundled font, which `peekSceneFontMetrics` already reads from a variation with no base, so
 * `font` comes back as it is. A font of another kind comes back as it is, including a `FontFile`
 * with a bare variation in its `fallbacks`: the renderer takes glyphs from the first fallback that
 * resolves, so a fallback never changes the face.
 */
export function withDefaultBaseFont(
  font: FontResource | null,
  defaultFont: FontResource | null
): FontResource | null {
  if (!font || !defaultFont || !endsWithoutBase(font)) return font;

  return resolvedOver(defaultFont)(font);
}
