import { describe, expect, it } from 'vitest';
import { OPEN_SANS_ATLAS_GLYPHS, OPEN_SANS_ATLAS_INFO, OPEN_SANS_ATLAS_PNG_DATA_URL } from './openSansAtlas';

/**
 * Reads a PNG's `IHDR` width/height without a decoder library: the 8-byte
 * PNG signature is followed by a 4-byte chunk length + 4-byte `IHDR` tag
 * (offsets 0-15), then the IHDR payload's first two big-endian uint32s are
 * width (offset 16) and height (offset 20). See the PNG spec, "Chunk
 * layout"/"IHDR".
 */
function readPngDimensions(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

describe('OPEN_SANS_ATLAS_PNG_DATA_URL', () => {
  it('is a data: URL carrying a valid PNG sized to the baked atlas', () => {
    expect(OPEN_SANS_ATLAS_PNG_DATA_URL.startsWith('data:image/png;base64,')).toBe(true);
    const base64 = OPEN_SANS_ATLAS_PNG_DATA_URL.slice('data:image/png;base64,'.length);
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    expect(Array.from(bytes.slice(0, 8))).toEqual(PNG_SIGNATURE);

    const { width, height } = readPngDimensions(bytes);
    expect(width).toBe(OPEN_SANS_ATLAS_INFO.scaleW);
    expect(height).toBe(OPEN_SANS_ATLAS_INFO.scaleH);
  });
});

describe('OPEN_SANS_ATLAS_GLYPHS', () => {
  it('covers the full ASCII printable charset, 0x20-0x7E (95 glyphs) — decided, not narrowed', () => {
    const expectedChars: string[] = [];
    for (let cp = 0x20; cp <= 0x7e; cp++) expectedChars.push(String.fromCharCode(cp));
    expect(Object.keys(OPEN_SANS_ATLAS_GLYPHS).sort()).toEqual(expectedChars.sort());
  });

  it('gives every glyph a positive xadvance', () => {
    for (const [ch, glyph] of Object.entries(OPEN_SANS_ATLAS_GLYPHS)) {
      expect(glyph.xadvance, `xadvance for ${JSON.stringify(ch)}`).toBeGreaterThan(0);
    }
  });

  it('places the space glyph at zero visible size but with a nonzero advance', () => {
    // msdf-bmfont-xml emits an empty (0x0) bitmap for whitespace and warns
    // "No bitmap for character ' '" — verified in this packet's bake run —
    // but xadvance still carries its hmtx-derived width.
    expect(OPEN_SANS_ATLAS_GLYPHS[' ']?.width).toBe(0);
    expect(OPEN_SANS_ATLAS_GLYPHS[' ']?.height).toBe(0);
    expect(OPEN_SANS_ATLAS_GLYPHS[' ']?.xadvance).toBeGreaterThan(0);
  });
});

describe('OPEN_SANS_ATLAS_INFO', () => {
  it('records the atlas bake font size and MSDF distance range needed to scale glyph geometry at render time', () => {
    expect(OPEN_SANS_ATLAS_INFO.fontSize).toBe(42);
    expect(OPEN_SANS_ATLAS_INFO.distanceRange).toBe(4);
  });
});
