/**
 * The Font slice's decoded data (ADR-0031), for Godot's three font resource types. The
 * decode is shallow: `base_font`, `fallbacks` and `font_names` become typed values, and
 * every other property stays a raw string, as in the StandardMaterial3D, MeshLibrary
 * and TileSet decodes.
 */

/**
 * `FontFile`: most often an `ExtResource` naming a raw `.ttf`/`.otf`/`.woff`/`.woff2`.
 * A `.tres` wrapper has no bytes of its own and lists `fallbacks`, plus bake settings
 * (`msdf_*`, `cache/*`) this previewer does not read.
 */
export interface FontFileResource {
  kind: 'file';
  /** Raw font bytes, ready for `new FontFace(name, bytes)`. Undefined for a bytes-less `.tres` wrapper. */
  bytes: ArrayBuffer | undefined;
  /** Undefined when `bytes` is undefined. */
  mimeType: string | undefined;
  /** Other Fonts to try, in order: usually the one real face behind a `.tres` wrapper. */
  fallbacks: FontResource[];
  /** Every other declared property (`msdf_*`, `subpixel_positioning`, `cache/*`, …), raw. */
  properties: Record<string, string>;
}

/**
 * `SystemFont`: no file. `font_names` are OS family names (`"sans-serif"`, …) resolved at
 * runtime, which this previewer cannot load bytes for.
 */
export interface SystemFontResource {
  kind: 'system';
  fontNames: string[];
  properties: Record<string, string>;
}

/**
 * `FontVariation`: wraps a `base_font` of any kind with synthesis, spacing and
 * OpenType-feature overrides. A null `baseFont` means the theme's default font.
 */
export interface FontVariationResource {
  kind: 'variation';
  baseFont: FontResource | null;
  /** `spacing_*`, `embolden`, `opentype_features`, `variation_opentype`, …, raw. */
  properties: Record<string, string>;
}

export type FontResource = FontFileResource | SystemFontResource | FontVariationResource;

/** Loads a Font by `res://` path (or `res://file.tres::SubId` address); null on failure. */
export type FontLoaderFn = (address: string) => Promise<FontResource | null>;

/** Reads a Font by address off the cache `loader.fonts` populates, with no I/O of its own. */
export interface FontCacheReader {
  getCached(address: string): FontResource | null | undefined;
}
