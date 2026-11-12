import { describe, expect, it } from 'vitest';
import { bundledFontBytes } from './bundledFontBytes';

describe('bundledFontBytes', () => {
  it('holds a WOFF2 file', () => {
    expect(new TextDecoder().decode(new Uint8Array(bundledFontBytes(), 0, 4))).toBe('wOF2');
  });

  it('decodes once, so every read of the outlines shares one buffer', () => {
    expect(bundledFontBytes()).toBe(bundledFontBytes());
  });
});
