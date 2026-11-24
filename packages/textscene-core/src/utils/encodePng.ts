import { crc32 } from '../godot/io/compression/checksums';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const BIT_DEPTH = 8;
const COLOUR_TYPE_RGBA = 6;
const BYTES_PER_PIXEL = 4;
const FILTER_NONE = 0;

export interface RgbaImage {
  width: number;
  height: number;
  /** Straight alpha, top row first. */
  data: Uint8Array | Uint8ClampedArray;
}

/**
 * Not a 2D canvas: it premultiplies a partly clear pixel's colour, and each browser encodes other bytes.
 *
 * @canonical Encodes 8-bit RGBA pixels as a PNG
 */
export async function encodePng({ width, height, data }: RgbaImage): Promise<Blob> {
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, width);
  headerView.setUint32(4, height);
  header.set([BIT_DEPTH, COLOUR_TYPE_RGBA], 8);
  const parts = [
    new Uint8Array(SIGNATURE),
    chunk('IHDR', header),
    chunk('IDAT', await zlib(filteredRows(data, width, height))),
    chunk('IEND', new Uint8Array(0)),
  ];
  return new Blob(parts as BlobPart[], { type: 'image/png' });
}

function filteredRows(data: RgbaImage['data'], width: number, height: number): Uint8Array {
  const rowBytes = width * BYTES_PER_PIXEL;
  const rows = new Uint8Array(height * (rowBytes + 1));
  for (let row = 0; row < height; row++) {
    const at = row * (rowBytes + 1);
    rows[at] = FILTER_NONE;
    rows.set(data.subarray(row * rowBytes, (row + 1) * rowBytes), at + 1);
  }
  return rows;
}

/** The Compression Streams `deflate` format is zlib (RFC 1950), which IDAT holds. */
async function zlib(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function chunk(type: string, body: Uint8Array): Uint8Array {
  const whole = new Uint8Array(12 + body.length);
  const view = new DataView(whole.buffer);
  view.setUint32(0, body.length);
  for (let index = 0; index < 4; index++) whole[4 + index] = type.charCodeAt(index);
  whole.set(body, 8);
  view.setUint32(8 + body.length, crc32(whole.subarray(4, 8 + body.length)));
  return whole;
}
