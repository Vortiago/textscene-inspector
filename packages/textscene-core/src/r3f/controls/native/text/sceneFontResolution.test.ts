import { describe, expect, it } from 'vitest';
import { resolveFontFileBytes } from './sceneFontResolution';
import type { FontFileResource, FontResource } from '../../../../resources/processing/fontProcessing';

function fontFile(bytes: ArrayBuffer | undefined, fallbacks: FontResource[] = []): FontFileResource {
  return { kind: 'file', bytes, mimeType: bytes ? 'font/ttf' : undefined, fallbacks, properties: {} };
}

describe('resolveFontFileBytes', () => {
  it('returns null for undefined/null (no font authored -- theme default)', () => {
    expect(resolveFontFileBytes(undefined)).toBeNull();
    expect(resolveFontFileBytes(null)).toBeNull();
  });

  it('returns the bytes + leaf resource for a FontFile that carries its own bytes', () => {
    const bytes = new ArrayBuffer(4);
    const leaf = fontFile(bytes);
    const result = resolveFontFileBytes(leaf);
    expect(result).not.toBeNull();
    expect(result!.bytes).toBe(bytes);
    expect(result!.leaf).toBe(leaf);
  });

  it('returns null for a SystemFont -- no bytes this previewer can load', () => {
    const font: FontResource = { kind: 'system', fontNames: ['sans-serif'], properties: {} };
    expect(resolveFontFileBytes(font)).toBeNull();
  });

  it('unwraps a FontVariation to its baseFont', () => {
    const bytes = new ArrayBuffer(4);
    const leaf = fontFile(bytes);
    const variation: FontResource = { kind: 'variation', baseFont: leaf, properties: {} };
    const result = resolveFontFileBytes(variation);
    expect(result!.bytes).toBe(bytes);
    expect(result!.leaf).toBe(leaf);
  });

  it('returns null for a FontVariation with no baseFont (the theme default, recursively no different from authoring nothing)', () => {
    const variation: FontResource = { kind: 'variation', baseFont: null, properties: {} };
    expect(resolveFontFileBytes(variation)).toBeNull();
  });

  it('a bytes-less FontFile (a .tres wrapper) falls through to its first fallback that resolves to bytes', () => {
    const bytes = new ArrayBuffer(4);
    const realFace = fontFile(bytes);
    const wrapper = fontFile(undefined, [realFace]);
    const result = resolveFontFileBytes(wrapper);
    expect(result!.bytes).toBe(bytes);
    expect(result!.leaf).toBe(realFace);
  });

  it('skips a fallback with no bytes (e.g. a SystemFont) and uses the next one that has them', () => {
    const bytes = new ArrayBuffer(4);
    const realFace = fontFile(bytes);
    const systemFallback: FontResource = { kind: 'system', fontNames: ['monospace'], properties: {} };
    const wrapper = fontFile(undefined, [systemFallback, realFace]);
    const result = resolveFontFileBytes(wrapper);
    expect(result!.bytes).toBe(bytes);
    expect(result!.leaf).toBe(realFace);
  });

  it('returns null when a bytes-less FontFile has no fallback that resolves to bytes', () => {
    const wrapper = fontFile(undefined, []);
    expect(resolveFontFileBytes(wrapper)).toBeNull();
  });

  it('recurses through a chain of variation -> bytes-less file -> fallback file', () => {
    const bytes = new ArrayBuffer(4);
    const realFace = fontFile(bytes);
    const wrapper = fontFile(undefined, [realFace]);
    const variation: FontResource = { kind: 'variation', baseFont: wrapper, properties: {} };
    const result = resolveFontFileBytes(variation);
    expect(result!.bytes).toBe(bytes);
    expect(result!.leaf).toBe(realFace);
  });
});
