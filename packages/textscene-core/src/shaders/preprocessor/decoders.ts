import { inflateSync } from 'three/addons/libs/fflate.module.js';
import { StreamEndsEarly, type Decoders } from '../../godot/io/compression/compression.js';
import { UnportedMethod } from '../../godot/variant/call/unportedMethod.js';

/** The `decompress` of each package an app installs for `#if`: the module imports only three (ADR-0072). */
export interface ShaderDecoders {
  /** `decompress` of the `fzstd` package. */
  readonly zstd?: (frames: Uint8Array) => Uint8Array;
  /** `decompress` of the `brotli/decompress` module of the `brotli` package. */
  readonly brotli?: (stream: Uint8Array, outSize?: number | null) => Uint8Array;
}

/** brotli's throw where its input ends inside the stream. */
const BROTLI_END_OF_INPUT = /^Unexpected end of input/;

/** fflate from three for Deflate and GZIP, and what the app lends for Zstandard and Brotli. */
export function decodersOf(lent: ShaderDecoders = {}): Decoders {
  return {
    inflate: (deflate) => inflateSync(deflate),
    zstd: lent.zstd ?? missing('Zstandard', 'fzstd', "import { decompress } from 'fzstd'", 'zstd'),
    brotli: lent.brotli
      ? brotliOf(lent.brotli)
      : missing('Brotli', 'brotli', "import { decompress } from 'brotli/decompress'", 'brotli'),
  };
}

function missing(codec: string, packageName: string, importLine: string, option: string) {
  return (): never => {
    throw new UnportedMethod(
      `decompress in ${codec} mode, which needs the ${packageName} package: install it, \`${importLine}\`` +
        ` and pass \`decoders: { ${option}: decompress }\``
    );
  };
}

/** Size 0, not none: brotli then grows its output, where none reads only the first meta-block's length. */
function brotliOf(decompress: NonNullable<ShaderDecoders['brotli']>) {
  return (stream: Uint8Array): Uint8Array => {
    try {
      return decompress(stream, 0);
    } catch (error) {
      if (error instanceof Error && BROTLI_END_OF_INPUT.test(error.message))
        throw new StreamEndsEarly(error.message);
      throw error;
    }
  };
}
