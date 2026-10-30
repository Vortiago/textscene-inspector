/** Types for `wawoff2` (2.0.1), which ships none: Google's reference WOFF2 codec, used by tests as an independent encoder and decoder. */

declare module 'wawoff2' {
  const wawoff2: {
    /** The plain sfnt of a WOFF2 file. */
    decompress(woff2: Uint8Array): Promise<Uint8Array>;
    /** A WOFF2 file of a plain sfnt, with its `glyf` and `loca` tables transformed. */
    compress(sfnt: Uint8Array): Promise<Uint8Array>;
  };
  export default wawoff2;
}
