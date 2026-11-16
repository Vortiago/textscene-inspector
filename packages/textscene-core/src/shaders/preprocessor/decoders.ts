import { inflateSync } from 'three/addons/libs/fflate.module.js';
import { decompress as zstdDecompress } from 'fzstd';
import { decompress as brotliDecompress } from 'brotli/decompress';
import { StreamEndsEarly, type Decoders } from '../../godot/io/compression/compression.js';

/** brotli's throw where its input ends inside the stream. */
const BROTLI_END_OF_INPUT = /^Unexpected end of input/;

/** fflate, fzstd and brotli: the decoders binary resources and woff2 fonts already load. */
export const DECODERS: Decoders = {
  inflate: (deflate) => inflateSync(deflate),
  zstd: (frames) => zstdDecompress(frames),
  brotli,
};

/** Size 0, not none: brotli then grows its output, where none reads only the first meta-block's length. */
function brotli(stream: Uint8Array): Uint8Array {
  try {
    return brotliDecompress(stream, 0);
  } catch (error) {
    if (error instanceof Error && BROTLI_END_OF_INPUT.test(error.message))
      throw new StreamEndsEarly(error.message);
    throw error;
  }
}
