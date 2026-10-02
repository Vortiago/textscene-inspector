import { describe, expect, it } from 'vitest';
import { webcrypto } from './webCrypto.browser';

describe('webCrypto.browser', () => {
  it('is the global crypto, which a web extension host provides', () => {
    expect(webcrypto).toBe(globalThis.crypto);
  });

  it('fills a buffer through getRandomValues', () => {
    expect(webcrypto.getRandomValues(new Uint8Array(4))).toHaveLength(4);
  });
});
