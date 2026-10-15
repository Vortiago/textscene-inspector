/**
 * Godot's texture importer (`editor/import/resource_importer_texture.cpp`): the sidecar options that
 * change an image file's texture, and the format the texture holds after import.
 */

import type { ImageSourceFormat } from './imageSourceFormat.js';

/** The importer a sidecar names for a 2D texture (`resource_importer_texture.cpp:164-166`). */
export const TEXTURE_IMPORTER = 'texture';

/** `compress/mode` (`resource_importer_texture.cpp:234`). */
export enum TextureCompressMode {
  Lossless = 0,
  Lossy = 1,
  VramCompressed = 2,
  VramUncompressed = 3,
  BasisUniversal = 4,
}

/** `compress/normal_map` (`resource_importer_texture.cpp:242`). */
export enum TextureNormalMapMode {
  Detect = 0,
  Enable = 1,
  Disabled = 2,
}

/** The sidecar parameters that change what the imported texture samples (`:234-262`). */
export interface TextureImportOptions {
  mode: TextureCompressMode;
  /** `compress/high_quality`: BPTC rather than S3TC when VRAM compressed. */
  highQuality: boolean;
  /** `compress/normal_map` is Enable: compressed as a two-channel normal map. */
  normalMap: boolean;
  /** `mipmaps/generate`: whether the texture has a mip chain to sample. */
  mipmaps: boolean;
  /** `process/fix_alpha_border`. */
  fixAlphaBorder: boolean;
  /** `process/premult_alpha`. */
  premultAlpha: boolean;
  /** `process/normal_map_invert_y`. */
  invertNormalY: boolean;
  /** `svg/scale`: the rasterisation scale of an SVG source. */
  svgScale: number;
}

/**
 * The defaults of the importer's Detect preset, which a fresh import writes and a file with no
 * sidecar reads as. The editor's later re-imports of a texture it sees in 3D or as a normal map are
 * not predicted.
 */
export const DEFAULT_TEXTURE_IMPORT: TextureImportOptions = {
  mode: TextureCompressMode.Lossless,
  highQuality: false,
  normalMap: false,
  mipmaps: false,
  fixAlphaBorder: true,
  premultAlpha: false,
  invertNormalY: false,
  svgScale: 1,
};

/**
 * The `Image::format_names` entry the imported texture holds on a desktop GPU with S3TC and BPTC.
 * Lossless, Lossy and VRAM Uncompressed keep the source format: a WebP-packed image converts back to
 * it on load (`compressed_texture.cpp:345-352`).
 */
export function textureImportFormat(source: ImageSourceFormat, options: TextureImportOptions): string {
  if (holdsRedGreenOnly(options)) return RED_GREEN_FORMAT;
  switch (options.mode) {
    case TextureCompressMode.VramCompressed:
      return options.highQuality ? 'BPTC_RGBA' : s3tcFormat(source);
    case TextureCompressMode.BasisUniversal:
      // Transcoded to BC7, which a desktop GPU supports (`image_compress_basisu.cpp:356-393`).
      return 'BPTC_RGBA';
    default:
      return source;
  }
}

/** RGTC with two channels, which a shader samples as `(r, g, 0, 1)` and which has no sRGB view. */
const RED_GREEN_FORMAT = 'RGTC RedGreen8';

/**
 * Whether the import keeps only red and green. A normal map uses only RG (`core/io/image.cpp:3732-3734`),
 * so VRAM compression without high quality and Basis Universal, transcoded to BC5
 * (`image_compress_basisu.cpp:321-324`), store it as RGTC.
 */
export function holdsRedGreenOnly({ mode, highQuality, normalMap }: TextureImportOptions): boolean {
  if (!normalMap) return false;
  return (
    mode === TextureCompressMode.BasisUniversal ||
    (mode === TextureCompressMode.VramCompressed && !highQuality)
  );
}

/**
 * S3TC by the channels the source uses (`resource_importer_texture.cpp:934-947`,
 * `image_compress_etcpak.cpp:60-78`): L and RGB to DXT1, LA and RGBA to DXT5, both with an sRGB view.
 */
function s3tcFormat(source: ImageSourceFormat): string {
  return source === 'LumAlpha8' || source === 'RGBA8' ? 'DXT5 RGBA8' : 'DXT1 RGB8';
}
