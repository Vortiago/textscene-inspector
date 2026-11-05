/**
 * The font processor on a BMFont: the descriptor and its pages arrive as files, the page decode is
 * faked as `createTextureProcessor.test.ts` fakes the image decode, and a missing page fails the font.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileEventBus } from '../FileEventBus';
import type { ResourceProvider } from '../ResourceProvider';
import { ResourceEventBus } from '../ResourceEventBus';
import { ResourceLoader } from '../ResourceLoader';
import { DependencyGraph } from '../dependencyGraph';
import { createFontProcessor } from './createFontProcessor';
import type { FontFileResource, FontResource } from '../fonts/font/types';
import { decodeImagePixels } from '../formats/image/textureProcessing';
import { binaryDescriptor, TEXT_DESCRIPTOR } from '../formats/bmfont/descriptor.testkit';
import { arrayBufferOf, png } from '../formats/image/testing/imageBytes';

vi.mock('../formats/image/textureProcessing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../formats/image/textureProcessing')>();
  return { ...actual, decodeImagePixels: vi.fn() };
});

const decode = vi.mocked(decodeImagePixels);

const FNT_PATH = 'res://fonts/hero.fnt';
const PAGE_PATH = 'res://fonts/bmfont.png';
const textBytes = (): ArrayBuffer => new TextEncoder().encode(TEXT_DESCRIPTOR).buffer as ArrayBuffer;

function setup(files: Record<string, string | ArrayBuffer>) {
  const provider: ResourceProvider = { loadResource: vi.fn(async (path: string) => files[path] ?? null) };
  const loader = new ResourceLoader(new FileEventBus(provider));
  return { loader, eventBus: loader.eventBus, processor: loader.fonts };
}

describe('createFontProcessor on a BMFont', () => {
  beforeEach(() => {
    decode.mockReset();
    decode.mockResolvedValue({ width: 64, height: 32, data: new Uint8Array(64 * 32 * 4) });
  });

  it('loads a .fnt font with the fill of its page', async () => {
    const page = arrayBufferOf(png(6));
    const { processor, eventBus } = setup({ [FNT_PATH]: textBytes(), [PAGE_PATH]: page });

    const loaded = eventBus.once<FontResource>('font', 'loaded', FNT_PATH, 2000);
    processor.request(FNT_PATH);
    const font = (await loaded) as FontFileResource;

    expect(font.kind).toBe('file');
    expect(font.bytes).toBeUndefined();
    expect(font.bitmap?.fixedSize).toBe(16);
    expect(font.bitmap?.sheet.width).toBe(64);
    expect(decode).toHaveBeenCalledWith(page, 'image/png', expect.anything());
  });

  it('loads a binary .font descriptor', async () => {
    const { processor, eventBus } = setup({
      'res://fonts/hero.font': binaryDescriptor(),
      [PAGE_PATH]: arrayBufferOf(png(6)),
    });

    const loaded = eventBus.once<FontResource>('font', 'loaded', 'res://fonts/hero.font', 2000);
    processor.request('res://fonts/hero.font');

    expect(((await loaded) as FontFileResource).bitmap?.glyphs.size).toBe(5);
  });

  it("takes the fixed-size scale mode from the font's import sidecar", async () => {
    const { processor, eventBus } = setup({
      [FNT_PATH]: textBytes(),
      [PAGE_PATH]: arrayBufferOf(png(6)),
      [`${FNT_PATH}.import`]: '[remap]\n\nimporter="font_data_bmfont"\n\n[params]\n\nscaling_mode=1\n',
    });

    const loaded = eventBus.once<FontResource>('font', 'loaded', FNT_PATH, 2000);
    processor.request(FNT_PATH);

    expect(((await loaded) as FontFileResource).bitmap?.scaleMode).toBe(1);
  });

  it('fails the font when its page file is missing', async () => {
    const { processor, eventBus } = setup({ [FNT_PATH]: textBytes() });

    const failed = eventBus.once<Error>('font', 'failed', FNT_PATH, 2000);
    processor.request(FNT_PATH);

    expect((await failed).message).toContain(PAGE_PATH);
  });

  it('fails the font when its page does not decode', async () => {
    decode.mockRejectedValue(new Error('Failed to decode texture'));
    const { processor, eventBus } = setup({
      [FNT_PATH]: textBytes(),
      [PAGE_PATH]: arrayBufferOf(png(6)),
    });

    const failed = eventBus.once<Error>('font', 'failed', FNT_PATH, 2000);
    processor.request(FNT_PATH);

    expect((await failed).message).toBe('Failed to decode texture');
  });

  it('reloads the font when its page file changes', async () => {
    const files: Record<string, string | ArrayBuffer> = {
      [FNT_PATH]: textBytes(),
      [PAGE_PATH]: arrayBufferOf(png(6)),
    };
    const provider: ResourceProvider = { loadResource: vi.fn(async (path: string) => files[path] ?? null) };
    const dependencies = new DependencyGraph();
    const eventBus = new ResourceEventBus();
    const processor = createFontProcessor(
      eventBus,
      vi.fn(),
      async (path) => files[path]!,
      dependencies,
      new FileEventBus(provider)
    );
    const loaded = eventBus.once<FontResource>('font', 'loaded', FNT_PATH, 2000);
    processor.request(FNT_PATH);
    await loaded;

    expect(dependencies.release(PAGE_PATH)).toEqual([{ busType: 'font', key: FNT_PATH }]);
  });
});
