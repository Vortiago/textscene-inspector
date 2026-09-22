/**
 * The Font slice's decoded data (ADR-0031).
 *
 * Godot has three font resource types, and this previewer meets all three:
 *
 *   - `FontFile` — most often an `ExtResource` pointing straight at a raw
 *     `.ttf`/`.otf`/`.woff`/`.woff2` (no `.tres` involved at all, exactly like
 *     an image `Texture2D`). Less often a `.tres` wrapper that carries no font
 *     bytes of its own and instead lists `fallbacks` — other Fonts, most
 *     commonly the real face — plus Godot's own dynamic-font bake settings
 *     (`msdf_*`, `cache/*`) this previewer does not consume.
 *   - `SystemFont` — no file at all: `font_names` is a list of OS family names
 *     (`"sans-serif"`, `"monospace"`, …) resolved by the OS at runtime, which
 *     a previewer with no access to the user's system fonts cannot honour by
 *     loading bytes.
 *   - `FontVariation` — wraps a `base_font` (any of the three kinds,
 *     recursively) plus synthesis/spacing/OpenType-feature overrides. Not
 *     every `FontVariation` sets `base_font`: omitting it entirely means "the
 *     theme's own default font."
 *
 * The decode is SHALLOW by design: only the identity-relevant fields
 * (`base_font`, `fallbacks`, `font_names`) become typed values; everything
 * else (`spacing_*`, `embolden`, `opentype_features`, `variation_opentype`,
 * `msdf_*`, …) stays a raw property string for a future consumer — the same
 * contract the StandardMaterial3D, MeshLibrary and TileSet decodes use.
 */

/** A `FontFile` .tres wrapper has no bytes of its own — it defers to `fallbacks`. */
export interface FontFileResource {
  kind: 'file';
  /** Raw font bytes, ready for `new FontFace(name, bytes)`. Undefined for a bytes-less `.tres` wrapper. */
  bytes: ArrayBuffer | undefined;
  /** Undefined when `bytes` is undefined. */
  mimeType: string | undefined;
  /** Other Fonts to try, in order — usually the one real face behind a `.tres` wrapper. */
  fallbacks: FontResource[];
  /** Every other declared property (`msdf_*`, `subpixel_positioning`, `cache/*`, …), raw. */
  properties: Record<string, string>;
}

/** No file: `font_names` are OS family names resolved at runtime, which this previewer cannot load bytes for. */
export interface SystemFontResource {
  kind: 'system';
  fontNames: string[];
  properties: Record<string, string>;
}

/** Wraps another Font (or none — the theme default) with synthesis/spacing/feature overrides. */
export interface FontVariationResource {
  kind: 'variation';
  baseFont: FontResource | null;
  /** `spacing_*`, `embolden`, `opentype_features`, `variation_opentype`, …, raw. */
  properties: Record<string, string>;
}

export type FontResource = FontFileResource | SystemFontResource | FontVariationResource;

/** Loads a Font by `res://` path (or `res://file.tres::SubId` address); null on failure. */
export type FontLoaderFn = (address: string) => Promise<FontResource | null>;

/** Reads a Font by address off the SAME cache `loader.fonts` populates — no I/O of its own. */
export interface FontCacheReader {
  getCached(address: string): FontResource | null | undefined;
}
