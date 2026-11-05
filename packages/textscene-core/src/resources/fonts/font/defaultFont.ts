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
import {
  FACELESS_FONT,
  NO_FACE,
  findDrawnFace,
  hasGlyphs,
} from '../../../r3f/controls/native/text/sceneFontResolution';

/**
 * The fonts each Godot class without a face tries, in Godot's order: the default theme context's
 * `font` for that class's type chain, then the fallback theme's. Null is the bundled font. A font
 * takes the first that is not itself (`isBaseCyclic`), and with none it draws no face.
 */
export interface DefaultFonts {
  readonly variation: readonly (FontResource | null)[];
  readonly system: readonly (FontResource | null)[];
}

export const NO_DEFAULT_FONTS: DefaultFonts = { variation: [null], system: [null] };

/** Godot's `MAX_FALLBACK_DEPTH` (`font.h:93`): a deeper chain of defaults is a cycle, and draws no face. */
const MAX_DEFAULT_DEPTH = 64;

/**
 * Keyed by the defaults, then by font, so a font answers one object per `DefaultFonts` and a
 * metrics cache keyed on it keeps its hits. The theme lookup builds one `DefaultFonts` per project.
 */
const resolvedOver = perObject((defaults: DefaultFonts) =>
  perObject((font: FontResource) => replaceDefaults(font, defaults, 0))
);

/** `Font::_is_base_cyclic` (`font.cpp:152-169`): whether `candidate` is `font`, or its `base_font` chain reaches it. */
function isBaseCyclic(candidate: FontResource | null, font: FontResource): boolean {
  for (let link = candidate; link; link = link.kind === 'variation' ? link.baseFont : null) {
    if (link === font) return true;
  }
  return false;
}

/**
 * The default `font` takes (`_get_base_font_or_default`, `font.cpp:2987-3039` and `3368-3415`), with
 * the defaults under it in turn. A font with no default draws no face: Godot gives it no RID, and
 * its text draws hex-code boxes.
 */
function defaultOf(
  font: FontResource,
  candidates: readonly (FontResource | null)[],
  defaults: DefaultFonts,
  depth: number
): FontResource | null {
  const index = candidates.findIndex((candidate) => !isBaseCyclic(candidate, font));
  if (index < 0 || depth >= MAX_DEFAULT_DEPTH) return FACELESS_FONT;
  const chosen = candidates[index]!;
  return chosen && replaceDefaults(chosen, defaults, depth + 1);
}

/** `font` itself where nothing under it changes, so an untouched branch keeps its identity. */
function replaceDefaults(font: FontResource, defaults: DefaultFonts, depth: number): FontResource {
  switch (font.kind) {
    case 'system':
      return defaultOf(font, defaults.system, defaults, depth) ?? font;
    case 'variation': {
      const baseFont = font.baseFont
        ? replaceDefaults(font.baseFont, defaults, depth)
        : defaultOf(font, defaults.variation, defaults, depth);
      return baseFont === font.baseFont ? font : { ...font, baseFont };
    }
    case 'file': {
      if (hasGlyphs(font)) return font;
      return withFallbackDefaults(font, defaults, depth);
    }
  }
}

/** Up to the first fallback that draws a face: the walk passes one with no face, and never reaches the fallbacks after a face. */
function withFallbackDefaults(
  font: FontFileResource,
  defaults: DefaultFonts,
  depth: number
): FontFileResource {
  const fallbacks = [...font.fallbacks];
  for (const [i, fallback] of fallbacks.entries()) {
    fallbacks[i] = replaceDefaults(fallback, defaults, depth);
    const face = findDrawnFace(fallbacks[i]);
    if (face && face !== NO_FACE) break;
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
  // No default changes a font, so the cache would answer `font` itself.
  if (!font || defaults === NO_DEFAULT_FONTS || (font.kind === 'file' && hasGlyphs(font))) return font;
  return resolvedOver(defaults)(font);
}
