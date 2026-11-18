/**
 * The layout facts of `FileAccessCompressed`, the block container a compressed binary resource
 * (`RSCC`) wraps its stream in, from `core/io/file_access_compressed.cpp` and
 * `core/io/compression.h` in Godot 4.6.3.
 */

/** `Compression::Mode` (`compression.h:47-53`), the u32 after the magic. */
export const CompressionMode = {
  FastLz: 0,
  Deflate: 1,
  Zstd: 2,
  Gzip: 3,
  Brotli: 4,
} as const;
