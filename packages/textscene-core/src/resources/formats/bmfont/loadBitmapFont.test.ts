import { describe, expect, it, vi } from 'vitest';
import { FixedSizeScaleMode } from '../../../godot/text/textServerEnums';
import { binaryDescriptor, TEXT_DESCRIPTOR, textDescriptor } from './descriptor.testkit';
import { loadBitmapFont } from './loadBitmapFont';
import type { PageImage } from './pageFill';

const textBytes = new TextEncoder().encode(TEXT_DESCRIPTOR).buffer as ArrayBuffer;

const PAGE: PageImage = {
  pixels: { width: 64, height: 32, data: new Uint8Array(64 * 32 * 4).fill(200) },
  source: 'RGBA8',
};

describe('loadBitmapFont', () => {
  it('reads each page next to the descriptor and keeps its fill under the index a glyph names', async () => {
    const readPage = vi.fn(async () => PAGE);

    const font = await loadBitmapFont('res://fonts/test.fnt', textBytes, readPage, {});

    expect(readPage).toHaveBeenCalledExactlyOnceWith('res://fonts/bmfont.png');
    expect(font.sheet.rowOffsets[font.glyphs.get(0x48)!.fillIndex]).toBe(0);
    expect(font.sheet.width).toBe(64);
    expect(font.ascent).toBe(16);
  });

  it('reads a binary descriptor as well', async () => {
    const font = await loadBitmapFont('res://fonts/test.font', binaryDescriptor(), async () => PAGE, {});

    expect(font.glyphs.size).toBe(5);
  });

  it('fails the font when a page does not load', async () => {
    const missing = async (): Promise<PageImage> => {
      throw new Error('not found');
    };

    await expect(loadBitmapFont('res://fonts/test.fnt', textBytes, missing, {})).rejects.toThrowError(
      /not found/
    );
  });

  it('fails the font when a page is in a format its layout cannot read', async () => {
    const rgb: PageImage = { ...PAGE, source: 'RGB8' };

    await expect(loadBitmapFont('res://fonts/test.fnt', textBytes, async () => rgb, {})).rejects.toThrowError(
      /Unsupported BMFont texture format in bmfont.png/
    );
  });
});

describe('loadBitmapFont outline set', () => {
  const outlined = new TextEncoder().encode(textDescriptor({ channels: [0, 1, 3, 3], outline: 1 }))
    .buffer as ArrayBuffer;
  const page: PageImage = {
    pixels: { width: 64, height: 32, data: new Uint8Array(64 * 32 * 4).fill(1) },
    source: 'RGBA8',
  };

  it('keeps the outline fills of a page that holds glyph and outline', async () => {
    const font = await loadBitmapFont('res://fonts/test.fnt', outlined, async () => page, {});

    expect(font.outlineSheet.width).toBe(64);
    expect(font.outlineSheet.rowOffsets[0]).toBe(0);
  });

  it('has no outline fills for a page with no outline set', async () => {
    const font = await loadBitmapFont('res://fonts/test.fnt', textBytes, async () => PAGE, {});

    expect(font.outlineSheet.rowOffsets).toHaveLength(0);
  });
});

describe('loadBitmapFont scale mode', () => {
  const scaleModeOf = async (importParams: Record<string, string>) =>
    (await loadBitmapFont('res://fonts/test.fnt', textBytes, async () => PAGE, importParams)).scaleMode;

  it('is the enabled mode for a font with no import sidecar', async () => {
    expect(await scaleModeOf({})).toBe(FixedSizeScaleMode.FIXED_SIZE_SCALE_ENABLED);
  });

  it('is the mode the import sidecar names', async () => {
    expect(await scaleModeOf({ scaling_mode: '1' })).toBe(FixedSizeScaleMode.FIXED_SIZE_SCALE_INTEGER_ONLY);
    expect(await scaleModeOf({ scaling_mode: '0' })).toBe(FixedSizeScaleMode.FIXED_SIZE_SCALE_DISABLE);
  });
});
