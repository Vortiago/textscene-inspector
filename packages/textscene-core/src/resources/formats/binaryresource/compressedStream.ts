/**
 * The stream inside a compressed binary resource (`RSCC`): `FileAccessCompressed`'s blocks,
 * each inflated in the file's one compression mode and joined. Ported from
 * `FileAccessCompressed::open_after_magic` and `Compression::decompress`
 * (`core/io/file_access_compressed.cpp:41-75`, `core/io/compression.cpp:146-230`).
 */

import { CompressionMode } from '../../../godot/project/compressedFile';
import { ByteReader } from './byteReader';
import { decompressFastLz } from './fastlz';

/** Inflates one block to exactly `size` bytes. */
type BlockInflater = (block: Uint8Array, size: number) => Uint8Array;

/** `reader` stands just past the magic. */
export async function inflateCompressedStream(reader: ByteReader): Promise<Uint8Array> {
  const mode = reader.u32();
  const blockSize = reader.u32();
  if (blockSize === 0) throw new Error('expected a compressed block size above 0, got 0');
  const streamSize = reader.u32();
  const blockCount = Math.floor(streamSize / blockSize) + 1;
  const compressedSizes = Array.from({ length: blockCount }, () => reader.u32());
  const inflate = await blockInflater(mode);
  const stream = new Uint8Array(streamSize);
  compressedSizes.forEach((compressedSize, index) => {
    const block = reader.take(compressedSize);
    const start = index * blockSize;
    const size = Math.min(blockSize, streamSize - start);
    // A stream of whole blocks ends in an empty one, which Godot never reads.
    if (size === 0) return;
    try {
      stream.set(inflate(block, size), start);
    } catch (error) {
      throw new Error(`block ${index} of ${blockCount} in a ${CompressionMode[mode]} stream: ${error}`, {
        cause: error,
      });
    }
  });
  return stream;
}

async function blockInflater(mode: number): Promise<BlockInflater> {
  switch (mode) {
    case CompressionMode.FastLz:
      return decompressFastLz;
    case CompressionMode.Deflate: {
      const { unzlibSync } = await import('three/addons/libs/fflate.module.js');
      return (block, size) => exactly(size, unzlibSync(block, { out: new Uint8Array(size) }));
    }
    case CompressionMode.Gzip: {
      const { gunzipSync } = await import('three/addons/libs/fflate.module.js');
      return (block, size) => exactly(size, gunzipSync(block, { out: new Uint8Array(size) }));
    }
    case CompressionMode.Zstd: {
      const { decompress } = await import('fzstd');
      return (block, size) => exactly(size, decompress(block, new Uint8Array(size)));
    }
    case CompressionMode.Brotli:
      // Godot cannot compress with brotli (`compression.cpp:52-53`), so no file it saves holds it.
      throw new Error('expected a compression mode Godot writes, got brotli');
    default:
      throw new Error(`expected a compression mode from 0 to ${CompressionMode.Brotli}, got ${mode}`);
  }
}

function exactly(size: number, inflated: Uint8Array): Uint8Array {
  if (inflated.length !== size) throw new Error(`expected ${size} bytes, got ${inflated.length}`);
  return inflated;
}
