/** A `DataView` over the bytes of a typed array alone, not over the whole buffer it shares. */
export function bytesView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
