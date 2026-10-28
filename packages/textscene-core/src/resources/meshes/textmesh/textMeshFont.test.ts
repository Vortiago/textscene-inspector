import { describe, expect, it, vi } from 'vitest';
import { peekSceneFontOutlines } from '../../../r3f/controls/native/text/sceneFontOutlines';
import { NO_PROJECT_FONTS, type ProjectFonts } from '../../fonts/font/projectFonts';
import type { FontFileResource, FontResource } from '../../fonts/font/types';
import type { ThemeResource } from '../../styles/theme/types';
import {
  FONT_PATH,
  openTypeFontFile,
  systemFontResource,
  textMeshWith,
  trueTypeFontFile,
  woff2FontFile,
  woffFontFile,
} from './textMeshFont.testkit';
import { textMeshFont, textMeshFontFiles, textMeshFontKey } from './textMeshFont';

const loaded = (font: FontFileResource = trueTypeFontFile()) => ({ [FONT_PATH]: font });

function themeWith(overrides: Partial<ThemeResource>): ThemeResource {
  return {
    defaultFont: null,
    defaultFontSize: undefined,
    fonts: {},
    fontSizes: {},
    typeVariations: {},
    properties: {},
    ...overrides,
  };
}

const withoutFont = (projectFonts: ProjectFonts = NO_PROJECT_FONTS) => ({
  ...textMeshWith({}, loaded(), projectFonts),
  resource: { id: 't', type: 'TextMesh', data: {} },
});

/** The ready face of `mesh`, once its outlines and metrics have settled. */
async function readyFace(mesh: ReturnType<typeof textMeshWith>) {
  await vi.waitFor(() => expect(textMeshFont(mesh).status).toBe('ready'));
  const font = textMeshFont(mesh);
  if (font.status !== 'ready') throw new Error('expected a ready font');
  return font.face;
}

/** The outlines a font settles to, which tells the font a chain chose. */
async function outlinesOf(font: FontResource) {
  await vi.waitFor(() => expect(peekSceneFontOutlines(font)).not.toBeUndefined());
  return peekSceneFontOutlines(font);
}

describe('textMeshFont', () => {
  it('draws the bundled Open Sans for a TextMesh with no font and no project font', async () => {
    const face = await readyFace(withoutFont());

    expect(face.outlines.glyphIndex(0x48)).toBe(43);
  });

  it('draws the bundled Open Sans while its font file is not loaded or failed to load', async () => {
    const face = await readyFace(textMeshWith());

    expect(face.outlines.glyphIndex(0x48)).toBe(43);
  });

  it('is unreadable, once its bytes are read, for a font file with no outlines', async () => {
    const notAnSfnt = { ...trueTypeFontFile(), bytes: new ArrayBuffer(8) };
    const mesh = textMeshWith({}, loaded(notAnSfnt));

    await vi.waitFor(() => expect(textMeshFont(mesh)).toEqual({ status: 'unreadable' }));
  });

  it('is unreadable for a SystemFont, which has no bytes to read', () => {
    const mesh = textMeshWith({}, { [FONT_PATH]: systemFontResource() });

    expect(textMeshFont(mesh)).toEqual({ status: 'unreadable' });
  });

  it('awaits the font file of a TrueType font, then is ready with its outlines and metrics', async () => {
    const mesh = textMeshWith({}, loaded());
    expect(textMeshFont(mesh)).toEqual({ status: 'awaitingFont' });

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

  it.each([
    ['a WOFF', woffFontFile],
    ['a WOFF2', woff2FontFile],
  ])('is ready with the outlines of %s once they decompress', async (_container, containerFile) => {
    const mesh = textMeshWith({}, loaded(containerFile()));
    expect(textMeshFont(mesh)).toEqual({ status: 'awaitingFont' });

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

describe('the font chain of a TextMesh (`TextMesh::_get_font_or_default`)', () => {
  const projectFont = openTypeFontFile();
  const themeFont = woffFontFile();
  const ownFont = trueTypeFontFile();

  it('draws the font of the TextMesh over every project font', async () => {
    const projectFonts = {
      projectTheme: themeWith({ defaultFont: themeFont }),
      projectDefaultFont: projectFont,
    };
    const mesh = textMeshWith({}, loaded(ownFont), projectFonts);

    expect((await readyFace(mesh)).outlines).toBe(await outlinesOf(ownFont));
  });

  it("draws the project theme's TextMesh font when the TextMesh has none", async () => {
    const projectFonts = {
      projectTheme: themeWith({ fonts: { TextMesh: { font: themeFont } } }),
      projectDefaultFont: projectFont,
    };

    expect((await readyFace(withoutFont(projectFonts))).outlines).toBe(await outlinesOf(themeFont));
  });

  it("draws the project theme's default font before the project default font", async () => {
    const projectFonts = {
      projectTheme: themeWith({ defaultFont: themeFont }),
      projectDefaultFont: projectFont,
    };

    expect((await readyFace(withoutFont(projectFonts))).outlines).toBe(await outlinesOf(themeFont));
  });

  it("draws the project theme's font for a base type of TextMesh, such as PrimitiveMesh", async () => {
    const projectFonts = {
      projectTheme: themeWith({ fonts: { PrimitiveMesh: { font: themeFont } } }),
      projectDefaultFont: projectFont,
    };

    expect((await readyFace(withoutFont(projectFonts))).outlines).toBe(await outlinesOf(themeFont));
  });

  it('draws the project default font when no theme names one', async () => {
    const projectFonts = { projectTheme: themeWith({}), projectDefaultFont: projectFont };

    expect((await readyFace(withoutFont(projectFonts))).outlines).toBe(await outlinesOf(projectFont));
  });

  it('draws the project default font when the TextMesh font is not loaded', async () => {
    const projectFonts = { ...NO_PROJECT_FONTS, projectDefaultFont: projectFont };
    const mesh = textMeshWith({}, {}, projectFonts);

    expect((await readyFace(mesh)).outlines).toBe(await outlinesOf(projectFont));
  });

  it('draws a FontVariation with no base_font over the project default font', async () => {
    const variation = { kind: 'variation', baseFont: null, properties: {} } as const;
    const projectFonts = { ...NO_PROJECT_FONTS, projectDefaultFont: projectFont };
    const mesh = textMeshWith({}, { [FONT_PATH]: variation }, projectFonts);

    expect((await readyFace(mesh)).outlines).toBe(await outlinesOf(projectFont));
  });
});

describe('textMeshFontKey', () => {
  it('tells a font that awaits its outlines and metrics from one that is ready', async () => {
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
