/**
 * Walks a `FontResource` graph down to the font bytes the runtime font loader needs. Godot's Font
 * kinds recurse through `fallbacks` and `base_font`, and a `SystemFont` never resolves, since the
 * previewer cannot load bytes for OS family names.
 */
import type { BitmapFont, FontFileResource, FontResource } from '../../../../resources/fonts/font/types';
import { TRANSFORM2D_SLOT_RE, matchedFloat, parseGodotFloat } from '../../../../godot/variant/number';
import { boolSlotValue } from '../../../../godot/variant/variantBool';
import { dictNumberEntries } from '../../../../godot/variant/variantParser';
import type { OpentypeCoordinates } from './fontMetrics';

interface ResolvedFontBytes {
  /** Raw font bytes, ready for `new FontFace(name, bytes)`. */
  readonly bytes: ArrayBuffer;
  /** The `FontFileResource` the bytes came from. `sceneFontLoader.ts` keys its load cache on its identity. */
  readonly leaf: FontFileResource;
}

/**
 * Depth first: `FontVariation` to `baseFont`, `FontFile` to itself when `accepts` it, else the first
 * `fallbacks` entry that resolves. Null for no authored font (the theme default), a `SystemFont`,
 * which never resolves, and a branch no file of which `accepts`.
 */
function findFontFile<Found extends FontFileResource>(
  font: FontResource | null | undefined,
  accepts: (file: FontFileResource) => file is Found
): Found | null {
  if (!font || font.kind === 'system') return null;
  if (font.kind === 'variation') return findFontFile(font.baseFont, accepts);
  if (accepts(font)) return font;
  for (const fallback of font.fallbacks) {
    const found = findFontFile(fallback, accepts);
    if (found) return found;
  }
  return null;
}

type FileWithBytes = FontFileResource & { bytes: ArrayBuffer };
type FileWithBitmap = FontFileResource & { bitmap: BitmapFont };

const hasBytes = (file: FontFileResource): file is FileWithBytes => Boolean(file.bytes);
const hasBitmap = (file: FontFileResource): file is FileWithBitmap => file.bitmap !== undefined;

/** The first font file with bytes that `font` reaches. Null for no authored font and for a branch with no loadable bytes. */
export function resolveFontFileBytes(font: FontResource | null | undefined): ResolvedFontBytes | null {
  const leaf = findFontFile(font, hasBytes);
  return leaf && { bytes: leaf.bytes, leaf };
}

/** The decoded BMFont of the first font file that has one, by the same walk. Null for a font that draws from outlines. */
export function resolveBitmapFont(font: FontResource | null | undefined): BitmapFont | null {
  return findFontFile(font, hasBitmap)?.bitmap ?? null;
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
 * `FontVariation.variation_opentype` of `font`: the axes keyed by tag (an int) or by name. Empty for any other font and
 * for no dictionary. As for the embolden, a variation over a variation takes its own value (`font.cpp:3128-3131`).
 */
export function fontVariationOpentype(font: FontResource | null | undefined): OpentypeCoordinates {
  const entries =
    font?.kind === 'variation' ? dictNumberEntries(font.properties['variation_opentype'] ?? '') : null;
  return new Map(entries ?? []);
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

/** `FontFile.force_autohinter` of `font`, which loads its glyphs through FreeType's auto-hinter. */
export function fontForcesAutohinter(font: FontFileResource): boolean {
  return boolSlotValue(font.properties['force_autohinter']) ?? false;
}
