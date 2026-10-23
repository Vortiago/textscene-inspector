/**
 * Walks a `FontResource` graph down to the font bytes the runtime font loader needs. Godot's Font
 * kinds recurse through `fallbacks` and `base_font`, and a `SystemFont` never resolves, since the
 * previewer cannot load bytes for OS family names.
 */
import type { FontFileResource, FontResource } from '../../../../resources/fonts/font/types';
import { parseGodotFloat } from '../../../../godot/variant/number';

interface ResolvedFontBytes {
  /** Raw font bytes, ready for `new FontFace(name, bytes)`. */
  readonly bytes: ArrayBuffer;
  /** The `FontFileResource` the bytes came from. `sceneFontLoader.ts` keys its load cache on its identity. */
  readonly leaf: FontFileResource;
}

/**
 * Depth first: `FontVariation` to `baseFont`, `FontFile` to its `bytes`, else the first
 * `fallbacks` entry that resolves. Returns `null` for no authored font (the theme default) and
 * for a branch with no loadable bytes.
 */
export function resolveFontFileBytes(font: FontResource | null | undefined): ResolvedFontBytes | null {
  if (!font) return null;

  switch (font.kind) {
    case 'system':
      return null;

    case 'variation':
      return resolveFontFileBytes(font.baseFont);

    case 'file': {
      if (font.bytes) {
        return { bytes: font.bytes, leaf: font };
      }
      for (const fallback of font.fallbacks) {
        const resolved = resolveFontFileBytes(fallback);
        if (resolved) return resolved;
      }
      return null;
    }
  }
}

/**
 * `FontVariation.variation_embolden` of `font`, 0 for any other font or a value that is not a
 * number. A variation over a variation takes its own value: `find_variation` links a new face
 * with this variation's embolden to the base's first face (`font.cpp:3128-3131`).
 */
export function fontVariationEmbolden(font: FontResource | null | undefined): number {
  if (font?.kind !== 'variation') return 0;
  const text = font.properties['variation_embolden'];
  return (text === undefined ? null : parseGodotFloat(text)) ?? 0;
}
