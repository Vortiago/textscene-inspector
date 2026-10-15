/**
 * The `Image::format_names` entry Godot's image loaders give an image file's bytes: the source
 * format its texture importer starts from. Read from the headers alone, with no decode.
 */

/** The loaders' outputs (`core/io/image.cpp:42-47`). */
export type ImageSourceFormat = 'Lum8' | 'LumAlpha8' | 'RGB8' | 'RGBA8';

/**
 * The format Godot's loader for `mimeType` gives `bytes`, or null when that loader would refuse
 * them. Godot picks the loader by the file's extension, so a PNG named `.jpg` is no JPEG here.
 */
export function imageSourceFormat(bytes: Uint8Array, mimeType: string): ImageSourceFormat | null {
  switch (mimeType) {
    case 'image/png':
      return pngSourceFormat(bytes);
    case 'image/jpeg':
      return jpegSourceFormat(bytes);
    case 'image/webp':
      return webpSourceFormat(bytes);
    case 'image/svg+xml':
      // `image_loader_svg.cpp:130` rasterises every SVG to RGBA8.
      return 'RGBA8';
    default:
      return null;
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** The IHDR colour type's offset: the signature, the chunk's length and type, width, height, depth. */
const PNG_COLOUR_TYPE_OFFSET = 25;
const PNG_FIRST_CHUNK_OFFSET = PNG_SIGNATURE.length;
/** A chunk's length and type before its body, and its CRC after it. */
const PNG_CHUNK_OVERHEAD = 12;

/** The colour type's bits (PNG specification, 11.2.2). A palette, type 3, sets the colour bit. */
const PNG_COLOUR_BIT = 2;
const PNG_ALPHA_BIT = 4;

/**
 * libpng's simplified read (`png_driver_common.cpp:66-93`): grey or colour, with alpha when the
 * colour type has it or a `tRNS` chunk precedes the image data. Depth is stripped to 8 bits, and
 * a palette expands to direct colour, so a grey palette reads RGB8.
 */
function pngSourceFormat(bytes: Uint8Array): ImageSourceFormat | null {
  if (bytes.length <= PNG_COLOUR_TYPE_OFFSET) return null;
  if (!PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) return null;

  const colourType = bytes[PNG_COLOUR_TYPE_OFFSET]!;
  const hasColour = (colourType & PNG_COLOUR_BIT) !== 0;
  const hasAlpha = (colourType & PNG_ALPHA_BIT) !== 0 || hasTransparencyChunk(bytes);
  if (hasColour) return hasAlpha ? 'RGBA8' : 'RGB8';
  return hasAlpha ? 'LumAlpha8' : 'Lum8';
}

/** Whether a `tRNS` chunk precedes the first `IDAT`, where the PNG specification places it. */
function hasTransparencyChunk(bytes: Uint8Array): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = PNG_FIRST_CHUNK_OFFSET; offset + 8 <= bytes.length;) {
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type === 'tRNS') return true;
    if (type === 'IDAT') return false;
    offset += PNG_CHUNK_OVERHEAD + view.getUint32(offset);
  }
  return false;
}

const JPEG_MARKER = 0xff;
const JPEG_START_OF_IMAGE = 0xd8;
/** A start-of-frame marker's component count: marker, length, precision, height and width before it. */
const JPEG_COMPONENTS_OFFSET = 9;

/** A start-of-frame marker: `0xC0` to `0xCF`, less DHT (`0xC4`), JPG (`0xC8`) and DAC (`0xCC`). */
function isStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

/**
 * libjpeg-turbo's colour space (`image_loader_libjpeg_turbo.cpp:58-65`): a one-component frame is
 * `TJCS_GRAY` and loads as L8. Every other loads as RGB8.
 */
function jpegSourceFormat(bytes: Uint8Array): ImageSourceFormat | null {
  if (bytes[0] !== JPEG_MARKER || bytes[1] !== JPEG_START_OF_IMAGE) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 2; offset + JPEG_COMPONENTS_OFFSET < bytes.length;) {
    if (bytes[offset] !== JPEG_MARKER) return null;
    const marker = bytes[offset + 1]!;
    if (isStartOfFrame(marker)) return bytes[offset + JPEG_COMPONENTS_OFFSET] === 1 ? 'Lum8' : 'RGB8';
    offset += 2 + view.getUint16(offset + 2);
  }
  return null;
}

/** The first chunk of a WebP's RIFF container, after `RIFF`, the size and `WEBP`. */
const WEBP_CHUNK_OFFSET = 12;
const WEBP_CHUNK_BODY_OFFSET = WEBP_CHUNK_OFFSET + 8;
/** The VP8X flags' alpha bit (WebP container specification, Extended File Format). */
const VP8X_ALPHA_FLAG = 0x10;
/** The VP8L header: a signature byte, then two 14-bit sizes, `alpha_is_used` and the version. */
const VP8L_HEADER_BYTES = 5;
/** VP8L's `alpha_is_used` bit, after the signature byte and two 14-bit sizes. */
const VP8L_ALPHA_BIT = 28;

/**
 * `WebPGetFeatures`' `has_alpha` (`webp_common.cpp:135-175`): RGBA8 with alpha, RGB8 without.
 * A WebP never loads as greyscale.
 */
function webpSourceFormat(bytes: Uint8Array): ImageSourceFormat | null {
  if (bytes.length < WEBP_CHUNK_BODY_OFFSET + VP8L_HEADER_BYTES) return null;
  const ascii = (from: number) => String.fromCharCode(...bytes.subarray(from, from + 4));
  if (ascii(0) !== 'RIFF' || ascii(8) !== 'WEBP') return null;

  const body = WEBP_CHUNK_BODY_OFFSET;
  switch (ascii(WEBP_CHUNK_OFFSET)) {
    case 'VP8 ':
      return 'RGB8';
    case 'VP8L': {
      const header = new DataView(bytes.buffer, bytes.byteOffset + body + 1, 4).getUint32(0, true);
      return (header >>> VP8L_ALPHA_BIT) & 1 ? 'RGBA8' : 'RGB8';
    }
    case 'VP8X':
      return bytes[body]! & VP8X_ALPHA_FLAG ? 'RGBA8' : 'RGB8';
    default:
      return null;
  }
}
