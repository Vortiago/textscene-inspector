import { describe, expect, it, vi } from 'vitest';
import type { FontFileResource } from '../../fonts/font/types';
import { FONT_PATH, openTypeFontFile, textMeshWith, trueTypeFontFile } from './textMeshFont.testkit';
import { textMeshFont, textMeshFontFiles, textMeshFontKey } from './textMeshFont';

const loaded = (font: FontFileResource = trueTypeFontFile()) => ({ [FONT_PATH]: font });

describe('textMeshFont', () => {
  it('is unreadable for a TextMesh with no font', () => {
    const mesh = { ...textMeshWith({}, loaded()), resource: { id: 't', type: 'TextMesh', data: {} } };

    expect(textMeshFont(mesh)).toEqual({ status: 'unreadable' });
  });

  it('is unreadable while its font file is not loaded', () => {
    expect(textMeshFont(textMeshWith())).toEqual({ status: 'unreadable' });
  });

  it('is unreadable for a font file with no outlines', () => {
    const notAnSfnt = { ...trueTypeFontFile(), bytes: new ArrayBuffer(8) };

    expect(textMeshFont(textMeshWith({}, loaded(notAnSfnt)))).toEqual({ status: 'unreadable' });
  });

  it('awaits the metrics of a TrueType font, then is ready with its outlines and metrics', async () => {
    const mesh = textMeshWith({}, loaded());
    expect(textMeshFont(mesh)).toEqual({ status: 'awaitingMetrics' });

    await vi.waitFor(() => expect(textMeshFont(mesh).status).toBe('ready'));

    const font = textMeshFont(mesh);
    if (font.status !== 'ready') throw new Error('expected a ready font');
    expect(font.face.outlines.glyphIndex(0x48)).toBeGreaterThan(0);
  });

  it('is ready with the outlines of an OpenType-CFF font', async () => {
    const mesh = textMeshWith({}, loaded(openTypeFontFile()));

    await vi.waitFor(() => expect(textMeshFont(mesh).status).toBe('ready'));

    const font = textMeshFont(mesh);
    if (font.status !== 'ready') throw new Error('expected a ready font');
    expect(font.face.outlines.glyphIndex(0x48)).toBeGreaterThan(0);
  });

  it('keeps a ready font for the same mesh object', async () => {
    const mesh = textMeshWith({}, loaded());
    await vi.waitFor(() => expect(textMeshFont(mesh).status).toBe('ready'));

    expect(textMeshFont(mesh)).toBe(textMeshFont(mesh));
  });
});

describe('textMeshFontKey', () => {
  it('tells a font that awaits its metrics from one that is ready', async () => {
    const mesh = textMeshWith({}, loaded());
    const awaiting = textMeshFontKey(textMeshFont(mesh));
    await vi.waitFor(() => expect(textMeshFont(mesh).status).toBe('ready'));

    expect(textMeshFontKey(textMeshFont(mesh))).not.toBe(awaiting);
  });

  it('holds for one font file and moves for a reload of equal bytes', async () => {
    const file = trueTypeFontFile();
    const first = textMeshWith({}, loaded(file));
    const second = textMeshWith({ text: '"Other"' }, loaded(file));
    const reloaded = textMeshWith({}, loaded(trueTypeFontFile()));
    await vi.waitFor(() => {
      for (const mesh of [first, second, reloaded]) expect(textMeshFont(mesh).status).toBe('ready');
    });

    expect(textMeshFontKey(textMeshFont(first))).toBe(textMeshFontKey(textMeshFont(second)));
    expect(textMeshFontKey(textMeshFont(reloaded))).not.toBe(textMeshFontKey(textMeshFont(first)));
  });

  it('names the status of a font that is not ready', () => {
    expect(textMeshFontKey({ status: 'unreadable' })).toBe('unreadable');
  });
});

describe('textMeshFontFiles', () => {
  it('names the font file of an ExtResource, loaded or not', () => {
    const mesh = textMeshWith();

    expect(textMeshFontFiles(mesh, () => undefined)).toEqual([FONT_PATH]);
    expect(textMeshFontFiles(mesh, () => trueTypeFontFile())).toEqual([FONT_PATH]);
  });

  it('names no file for a TextMesh with no font', () => {
    const mesh = { ...textMeshWith(), resource: { id: 't', type: 'TextMesh', data: {} } };

    expect(textMeshFontFiles(mesh, () => undefined)).toEqual([]);
  });
});
