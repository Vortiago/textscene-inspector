import { describe, expect, it } from 'vitest';
import { unifyBinaryRealm } from './vmRealm';

// The core setup file has already run `unifyBinaryRealm`, so each test reads the unified globals.
describe('unifyBinaryRealm', () => {
  it('makes an encoded buffer an ArrayBuffer of this realm', () => {
    const encoded = new TextEncoder().encode('glTF');

    expect(encoded).toBeInstanceOf(Uint8Array);
    expect(encoded.buffer).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(encoded)).toEqual([0x67, 0x6c, 0x54, 0x46]);
  });

  it('reads a local ArrayBuffer part as its bytes, not as a string', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4]).buffer], { type: 'image/webp' });

    expect(blob.size).toBe(4);
    expect(blob.type).toBe('image/webp');
    expect(Array.from(new Uint8Array(await blob.arrayBuffer()))).toEqual([1, 2, 3, 4]);
  });

  it('keeps the globals working when it runs a second time', async () => {
    unifyBinaryRealm();

    expect(new TextEncoder().encode('').buffer).toBeInstanceOf(ArrayBuffer);
    expect(await new Blob(['ab', new Uint8Array([99]).buffer]).text()).toBe('abc');
  });
});
