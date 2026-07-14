/**
 * Round-trip tests for the host<->webview resource wire codec.
 *
 * Each test constructs an input, encodes it, then decodes the encoded form
 * and asserts the result is byte-for-byte identical to the original.
 * Expected values are literals derived from the spec (base64 alphabet,
 * byte sequences), never recomputed the same way the codec does it.
 */

import { describe, expect, it } from 'vitest';
import {
  encodeResourceResponse,
  decodeResourceResponse,
  type WireResourcePayload,
} from './wireCodec';

// ============================================================================
// Text resources
// ============================================================================

describe('wireCodec — text resources', () => {
  it('encodes a plain text string as isBinary:false with the original content', () => {
    const encoded = encodeResourceResponse('hello world');
    expect(encoded).toEqual({ content: 'hello world', isBinary: false });
  });

  it('decodes an isBinary:false payload back to the original string', () => {
    const payload: WireResourcePayload = { content: 'hello world', isBinary: false };
    const decoded = decodeResourceResponse(payload);
    expect(decoded).toBe('hello world');
  });

  it('round-trips an empty string', () => {
    const encoded = encodeResourceResponse('');
    expect(encoded).toEqual({ content: '', isBinary: false });
    expect(decodeResourceResponse(encoded)).toBe('');
  });

  it('round-trips a multiline TSCN string without corruption', () => {
    const tscn = '[gd_scene format=3]\n[node name="Root" type="Node3D"]';
    const encoded = encodeResourceResponse(tscn);
    expect(encoded.isBinary).toBe(false);
    expect(decodeResourceResponse(encoded)).toBe(tscn);
  });
});

// ============================================================================
// Binary resources — small (sub-chunk)
// ============================================================================

describe('wireCodec — binary resources smaller than one chunk', () => {
  it('encodes a 4-byte buffer as isBinary:true', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const encoded = encodeResourceResponse(bytes.buffer);
    expect(encoded.isBinary).toBe(true);
    // PNG magic bytes base64 → "iVBORw==" — known-good literal
    expect(encoded.content).toBe('iVBORw==');
  });

  it('decodes a small binary payload back to the original bytes', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const payload: WireResourcePayload = { content: 'iVBORw==', isBinary: true };
    const decoded = decodeResourceResponse(payload);
    expect(decoded).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(decoded as ArrayBuffer)).toEqual(bytes);
  });

  it('round-trips a single zero byte', () => {
    const buf = new Uint8Array([0x00]).buffer;
    const encoded = encodeResourceResponse(buf);
    expect(encoded).toEqual({ content: 'AA==', isBinary: true });
    const decoded = decodeResourceResponse(encoded);
    expect(new Uint8Array(decoded as ArrayBuffer)).toEqual(new Uint8Array([0x00]));
  });

  it('round-trips 8 bytes of arbitrary data without corruption', () => {
    const input = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x7f, 0x10]);
    const encoded = encodeResourceResponse(input.buffer);
    expect(encoded.isBinary).toBe(true);
    const decoded = decodeResourceResponse(encoded);
    expect(new Uint8Array(decoded as ArrayBuffer)).toEqual(input);
  });
});

// ============================================================================
// Binary resources — chunk-boundary sizes
//
// The codec encodes in 8 KB (8 192-byte) chunks to avoid stack overflow on
// large buffers. These cases exercise sizes that cross one or more boundaries.
// ============================================================================

describe('wireCodec — binary resources crossing 8 KB chunk boundaries', () => {
  /** Build a deterministic byte pattern (not the trivial `i % 256` ramp). */
  function makeBytes(length: number): Uint8Array {
    const b = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      b[i] = (i * 37 + 11) % 256;
    }
    return b;
  }

  it('round-trips exactly 8 192 bytes (one full chunk, no spill)', () => {
    const input = makeBytes(8192);
    const encoded = encodeResourceResponse(input.buffer);
    expect(encoded.isBinary).toBe(true);
    const decoded = decodeResourceResponse(encoded);
    expect(new Uint8Array(decoded as ArrayBuffer)).toEqual(input);
  });

  it('round-trips 8 193 bytes (one byte past the first chunk boundary)', () => {
    const input = makeBytes(8193);
    const encoded = encodeResourceResponse(input.buffer);
    expect(encoded.isBinary).toBe(true);
    const decoded = decodeResourceResponse(encoded);
    expect(new Uint8Array(decoded as ArrayBuffer)).toEqual(input);
  });

  it('round-trips 20 000 bytes (more than 2x the chunk size)', () => {
    const input = makeBytes(20_000);
    const encoded = encodeResourceResponse(input.buffer);
    expect(encoded.isBinary).toBe(true);
    const decoded = decodeResourceResponse(encoded);
    expect(new Uint8Array(decoded as ArrayBuffer)).toEqual(input);
  });

  it('round-trips 100 000 bytes (many chunk boundaries)', () => {
    const input = makeBytes(100_000);
    const encoded = encodeResourceResponse(input.buffer);
    expect(encoded.isBinary).toBe(true);
    const decoded = decodeResourceResponse(encoded);
    expect(new Uint8Array(decoded as ArrayBuffer)).toEqual(input);
  });
});

// ============================================================================
// Type discrimination
// ============================================================================

describe('wireCodec — type discrimination', () => {
  it('encodes a string (not ArrayBuffer) as text even when it looks like base64', () => {
    const b64like = 'SGVsbG8gV29ybGQ=';
    const encoded = encodeResourceResponse(b64like);
    expect(encoded.isBinary).toBe(false);
    expect(encoded.content).toBe(b64like);
  });

  it('encodes an ArrayBuffer (even empty) as binary', () => {
    const encoded = encodeResourceResponse(new ArrayBuffer(0));
    expect(encoded.isBinary).toBe(true);
    expect(encoded.content).toBe('');
  });

  it('decodeResourceResponse returns string for isBinary:false', () => {
    const result = decodeResourceResponse({ content: 'abc', isBinary: false });
    expect(typeof result).toBe('string');
    expect(result).toBe('abc');
  });

  it('decodeResourceResponse returns ArrayBuffer for isBinary:true', () => {
    const result = decodeResourceResponse({ content: 'AAEC', isBinary: true });
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(result as ArrayBuffer)).toEqual(new Uint8Array([0, 1, 2]));
  });
});
