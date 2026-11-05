/**
 * Walks a `FontResource` graph down to the faces it draws, which the runtime font loader loads: the
 * face of the font, and its **Fallback chain**. Godot's Font kinds recurse through `fallbacks` and
 * `base_font`. The theme lookup has put the default font under every font with no face of its own
 * (`defaultFont.ts`), so one that is left draws the bundled font.
 */
import type {
  BitmapFont,
  FontFileResource,
  FontResource,
  FontVariationResource,
} from '../../../../resources/fonts/font/types';
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

/** Godot's `MAX_FALLBACK_DEPTH` (`font.h:93`): a deeper chain of fonts is a cycle. */
export const MAX_FALLBACK_DEPTH = 64;

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
 * Depth first: `FontVariation` and `SystemFont` to `baseFont`, `FontFile` to itself when it has glyphs, else the first
 * `fallbacks` entry that draws. A font with no face of its own stops the walk at the bundled face, as
 * its RID draws before the next fallback (`font.cpp:104-116`). A fallback with no face has no RID,
 * so the walk passes it, and a chain of only those draws `NO_FACE`.
 */
export function findDrawnFace(font: FontResource | null | undefined): DrawnFace {
  if (!font) return BUNDLED_FACE;
  if (font.kind !== 'file') return findDrawnFace(font.baseFont);
  if (font === FACELESS_FONT) return NO_FACE;
  if (hasGlyphs(font)) return font;
  let isFacelessChain = false;
  for (const fallback of font.fallbacks) {
    const face = findDrawnFace(fallback);
    if (face === NO_FACE) isFacelessChain = true;
    else if (face) return face;
  }
  return isFacelessChain ? NO_FACE : null;
}

/**
 * Whether `font` has a face of its own, which Godot gives a RID (`_get_rid`): a font file with
 * glyphs, or a `FontVariation` or `SystemFont` whose base has one. The bundled font has one.
 */
function hasOwnFace(font: FontResource | null): boolean {
  if (!font) return true;
  if (font.kind !== 'file') return hasOwnFace(font.baseFont);
  return hasGlyphs(font);
}

/** `Font::_update_rids_fb` (`font.cpp:104-117`): `font` where it has a face, then its `fallbacks` and theirs, depth first. */
function pushFallbacks(font: FontResource, depth: number, chain: FontResource[]): void {
  if (depth > MAX_FALLBACK_DEPTH) return;
  if (hasOwnFace(font)) chain.push(font);
  for (const fallback of font.fallbacks) pushFallbacks(fallback, depth + 1, chain);
}

/**
 * The fonts of the **Fallback chain** of `font` that have a face of their own, in the order the
 * shaper tries them (`Font::_update_rids`, `font.cpp:119-123`). A `FontVariation` or `SystemFont`
 * with no `fallbacks` of its own takes those of its base (`font.cpp:2926-2945`, `3216-3235`).
 */
export function fallbackChain(font: FontResource): FontResource[] {
  const chain: FontResource[] = [];
  if (font.kind === 'file' || font.fallbacks.length > 0 || !font.baseFont) {
    pushFallbacks(font, 0, chain);
    return chain;
  }
  if (hasOwnFace(font)) chain.push(font);
  for (const fallback of font.baseFont.fallbacks) pushFallbacks(fallback, 0, chain);
  return chain;
}

/**
 * The `FontVariation` whose settings `font` draws with: itself, or the one a `SystemFont` draws as
 * its base, since its RID is the base's (`font.cpp:3675-3694`). Null for any other font.
 */
function drawnVariation(font: FontResource | null | undefined): FontVariationResource | null {
  if (font?.kind === 'system') return drawnVariation(font.baseFont);
  return font?.kind === 'variation' ? font : null;
}

/**
 * `FontVariation.variation_embolden` of `font` (`drawnVariation`), 0 for any other font or a value
 * that is not a number. A variation over a variation takes its own value: `find_variation` links a
 * new face with this variation's embolden to the base's first face (`font.cpp:3128-3131`).
 */
export function fontVariationEmbolden(font: FontResource | null | undefined): number {
  const text = drawnVariation(font)?.properties['variation_embolden'];
  return (text === undefined ? null : parseGodotFloat(text)) ?? 0;
}

/**
 * The shear of `FontVariation.variation_transform` of `font` (`drawnVariation`): the second number of its
 * `Transform2D`, which Godot hands FreeType as `FT_Matrix.xy` (`text_server_adv.cpp:1318-1320`). 0
 * for any other font, for no transform and for text that is not a `Transform2D`. As for the
 * embolden, a variation over a variation takes its own value (`font.cpp:3128-3131`).
 */
export function fontVariationSkew(font: FontResource | null | undefined): number {
  const match = TRANSFORM2D_SLOT_RE.exec(
    drawnVariation(font)?.properties['variation_transform']?.trim() ?? ''
  );
  return match ? matchedFloat(match[2]!) : 0;
}

/**
 * `FontVariation.variation_opentype` of `font` (`drawnVariation`): the axes keyed by tag (an int) or by name. Empty for any other font and
 * for no dictionary. As for the embolden, a variation over a variation takes its own value (`font.cpp:3128-3131`).
 */
export function fontVariationOpentype(font: FontResource | null | undefined): OpentypeCoordinates {
  const variation = drawnVariation(font);
  const entries = variation ? dictNumberEntries(variation.properties['variation_opentype'] ?? '') : null;
  return new Map(entries ?? []);
}

/**
 * The `generate_mipmaps` of the face `font` draws with: a font keeps its own, and the project
 * setting reaches the bundled font only (`default_theme.cpp:1359-1386`). Undefined for a font that
 * draws the bundled font, where the caller reads the project setting, and for one that draws no face.
 */
export function fontGeneratesMipmaps(font: FontResource | null): boolean | undefined {
  if (font && font.kind !== 'file') return fontGeneratesMipmaps(font.baseFont);
  const face = findDrawnFace(font);
  if (!font || face === BUNDLED_FACE || face === NO_FACE) return undefined;
  return boolSlotValue((face ?? font).properties['generate_mipmaps']) ?? false;
}

/** `FontFile.force_autohinter` of `font`, which loads its glyphs through FreeType's auto-hinter. */
export function fontForcesAutohinter(font: FontFileResource): boolean {
  return boolSlotValue(font.properties['force_autohinter']) ?? false;
}
