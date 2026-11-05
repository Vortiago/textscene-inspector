/**
 * Walks a `FontResource` graph down to the face it draws, which the runtime font loader loads. Godot's Font
 * kinds recurse through `fallbacks` and `base_font`. The theme lookup has put the default font under
 * every font with no face of its own (`defaultFont.ts`), so one that is left draws the bundled font.
 */
import type { BitmapFont, FontFileResource, FontResource } from '../../../../resources/fonts/font/types';
import { TRANSFORM2D_SLOT_RE, matchedFloat, parseGodotFloat } from '../../../../godot/variant/number';
import { boolSlotValue } from '../../../../godot/variant/variantBool';
import { dictNumberEntries } from '../../../../godot/variant/variantParser';
import type { OpentypeCoordinates } from './fontMetrics';

type FileWithBytes = FontFileResource & { bytes: ArrayBuffer };
type FileWithBitmap = FontFileResource & { bitmap: BitmapFont };

/** Whether `file` is a decoded BMFont. */
export const hasBitmap = (file: FontFileResource): file is FileWithBitmap => file.bitmap !== undefined;

/** Whether `file` draws glyphs of its own, from font bytes or a decoded BMFont. */
export const hasGlyphs = (file: FontFileResource): file is FileWithBytes | FileWithBitmap =>
  Boolean(file.bytes) || hasBitmap(file);

/** What no font, a `SystemFont` and a `FontVariation` with no `base_font` draw: the bundled font. */
export const BUNDLED_FACE = Symbol('bundled face');

/** What a font whose every default is itself draws: no face, so Godot gives it no RID (`font.cpp:3675-3694`). */
export const NO_FACE = Symbol('no face');

/** The font `withDefaultFonts` puts where Godot finds no default: it draws `NO_FACE`. */
export const FACELESS_FONT: FontFileResource = Object.freeze({
  kind: 'file',
  bytes: undefined,
  mimeType: undefined,
  fallbacks: [],
  properties: {},
});

/**
 * The face a font draws: the first font file with glyphs of its own, `BUNDLED_FACE`, `NO_FACE`, or
 * null for a chain that reaches no glyphs. `sceneFontLoader.ts` keys its load cache on the file's identity.
 */
export type DrawnFace = FileWithBytes | FileWithBitmap | typeof BUNDLED_FACE | typeof NO_FACE | null;

/**
 * Depth first: `FontVariation` to `baseFont`, `FontFile` to itself when it has glyphs, else the first
 * `fallbacks` entry that draws. A font with no face of its own stops the walk at the bundled face, as
 * its RID draws before the next fallback (`font.cpp:104-116`).
 */
export function findDrawnFace(font: FontResource | null | undefined): DrawnFace {
  if (!font || font.kind === 'system') return BUNDLED_FACE;
  if (font.kind === 'variation') return findDrawnFace(font.baseFont);
  if (font === FACELESS_FONT) return NO_FACE;
  if (hasGlyphs(font)) return font;
  for (const fallback of font.fallbacks) {
    const face = findDrawnFace(fallback);
    if (face) return face;
  }
  return null;
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
 * setting reaches the bundled font only (`default_theme.cpp:1359-1386`). Undefined for a font that
 * draws the bundled font, where the caller reads the project setting, and for one that draws no face.
 */
export function fontGeneratesMipmaps(font: FontResource | null): boolean | undefined {
  if (font?.kind === 'variation') return fontGeneratesMipmaps(font.baseFont);
  const face = findDrawnFace(font);
  if (!font || face === BUNDLED_FACE || face === NO_FACE) return undefined;
  return boolSlotValue((face ?? font).properties['generate_mipmaps']) ?? false;
}

/** `FontFile.force_autohinter` of `font`, which loads its glyphs through FreeType's auto-hinter. */
export function fontForcesAutohinter(font: FontFileResource): boolean {
  return boolSlotValue(font.properties['force_autohinter']) ?? false;
}
