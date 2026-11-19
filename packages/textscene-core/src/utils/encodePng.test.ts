import { CompressionStream } from 'node:stream/web';
import { inflateSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { decodePng } from '../r3f/controls/native/text/strike/png';
import { encodePng } from './encodePng';

// The test DOM lacks Compression Streams, which every browser the package serves has.
vi.stubGlobal('CompressionStream', CompressionStream);

const inflate = (stream: Uint8Array) => new Uint8Array(inflateSync(stream));

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

describe('the PNG encoder', () => {
  it('writes an image that a PNG decoder reads back pixel for pixel, top row first', async () => {
    // Red, green on the top row; blue, and a clear pixel, on the bottom.
    const rgba = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 0, 0, 0, 0]);
    const png = await encodePng({ width: 2, height: 2, data: rgba });
    expect(png.type).toBe('image/png');
    const decoded = decodePng(await bytesOf(png), inflate);
    expect(decoded).toMatchObject({ width: 2, height: 2 });
    // The decoder answers premultiplied BGRA.
    expect([...decoded!.bgra]).toEqual([0, 0, 255, 255, 0, 255, 0, 255, 255, 0, 0, 255, 0, 0, 0, 0]);
  });

  it('keeps the colour of a partly clear pixel, which a 2D canvas premultiplies away', async () => {
    const rgba = new Uint8Array([200, 100, 50, 3]);
    const png = await bytesOf(await encodePng({ width: 1, height: 1, data: rgba }));
    const filtered = inflate(idatOf(png));
    expect([...filtered]).toEqual([0, 200, 100, 50, 3]);
  });

  it('gives the same bytes for the same pixels', async () => {
    const rgba = new Uint8Array(64 * 4).map((_, index) => index % 251);
    const first = await bytesOf(await encodePng({ width: 8, height: 8, data: rgba }));
    const second = await bytesOf(await encodePng({ width: 8, height: 8, data: rgba }));
    expect(first).toEqual(second);
  });
});

/** The data of the one IDAT chunk of `png`. */
function idatOf(png: Uint8Array): Uint8Array {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  for (let at = 8; at < png.length;) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    if (type === 'IDAT') return png.subarray(at + 8, at + 8 + length);
    at += 12 + length;
  }
  throw new Error('expected an IDAT chunk, got none');
}
