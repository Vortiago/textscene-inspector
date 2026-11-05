import { describe, expect, it } from 'vitest';
import { kerningKey, parseDescriptor } from './parseDescriptor';
import { binaryDescriptor, TEXT_DESCRIPTOR } from './descriptor.testkit';

const bytesOf = (text: string): ArrayBuffer => new TextEncoder().encode(text).buffer as ArrayBuffer;

describe('parseDescriptor', () => {
  it('reads the metrics, glyphs and kerning of a text descriptor', () => {
    const font = parseDescriptor(bytesOf(TEXT_DESCRIPTOR));

    expect(font.fixedSize).toBe(16);
    expect(font.ascent).toBe(16);
    expect(font.descent).toBe(4);
    expect(font.glyphs.get(0x48)).toEqual({
      x: 0,
      y: 0,
      width: 8,
      height: 12,
      offsetX: 1,
      offsetY: -12,
      advance: 10,
      fillIndex: 0,
    });
    expect(font.kerning.get(kerningKey(0x41, 0x56))).toBe(-3);
    expect(font.pages).toEqual([
      { id: 0, file: 'bmfont.png', layout: expect.objectContaining({ packed: false }) },
    ]);
  });

  it('reads a binary descriptor to the same glyph table, kerning, ascent and descent', () => {
    const text = parseDescriptor(bytesOf(TEXT_DESCRIPTOR));
    const binary = parseDescriptor(binaryDescriptor());

    expect(binary.fixedSize).toBe(text.fixedSize);
    expect(binary.ascent).toBe(text.ascent);
    expect(binary.descent).toBe(text.descent);
    expect([...binary.glyphs]).toEqual([...text.glyphs]);
    expect([...binary.kerning]).toEqual([...text.kerning]);
    expect(binary.pages.map(({ id, file }) => ({ id, file }))).toEqual(
      text.pages.map(({ id, file }) => ({ id, file }))
    );
  });

  it('gives a negative advance the glyph width plus one', () => {
    const font = parseDescriptor(
      bytesOf(
        'info size=16 unicode=1\ncommon lineHeight=20 base=16\nchar id=65 x=0 y=0 width=7 height=9 xoffset=0 yoffset=0 xadvance=-1 page=0 chnl=15'
      )
    );

    expect(font.glyphs.get(65)?.advance).toBe(8);
  });

  it('reads a fixed size of 0 as 16 and a negative one by its magnitude', () => {
    expect(parseDescriptor(bytesOf('info size=0 unicode=1')).fixedSize).toBe(16);
    expect(parseDescriptor(bytesOf('info size=-24 unicode=1')).fixedSize).toBe(24);
  });

  it('maps a non-Unicode charset character through the OEM table', () => {
    const font = parseDescriptor(
      bytesOf(
        'info size=16 charset="RUSSIAN"\ncommon lineHeight=20 base=16\nchar id=192 x=0 y=0 width=1 height=1 xoffset=0 yoffset=0 xadvance=1 page=0 chnl=15'
      )
    );

    expect(font.glyphs.has(0x0410)).toBe(true);
    expect(font.glyphs.has(192)).toBe(false);
  });

  it('keeps the character of a Unicode descriptor as it is', () => {
    const font = parseDescriptor(
      bytesOf(
        'info size=16 unicode=1\ncommon lineHeight=20 base=16\nchar id=192 x=0 y=0 width=1 height=1 xoffset=0 yoffset=0 xadvance=1 page=0 chnl=15'
      )
    );

    expect(font.glyphs.has(192)).toBe(true);
  });

  it('reads a character with no page as a glyph that draws no ink', () => {
    const font = parseDescriptor(
      bytesOf(
        'info size=16 unicode=1\ncommon lineHeight=20 base=16\nchar id=32 x=0 y=0 width=0 height=0 xoffset=0 yoffset=0 xadvance=5'
      )
    );

    expect(font.glyphs.get(32)?.fillIndex).toBe(-1);
  });

  it('refuses a binary descriptor of another version', () => {
    const bytes = new Uint8Array(binaryDescriptor());
    bytes[3] = 2;

    expect(() => parseDescriptor(bytes.buffer)).toThrowError(/Version 2.*should be 3/);
  });

  it('names the block and the missing bytes of a truncated binary descriptor', () => {
    const whole = new Uint8Array(binaryDescriptor());

    expect(() => parseDescriptor(whole.slice(0, whole.length - 3).buffer)).toThrowError(
      /block \d needs \d+ bytes, but only \d+ remain/
    );
  });
});
