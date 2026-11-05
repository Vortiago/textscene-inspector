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
  /** The decoded BMFont of a `.fnt` or `.font` file. Absent for a font that draws from outlines. */
  bitmap?: BitmapFont;
  /**
   * Every other declared property (`msdf_*`, `subpixel_positioning`, `cache/*`, …), raw. A raw font
   * file holds the `[params]` of its import sidecar instead, as Godot's importer sets them on the
   * FontFile: a string literal decoded, and import-only keys such as `compress` with them.
   */
  properties: Record<string, string>;
}

/**
 * One glyph of a BMFont, in the pixels of the fixed size (`scene/resources/font.cpp:1985-2020`).
 * `offsetY` is already measured from the baseline, upward negative: the file's `yoffset` less `base`.
 */
export interface BitmapGlyph {
  /** The glyph's rectangle in its page image, px from the top left. */
  x: number;
  y: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  /** A negative advance in the file is already `width + 1`. */
  advance: number;
  /** Index into the fills of `BitmapFont.sheet`, or -1 for a glyph that draws no ink. */
  fillIndex: number;
}

/** The glyph fill of a page image, RGBA8 with the top row first, as Godot's converter leaves it. */
export interface BitmapFill {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

/** Fills stacked top to bottom into one RGBA8 image, top row first. */
export interface FillSheet {
  width: number;
  height: number;
  data: Uint8Array;
  /** The sheet row each fill starts at, by fill index; undefined for an index no page filled. */
  rowOffsets: readonly (number | undefined)[];
}

/** A BMFont `FontFile` (`FontFile::_load_bitmap_font`). */
export interface BitmapFont {
  fixedSize: number;
  /** `common base`, px at the fixed size. */
  ascent: number;
  /** `common lineHeight - base`, px at the fixed size. */
  descent: number;
  /** By Unicode codepoint, after the OEM charset mapping. */
  glyphs: ReadonlyMap<number, BitmapGlyph>;
  /** By `kerningKey(first, second)`, px at the fixed size. */
  kerning: ReadonlyMap<number, number>;
  /** The glyph fills of every page, stacked. A glyph's `fillIndex` names its row offset. */
  sheet: FillSheet;
  /** The outline set Godot draws for any outline size, stacked the same way. Blank when the layout has none. */
  outlineSheet: FillSheet;
  /** A `TextServer::FixedSizeScaleMode`, from the import sidecar's `scaling_mode`. */
  scaleMode: number;
}

/**
 * `SystemFont`: no file. `font_names` are OS family names (`"sans-serif"`, …) resolved at
 * runtime, which this previewer cannot load bytes for. It draws the theme's default font, as
 * Godot does when no OS font matches (`defaultFont.ts`).
 */
interface SystemFontResource {
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
