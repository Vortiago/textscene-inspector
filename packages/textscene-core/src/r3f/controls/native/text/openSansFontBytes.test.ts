import { describe, expect, it } from 'vitest';
import { OPEN_SANS_WOFF2_BASE64 } from './openSansFontBytes';

function decode(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

describe('OPEN_SANS_WOFF2_BASE64', () => {
  it('decodes to the vendored woff2, per the WOFF2 spec header — signature "wOF2", and the self-declared total length at offset 8 matching the real byte count', () => {
    const bytes = decode(OPEN_SANS_WOFF2_BASE64);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('wOF2');

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(8)).toBe(bytes.byteLength);
  });

  it('is raw base64, not a data: URL — the webview CSP blocks fetching one, so these bytes reach `new FontFace(name, arrayBuffer)` directly', () => {
    expect(OPEN_SANS_WOFF2_BASE64.startsWith('data:')).toBe(false);
    expect(/^[A-Za-z0-9+/]+={0,2}$/.test(OPEN_SANS_WOFF2_BASE64)).toBe(true);
  });
});
