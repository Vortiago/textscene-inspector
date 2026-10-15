/**
 * The headers of PNG, JPEG and WebP files, enough for a sniff of the format Godot loads them in.
 * No builder writes decodable pixels or a valid CRC.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0));

/** A PNG chunk with a zero CRC. */
export function pngChunk(type: string, body: number[] = []): number[] {
  const length = [24, 16, 8, 0].map((shift) => (body.length >>> shift) & 0xff);
  return [...length, ...ascii(type), ...body, 0, 0, 0, 0];
}

/** A 4 × 1 PNG of `colourType` at `bitDepth`, with `extraChunks` before its image data. */
export function png(colourType: number, { bitDepth = 8, extraChunks = [] as string[] } = {}): Uint8Array {
  const ihdr = [0, 0, 0, 4, 0, 0, 0, 1, bitDepth, colourType, 0, 0, 0];
  return new Uint8Array([
    ...PNG_SIGNATURE,
    ...pngChunk('IHDR', ihdr),
    ...extraChunks.flatMap((type) => pngChunk(type, [0, 0])),
    ...pngChunk('IDAT', [0]),
    ...pngChunk('IEND'),
  ]);
}

/** A baseline JPEG header with `components` components, after an APP0 segment. */
export function jpeg(components: number): Uint8Array {
  const app0 = [0xff, 0xe0, 0x00, 0x04, 0x00, 0x00];
  const sofLength = 8 + 3 * components;
  const sof0 = [
    0xff,
    0xc0,
    0x00,
    sofLength,
    8,
    0,
    1,
    0,
    4,
    components,
    ...Array<number>(3 * components).fill(0),
  ];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof0, 0xff, 0xd9]);
}

/** A WebP container holding one `chunk` with `body`. */
export function webp(chunk: 'VP8 ' | 'VP8L' | 'VP8X', body: number[]): Uint8Array {
  return new Uint8Array([
    ...ascii('RIFF'),
    0,
    0,
    0,
    0,
    ...ascii('WEBP'),
    ...ascii(chunk),
    body.length,
    0,
    0,
    0,
    ...body,
  ]);
}

/** A VP8L header for a 4 × 1 image, with its `alpha_is_used` bit. */
export function vp8l(alphaIsUsed: boolean): number[] {
  // 14 bits of width - 1 and 14 of height - 1, then the alpha bit, little-endian after the 0x2f signature.
  const bits = 3 | ((alphaIsUsed ? 1 : 0) << 28);
  return [0x2f, bits & 0xff, (bits >>> 8) & 0xff, (bits >>> 16) & 0xff, (bits >>> 24) & 0xff];
}

/** `bytes` as the `ArrayBuffer` a provider serves. */
export function arrayBufferOf(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}
