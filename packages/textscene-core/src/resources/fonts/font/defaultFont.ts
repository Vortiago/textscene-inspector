/**
 * The default font under a font with no face of its own: a `FontVariation` with no `base_font`
 * (`FontVariation::_get_base_font_or_default`, `scene/resources/font.cpp:2987-3039`) and a
 * `SystemFont`, which draws the default when no OS font matches its names
 * (`SystemFont::_get_base_font_or_default`, `font.cpp:3368-3415`). The previewer reads no OS font,
 * so every SystemFont takes the default. The Control theme lookup owns the project's fonts, so the
 * defaults arrive as an argument.
 */
import type { FontResource } from './types';
import { perObject } from '../../../utils/perObject';
import {
  FACELESS_FONT,
  MAX_FALLBACK_DEPTH,
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
  if (index < 0 || depth >= MAX_FALLBACK_DEPTH) return FACELESS_FONT;
  const chosen = candidates[index]!;
  return chosen && replaceDefaults(chosen, defaults, depth + 1);
}

/** `font` itself where nothing under it changes, so an untouched branch keeps its identity. */
function replaceDefaults(font: FontResource, defaults: DefaultFonts, depth: number): FontResource {
  const fallbacks = font.fallbacks.map((fallback) => replaceDefaults(fallback, defaults, depth));
  const changed = fallbacks.some((fallback, i) => fallback !== font.fallbacks[i]);
  if (font.kind === 'file') return changed ? { ...font, fallbacks } : font;
  const candidates = font.kind === 'system' ? defaults.system : defaults.variation;
  // A SystemFont's own `base_font` is the OS font, and none matches.
  const baseFont =
    font.kind === 'variation' && font.baseFont
      ? replaceDefaults(font.baseFont, defaults, depth)
      : defaultOf(font, candidates, defaults, depth);
  return changed || baseFont !== font.baseFont ? { ...font, baseFont, fallbacks } : font;
}

/**
 * `font` with the default fonts under every font of its graph with no face of its own: the bottom
 * of each `base_font` chain, in `font` and in every font of its **Fallback chain**. A font with no
 * face is left as it is where its default is the bundled font, and draws that.
 */
export function withDefaultFonts(font: FontResource | null, defaults: DefaultFonts): FontResource | null {
  // No default changes a font, so the cache would answer `font` itself.
  if (!font || defaults === NO_DEFAULT_FONTS || (hasOwnGlyphs(font) && font.fallbacks.length === 0))
    return font;
  return resolvedOver(defaults)(font);
}

const hasOwnGlyphs = (font: FontResource): boolean => font.kind === 'file' && hasGlyphs(font);
