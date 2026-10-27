/**
 * The one place `brotli` is imported, and lazily: its decoder and dictionary are about 50 kB gzipped,
 * and only a `.woff2` scene font needs them. `brotliImportSite.contract.test.ts` holds the import to
 * this file. The decoder is pure JS, as the webview CSP blocks WASM and `DecompressionStream` has no
 * brotli format.
 */

/** Loads the Brotli decoder. The module system memoises the import, so every caller shares one. */
export async function loadBrotliDecoder() {
  return (await import('brotli/decompress')).default;
}
