/**
 * The default font under a font with no face of its own: a `FontVariation` with no `base_font`
 * (`FontVariation::_get_base_font_or_default`, `scene/resources/font.cpp:2987-3039`) and a
 * `SystemFont`, which draws the default when no OS font matches its names
 * (`SystemFont::_get_base_font_or_default`, `font.cpp:3368-3415`). The previewer reads no OS font,
 * so every SystemFont takes the default. The Control theme lookup owns the project's fonts, so the
 * defaults arrive as an argument.
 */
import type { FontFileResource, FontResource } from './types';
import { perObject } from '../../../utils/perObject';
import { findDrawnFace, hasGlyphs } from '../../../r3f/controls/native/text/sceneFontResolution';

/**
 * The font each Godot class without a face takes: the default theme context's `font` for that
 * class's type chain. Null is the bundled font, and a font left with no face draws it.
 */
export interface DefaultFonts {
  readonly variation: FontResource | null;
  readonly system: FontResource | null;
}

export const NO_DEFAULT_FONTS: DefaultFonts = { variation: null, system: null };

/**
 * Keyed by the defaults, then by font, so a font answers one object per `DefaultFonts` and a
 * metrics cache keyed on it keeps its hits. The theme lookup builds one `DefaultFonts` per project.
 */
const resolvedOver = perObject((defaults: DefaultFonts) =>
  perObject((font: FontResource) => replaceDefaults(font, defaults))
);

/** `font` itself where nothing under it changes, so an untouched branch keeps its identity. */
function replaceDefaults(font: FontResource, defaults: DefaultFonts): FontResource {
  switch (font.kind) {
    case 'system':
      return defaults.system ?? font;
    case 'variation': {
      const baseFont = font.baseFont ? replaceDefaults(font.baseFont, defaults) : defaults.variation;
      return baseFont === font.baseFont ? font : { ...font, baseFont };
    }
    case 'file': {
      if (hasGlyphs(font)) return font;
      return withFallbackDefaults(font, defaults);
    }
  }
}

/** Up to the first fallback that draws: the walk never reaches the fallbacks after it. */
function withFallbackDefaults(font: FontFileResource, defaults: DefaultFonts): FontFileResource {
  const fallbacks = [...font.fallbacks];
  for (const [i, fallback] of fallbacks.entries()) {
    fallbacks[i] = replaceDefaults(fallback, defaults);
    if (findDrawnFace(fallbacks[i])) break;
  }
  return fallbacks.every((fallback, i) => fallback === font.fallbacks[i]) ? font : { ...font, fallbacks };
}

/**
 * `font` with the default fonts under every font with no face of its own that its face can come
 * from: the bottom of its `base_font` chain, and the `fallbacks` of a `FontFile` with no glyphs.
 * A font with no face is left as it is where its default is the bundled font, and draws that.
 */
export function withDefaultFonts(font: FontResource | null, defaults: DefaultFonts): FontResource | null {
  // A file with its own glyphs draws them, and the walk never reaches its fallbacks.
  if (!font || (font.kind === 'file' && hasGlyphs(font)) || (!defaults.variation && !defaults.system))
    return font;
  return resolvedOver(defaults)(font);
}
