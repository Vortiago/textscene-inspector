/**
 * Godot's texture importer (`editor/import/resource_importer_texture.cpp`): the sidecar options that
 * change an image file's texture, and the format the texture holds after import.
 */

import { storesAlpha, type ImageSourceFormat } from './imageSourceFormat.js';
import { enumMember, type EnumValue } from '../classdb/enumNames.js';

/** The importer a sidecar names for a 2D texture (`resource_importer_texture.cpp:164-166`). */
export const TEXTURE_IMPORTER = 'texture';

/**
 * `compress/mode`, indexed by the number a sidecar stores (`resource_importer_texture.cpp:234`).
 * `save_to_ctex_format` writes no texture for a number outside it (`:275-352`). `compressMode`
 * reads such a number as the default, so the preview shows the image rather than nothing.
 */
export const TEXTURE_COMPRESS_MODES = [
  'Lossless',
  'Lossy',
  'VramCompressed',
  'VramUncompressed',
  'BasisUniversal',
] as const;

export type TextureCompressMode = (typeof TEXTURE_COMPRESS_MODES)[number];

/** `compress/normal_map` (`resource_importer_texture.cpp:242`). */
export const TextureNormalMapMode = {
  Detect: 0,
  Enable: 1,
  Disabled: 2,
} as const;

/** `Image::RoughnessChannel` (`core/io/image.h:153-159`): the channel the roughness limiter raises. */
export const RoughnessChannel = {
  R: 0,
  G: 1,
  B: 2,
  A: 3,
  /** The grey of red, green and blue. */
  L: 4,
} as const;

/** `roughness/mode` from Red on, as `Image::RoughnessChannel` (`resource_importer_texture.cpp:247`, `:783`). */
const ROUGHNESS_MODE_FIRST_CHANNEL = 2;

/**
 * The roughness limiter a `roughness/mode` and `roughness/src_normal` ask for, or null for Detect,
 * Disabled, a mode outside the enum or no normal map (`resource_importer_texture.cpp:777-786`).
 */
export function roughnessLimitOption(
  mode: number | undefined,
  normalPath: string | undefined
): RoughnessLimitOption | null {
  if (mode === undefined || !normalPath) return null;
  const channel = enumMember(RoughnessChannel, mode - ROUGHNESS_MODE_FIRST_CHANNEL);
  return channel === null ? null : { channel, normalPath };
}

/** The roughness channel the limiter raises, and the path of the normal map it reads. */
export interface RoughnessLimitOption {
  channel: EnumValue<typeof RoughnessChannel>;
  normalPath: string;
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
  /** `roughness/mode` and `roughness/src_normal`: the limiter on the mip chain, or null for none. */
  roughnessLimit: RoughnessLimitOption | null;
}

/**
 * The defaults of the importer's Detect preset, which a fresh import writes and a file with no
 * sidecar reads as. The editor's later re-imports of a texture it sees in 3D or as a normal map are
 * not predicted.
 */
export const DEFAULT_TEXTURE_IMPORT: TextureImportOptions = {
  mode: 'Lossless',
  highQuality: false,
  normalMap: false,
  mipmaps: false,
  fixAlphaBorder: true,
  premultAlpha: false,
  invertNormalY: false,
  svgScale: 1,
  roughnessLimit: null,
};

/**
 * The `Image::format_names` entry the imported texture holds on a desktop GPU with S3TC and BPTC.
 * Lossless, Lossy and VRAM Uncompressed keep the source format: a WebP-packed image converts back to
 * it on load (`compressed_texture.cpp:345-352`). `isTranslucent` reads the texels, and only S3TC
 * of a source with alpha calls it.
 */
export function textureImportFormat(
  source: ImageSourceFormat,
  options: TextureImportOptions,
  isTranslucent: () => boolean
): string {
  if (holdsRedGreenOnly(options)) return RED_GREEN_FORMAT;
  switch (options.mode) {
    case 'VramCompressed':
      return options.highQuality ? 'BPTC_RGBA' : s3tcFormat(source, isTranslucent);
    case 'BasisUniversal':
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
  return mode === 'BasisUniversal' || (mode === 'VramCompressed' && !highQuality);
}

/**
 * S3TC by the channels the texels use (`resource_importer_texture.cpp:423-431`,
 * `image_compress_etcpak.cpp:60-78`): DXT5 when a texel is translucent, else DXT1. The default
 * sRGB-friendly channel pack turns red-only and red-green into RGB (`core/io/image.cpp:3800-3802`).
 */
function s3tcFormat(source: ImageSourceFormat, isTranslucent: () => boolean): string {
  return storesAlpha(source) && isTranslucent() ? 'DXT5 RGBA8' : 'DXT1 RGB8';
}

/** `Image::detect_used_channels` counts a texel with alpha below this as using alpha (`core/io/image.cpp:3760`). */
const OPAQUE_ALPHA_MIN = 0.999;

/** Whether any texel of RGBA8 `bytes` uses alpha, as `Image::detect_used_channels` finds it. */
export function hasTranslucentTexel(bytes: ArrayLike<number>): boolean {
  for (let alpha = 3; alpha < bytes.length; alpha += 4) {
    if (bytes[alpha]! / 255 < OPAQUE_ALPHA_MIN) return true;
  }
  return false;
}
