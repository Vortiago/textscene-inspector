/**
 * Types for `brotli` (1.3.3), which ships no `.d.ts`: only its decoder entry, the one
 * `r3f/controls/native/text/brotliDecoder.ts` loads.
 */

declare module 'brotli/decompress' {
  /** Decodes one Brotli stream. `outputSize`, when given, is the exact decoded length. Throws on a stream that does not decode into it. */
  export default function decompress(input: Uint8Array, outputSize?: number): Uint8Array;
}
