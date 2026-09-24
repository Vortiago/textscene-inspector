/**
 * Host<->webview resource wire codec: the one ArrayBuffer<->base64 contract that
 * TscnPreviewPanel and WebviewResourceProvider both import. It stays free of
 * React, THREE and Node, so both import closures accept it.
 */

/** Wire shape for a resource response payload (host -> webview). */
export type WireResourcePayload = {
  /** Text content, or base64-encoded bytes when `isBinary` is true. */
  content: string;
  isBinary: boolean;
};

/**
 * Encodes a resource for the webview message bus. A `string` passes through with
 * `isBinary: false`. An `ArrayBuffer` is base64-encoded in 8 KB chunks, which
 * avoids a stack overflow on a large texture, with `isBinary: true`.
 */
export function encodeResourceResponse(content: string | ArrayBuffer): WireResourcePayload {
  if (!(content instanceof ArrayBuffer)) {
    return { content, isBinary: false };
  }

  const bytes = new Uint8Array(content);
  const chunkSize = 8192;
  let binaryString = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binaryString += String.fromCharCode(...chunk);
  }
  return { content: btoa(binaryString), isBinary: true };
}

/**
 * Decodes a wire payload into its original form: `isBinary: false` as is, and
 * `isBinary: true` base64-decoded into an `ArrayBuffer`.
 */
export function decodeResourceResponse(payload: WireResourcePayload): string | ArrayBuffer {
  if (!payload.isBinary) {
    return payload.content;
  }

  const binaryString = atob(payload.content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
