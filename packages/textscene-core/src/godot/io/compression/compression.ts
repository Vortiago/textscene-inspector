import { CompressionMode } from '../../project/compressedFile.js';
import { representableLength } from '../../variant/call/arrayLength.js';
import { UnportedMethod } from '../../variant/call/unportedMethod.js';
import { UnportableUtility } from '../../variant/utility/unportableUtility.js';
import { rethrowUnportable } from './decoderError.js';
import { fastLzDecompress } from './fastlz.js';
import { inflateGzip, inflateZlib, type InflatedStream, type RawInflate } from './zlibStream.js';

/** The decoders a host lends: each throws for a stream it refuses, and UnportedMethod when not lent. */
export interface Decoders {
  readonly inflate: RawInflate;
  /** Every Zstandard frame of the input, joined, as `ZSTD_decompressDCtx` reads them. */
  readonly zstd: (frames: Uint8Array) => Uint8Array;
  /** The Brotli stream at the start of the input: StreamEndsEarly where the input ends inside it. */
  readonly brotli: (stream: Uint8Array) => Uint8Array;
}

/** A decoder's throw for a stream cut short, which Godot's dynamic loop waits on for ever. */
export class StreamEndsEarly extends Error {}

const EMPTY = new Uint8Array(0);
const INT32_MAX = 2 ** 31 - 1;

/** `gzip_chunk` (compression.h:45): the bytes `decompress_dynamic` adds to its output each round. */
const GZIP_CHUNK = 16384;

/** `fastlz_decompress` writes into at least this many bytes (compression.cpp:165). */
const FASTLZ_MIN_DESTINATION = 16;

/** A host with no decoders, such as one that runs only `#if` arithmetic, refuses the codecs it would need. */
function lent(decoders: Decoders | undefined): Decoders {
  if (!decoders)
    throw new UnportedMethod(
      'decompress of a Deflate, GZIP, Zstandard or Brotli stream, with no decoders lent'
    );
  return decoders;
}

/** `Compression::decompress` (compression.cpp:149) and the method's guards: empty for an error. */
export function decompress(
  source: Uint8Array,
  bufferSize: bigint,
  mode: number,
  decoders?: Decoders
): Uint8Array {
  if (bufferSize <= 0n || source.length === 0) return EMPTY;
  switch (mode) {
    case CompressionMode.FastLz:
      return bufferSize > INT32_MAX ? EMPTY : decompressFastLz(source, Number(bufferSize));
    case CompressionMode.Deflate:
    case CompressionMode.Gzip:
      return bufferSize > INT32_MAX
        ? EMPTY
        : fitting(inflateWrapped(source, mode, lent(decoders).inflate), bufferSize);
    case CompressionMode.Zstd:
    case CompressionMode.Brotli:
      // Godot allocates `bufferSize` first, and an allocation this port cannot hold depends on the machine.
      representableLength(Number(bufferSize));
      return fitting(decoded(source, codec(lent(decoders), mode)), bufferSize);
    default:
      return EMPTY;
  }
}

/** `Compression::decompress_dynamic` (compression.cpp:229): a negative `maxSize` has no limit. */
export function decompressDynamic(
  source: Uint8Array,
  maxSize: bigint,
  mode: number,
  decoders?: Decoders
): Uint8Array {
  if (source.length === 0) return EMPTY;
  if (mode === CompressionMode.Brotli) return withinMax(brotliDynamic(source, lent(decoders)), maxSize);
  if (mode !== CompressionMode.Deflate && mode !== CompressionMode.Gzip) return EMPTY;
  const stream = inflateWrapped(source, mode, lent(decoders).inflate);
  if (!stream) return EMPTY;
  return stream.end < source.length
    ? withTrailingBytes(stream.output, maxSize)
    : withinMax(stream.output, maxSize);
}

/** The loop ends only on a full chunk: `inflate` takes nothing after `Z_STREAM_END` (compression.cpp:350). */
function withTrailingBytes(output: Uint8Array, maxSize: bigint): Uint8Array {
  const fullChunksEnd = output.length - (output.length % GZIP_CHUNK);
  if (maxSize >= 0n && fullChunksEnd > maxSize) return EMPTY;
  if (output.length > 0 && output.length === fullChunksEnd) return withinMax(output, maxSize);
  throw new UnportableUtility(
    'decompress_dynamic of a stream with bytes after its end, where Godot never returns'
  );
}

const withinMax = (output: Uint8Array, maxSize: bigint): Uint8Array =>
  maxSize >= 0n && output.length > maxSize ? EMPTY : output;

/** Godot's Brotli loop asks for more input for ever when the stream ends early (compression.cpp:264). */
function brotliDynamic(source: Uint8Array, decoders: Decoders): Uint8Array {
  try {
    return decoders.brotli(source);
  } catch (error) {
    if (error instanceof StreamEndsEarly)
      throw new UnportableUtility(
        'decompress_dynamic of a Brotli stream that ends early, where Godot never returns'
      );
    rethrowUnportable(error);
    return EMPTY;
  }
}

/** Below 16 bytes Godot copies `bufferSize` bytes of a 16-byte stack buffer, whatever FastLZ wrote there. */
function decompressFastLz(source: Uint8Array, bufferSize: number): Uint8Array {
  if (bufferSize >= FASTLZ_MIN_DESTINATION) {
    const { written, isComplete } = fastLzDecompress(source, bufferSize);
    return isComplete ? written : EMPTY;
  }
  const { written } = fastLzDecompress(source, FASTLZ_MIN_DESTINATION);
  if (written.length < bufferSize)
    throw new UnportableUtility(
      'decompress of a FastLZ stream shorter than its buffer, which reads unset memory'
    );
  return written.subarray(0, bufferSize);
}

const inflateWrapped = (source: Uint8Array, mode: number, inflate: RawInflate): InflatedStream | undefined =>
  mode === CompressionMode.Deflate ? inflateZlib(source, inflate) : inflateGzip(source, inflate);

const codec = (decoders: Decoders, mode: number) =>
  mode === CompressionMode.Zstd ? decoders.zstd : decoders.brotli;

function decoded(source: Uint8Array, decode: (source: Uint8Array) => Uint8Array): InflatedStream | undefined {
  try {
    return { output: decode(source), end: source.length };
  } catch (error) {
    rethrowUnportable(error);
    // Godot reads a stream that `ZSTD_decompressDCtx` or `BrotliDecoderDecompress` refuses as no bytes.
    return undefined;
  }
}

/** `inflate`, `ZSTD_decompressDCtx` and `BrotliDecoderDecompress` fail where the output passes the buffer. */
const fitting = (stream: InflatedStream | undefined, bufferSize: bigint): Uint8Array =>
  stream && stream.output.length <= bufferSize ? stream.output : EMPTY;
