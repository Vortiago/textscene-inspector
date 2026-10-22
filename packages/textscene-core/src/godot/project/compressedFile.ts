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

/**
 * Bit 5 of a FastLZ stream's first byte marks level 2. `fastlz_compress` picks level 2 only for an
 * input of 65536 bytes or more, and Godot compresses each 4096-byte block on its own
 * (`file_access_compressed.h:69`), so a block Godot writes is always level 1.
 */
export const FASTLZ_LEVEL_2_FLAG = 0x20;
