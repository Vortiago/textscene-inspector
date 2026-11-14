/**
 * PNG files built for the decoder's tests: real chunks with real CRCs and zlib data, from the
 * samples of each pixel, at any colour type, bit depth, filter and interlace.
 */
import { unzlibSync, zlibSync } from 'three/addons/libs/fflate.module.js';
import type { ZlibInflate } from './png';

export const inflate: ZlibInflate = (stream) => unzlibSync(stream);

export interface TestPng {
  readonly width: number;
  readonly height: number;
  readonly colourType: number;
  readonly bitDepth?: number;
  /** The samples of each pixel, row by row, `channels` of them per pixel. */
  readonly samples: readonly number[];
  readonly palette?: readonly number[];
  readonly transparency?: readonly number[];
  readonly isInterlaced?: boolean;
  /** The filter type of every row, 0 to 4. */
  readonly filter?: number;
}

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

const ADAM7 = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
] as const;

/** The bytes of a PNG of `png`. */
export function encodePng(png: TestPng): Uint8Array {
  const bitDepth = png.bitDepth ?? 8;
  const header = [
    ...u32(png.width),
    ...u32(png.height),
    bitDepth,
    png.colourType,
    0,
    0,
    png.isInterlaced ? 1 : 0,
  ];
  return new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...pngChunk('IHDR', header),
    ...(png.palette ? pngChunk('PLTE', png.palette) : []),
    ...(png.transparency ? pngChunk('tRNS', png.transparency) : []),
    ...pngChunk('IDAT', [...zlibSync(new Uint8Array(filteredData(png, bitDepth)))]),
    ...pngChunk('IEND'),
  ]);
}

/** A chunk of `type` with its CRC. */
export function pngChunk(type: string, body: readonly number[] = []): number[] {
  const typed = [...type].map((c) => c.charCodeAt(0)).concat(body);
  return [...u32(body.length), ...typed, ...u32(crc32(typed))];
}

function filteredData(png: TestPng, bitDepth: number): number[] {
  const channels = CHANNELS[png.colourType]!;
  const passes = png.isInterlaced ? ADAM7 : ([[0, 0, 1, 1]] as const);
  const data: number[] = [];
  for (const [x0, y0, dx, dy] of passes) {
    const width = Math.ceil((png.width - x0) / dx);
    const height = Math.ceil((png.height - y0) / dy);
    if (width <= 0 || height <= 0) continue;
    let previous: number[] = [];
    for (let row = 0; row < height; row++) {
      const samples: number[] = [];
      for (let column = 0; column < width; column++) {
        const pixel = (y0 + row * dy) * png.width + x0 + column * dx;
        samples.push(...png.samples.slice(pixel * channels, pixel * channels + channels));
      }
      const line = packed(samples, bitDepth);
      data.push(...filtered(line, previous, png.filter ?? 0, Math.max(1, (channels * bitDepth) / 8)));
      previous = line;
    }
  }
  return data;
}

function packed(samples: readonly number[], bitDepth: number): number[] {
  if (bitDepth === 16) return samples.flatMap((sample) => [sample >> 8, sample & 0xff]);
  if (bitDepth === 8) return [...samples];
  const bytes = new Array<number>(Math.ceil((samples.length * bitDepth) / 8)).fill(0);
  samples.forEach((sample, i) => {
    const bit = i * bitDepth;
    bytes[bit >> 3]! |= sample << (8 - bitDepth - (bit & 7));
  });
  return bytes;
}

function filtered(
  line: readonly number[],
  previous: readonly number[],
  filter: number,
  pixelBytes: number
): number[] {
  return [
    filter,
    ...line.map((byte, i) => {
      const left = line[i - pixelBytes] ?? 0;
      const up = previous[i] ?? 0;
      const upLeft = previous[i - pixelBytes] ?? 0;
      const prediction = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter]!;
      return (byte - prediction) & 0xff;
    }),
  ];
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const [toLeft, toUp, toUpLeft] = [left, up, upLeft].map((value) => Math.abs(estimate - value));
  if (toLeft! <= toUp! && toLeft! <= toUpLeft!) return left;
  return toUp! <= toUpLeft! ? up : upLeft;
}

function u32(value: number): number[] {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 0xff);
}

function crc32(bytes: readonly number[]): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
