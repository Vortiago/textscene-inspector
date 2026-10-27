/**
 * The one place `brotli` is imported, and lazily: its decoder and dictionary are about 50 kB gzipped,
 * and only a `.woff2` scene font needs them. `brotliImportSite.contract.test.ts` holds the import to
 * this file. The decoder is pure JS, as the webview CSP blocks WASM and `DecompressionStream` has no
 * brotli format.
 */

type BrotliDecompress = (input: Uint8Array, outputSize: number) => Uint8Array;

/** Written only by `loadBrotliDecoder`, on its first call. It never clears: a failed import stays failed. */
let pending: Promise<BrotliDecompress> | null = null;

/** Loads the Brotli decoder, memoised so every caller shares one import. */
export function loadBrotliDecoder(): Promise<BrotliDecompress> {
  pending ??= import('brotli/decompress').then((m) => m.default);
  return pending;
}
