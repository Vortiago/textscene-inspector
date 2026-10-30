/**
 * Walks a `FontResource` graph down to the font bytes the runtime font loader needs. Godot's Font
 * kinds recurse through `fallbacks` and `base_font`, and a `SystemFont` never resolves, since the
 * previewer cannot load bytes for OS family names.
 */
import type { FontFileResource, FontResource } from '../../../../resources/fonts/font/types';
import { TRANSFORM2D_SLOT_RE, matchedFloat, parseGodotFloat } from '../../../../godot/variant/number';
import { boolSlotValue } from '../../../../godot/variant/variantBool';

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

/**
 * The shear of `FontVariation.variation_transform` of `font`: the second number of its
 * `Transform2D`, which Godot hands FreeType as `FT_Matrix.xy` (`text_server_adv.cpp:1318-1320`). 0
 * for any other font, for no transform and for text that is not a `Transform2D`. As for the
 * embolden, a variation over a variation takes its own value (`font.cpp:3128-3131`).
 */
export function fontVariationSkew(font: FontResource | null | undefined): number {
  if (font?.kind !== 'variation') return 0;
  const match = TRANSFORM2D_SLOT_RE.exec(font.properties['variation_transform']?.trim() ?? '');
  return match ? matchedFloat(match[2]!) : 0;
}

/**
 * The `generate_mipmaps` of the face `font` draws with: a font keeps its own, and the project
 * setting reaches the bundled font only (`default_theme.cpp:1359-1386`). Undefined for the bundled
 * font, a null font or a variation with no base, where the caller reads the project setting.
 */
export function fontGeneratesMipmaps(font: FontResource | null): boolean | undefined {
  if (!font) return undefined;
  if (font.kind === 'variation') return fontGeneratesMipmaps(font.baseFont);
  const face = font.kind === 'system' ? font : (resolveFontFileBytes(font)?.leaf ?? font);
  return boolSlotValue(face.properties['generate_mipmaps']) ?? false;
}
