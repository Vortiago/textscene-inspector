/**
 * Host<->webview resource wire codec.
 *
 * Centralises the ArrayBuffer<->base64 encoding contract so that the
 * extension host (TscnPreviewPanel) and the webview bundle
 * (WebviewResourceProvider) cannot drift independently. Both bundles import
 * from this module; it must remain React/THREE/Node-free so both import
 * closures accept it.
 */

/** Wire shape for a resource response payload (host -> webview). */
export type WireResourcePayload = {
  /** Text content, or base64-encoded bytes when `isBinary` is true. */
  content: string;
  isBinary: boolean;
};

/**
 * Encode a raw resource value for transmission over the webview message bus.
 *
 * `string` content is passed through unchanged with `isBinary: false`.
 * `ArrayBuffer` content is base64-encoded in 8 KB chunks (avoiding stack
 * overflow on large textures) and returned with `isBinary: true`.
 */
export function encodeResourceResponse(content: string | ArrayBuffer): WireResourcePayload {
  if (!(content instanceof ArrayBuffer)) {
    return { content, isBinary: false };
  }

  const bytes = new Uint8Array(content);
  const chunkSize = 8192;
  let binaryString = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binaryString += String.fromCharCode(...chunk);
  }
  return { content: btoa(binaryString), isBinary: true };
}

/**
 * Decode a wire payload received over the webview message bus back into its
 * original form.
 *
 * `isBinary: false` payloads are returned as-is.
 * `isBinary: true` payloads are base64-decoded into an `ArrayBuffer`.
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
