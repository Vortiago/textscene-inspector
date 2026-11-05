import { describe, expect, it, vi } from 'vitest';
import { fixtureFontBytes, systemFont } from '../../../r3f/controls/native/text/sfntOutlines.testkit';
import { peekSceneFontOutlines } from '../../../r3f/controls/native/text/sceneFontOutlines';
import { NO_PROJECT_FONTS, type ProjectFonts } from '../../fonts/font/projectFonts';
import type { FontFileResource, FontResource } from '../../fonts/font/types';
import type { ThemeResource } from '../../styles/theme/types';
import {
  FONT_PATH,
  openTypeFontFile,
  textMeshWith,
  trueTypeFontFile,
  woff2FontFile,
  woffFontFile,
} from './textMeshFont.testkit';
import { textMeshFont, textMeshFontFiles, textMeshFontKey } from './textMeshFont';
import { bitmapFontFile } from '../../../r3f/controls/native/text/bitmapFontMetrics.testkit';
import { buildTextMeshSurface } from './build';
import { decodeTextMesh } from './decode';
import { settledPeek } from '../../../r3f/testing/settleFontWork';

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

/** The ready chain of `mesh`, once its outlines and metrics have settled. */
async function readyChain(mesh: ReturnType<typeof textMeshWith>) {
  const font = await settledPeek(() => textMeshFont(mesh));
  if (font.status !== 'ready') throw new Error('expected a ready font');
  return font.chain;
}

/** The first face of the ready chain of `mesh`. */
async function readyFace(mesh: ReturnType<typeof textMeshWith>) {
  return (await readyChain(mesh))[0];
}

/** The outlines a font settles to, which tells the font a chain chose. */
async function outlinesOf(font: FontResource) {
  return settledPeek(() => peekSceneFontOutlines(font));
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

    expect(await settledPeek(() => textMeshFont(mesh))).toEqual({ status: 'unreadable' });
  });

  it('draws the bundled Open Sans for a SystemFont, as Godot does when no OS font matches its names', async () => {
    const face = await readyFace(textMeshWith({}, { [FONT_PATH]: systemFont() }));

    expect(face.outlines.glyphIndex(0x48)).toBe(43);
  });

  it('awaits the font file of a TrueType font, then is ready with its outlines and metrics', async () => {
    const mesh = textMeshWith({}, loaded());
    expect(textMeshFont(mesh)).toEqual({ status: 'awaitingFont' });

    const font = await settledPeek(() => textMeshFont(mesh));
    if (font.status !== 'ready') throw new Error('expected a ready font');
    expect(font.chain[0].outlines.glyphIndex(0x48)).toBeGreaterThan(0);
  });

  it('is ready with the outlines of an OpenType-CFF font', async () => {
    const mesh = textMeshWith({}, loaded(openTypeFontFile()));

    const font = await settledPeek(() => textMeshFont(mesh));
    if (font.status !== 'ready') throw new Error('expected a ready font');
    expect(font.chain[0].outlines.glyphIndex(0x48)).toBeGreaterThan(0);
  });

  it.each([
    ['a WOFF', woffFontFile],
    ['a WOFF2', woff2FontFile],
  ])('is ready with the outlines of %s once they decompress', async (_container, containerFile) => {
    const mesh = textMeshWith({}, loaded(containerFile()));
    expect(textMeshFont(mesh)).toEqual({ status: 'awaitingFont' });

    const font = await settledPeek(() => textMeshFont(mesh));
    if (font.status !== 'ready') throw new Error('expected a ready font');
    expect(font.chain[0].outlines.glyphIndex(0x48)).toBeGreaterThan(0);
  });

  it('keeps a ready font for the same mesh object', async () => {
    const mesh = textMeshWith({}, loaded());
    await settledPeek(() => textMeshFont(mesh));

    expect(textMeshFont(mesh)).toBe(textMeshFont(mesh));
  });
});

describe('textMeshFont on a font with fallbacks', () => {
  const withFallback = (): FontFileResource => ({
    ...trueTypeFontFile(),
    fallbacks: [{ ...trueTypeFontFile(), bytes: fixtureFontBytes('dejavu-sans-bidi-subset.ttf') }],
  });

  it('carries the outlines of each fallback face', async () => {
    const [, fallback] = await readyChain(textMeshWith({}, loaded(withFallback())));

    const hebrewAlef = 0x5d0;
    expect(fallback?.outlines.glyphIndex(hebrewAlef)).toBeGreaterThan(0);
  });

  it('drops a fallback whose outlines it cannot read', async () => {
    const font = withFallback();
    font.fallbacks = [{ ...trueTypeFontFile(), bytes: new ArrayBuffer(8) }];

    const chain = await readyChain(textMeshWith({}, loaded(font)));

    expect(chain).toHaveLength(1);
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
    const variation: FontResource = { kind: 'variation', baseFont: null, fallbacks: [], properties: {} };
    const projectFonts = { ...NO_PROJECT_FONTS, projectDefaultFont: projectFont };
    const mesh = textMeshWith({}, { [FONT_PATH]: variation }, projectFonts);

    expect((await readyFace(mesh)).outlines).toBe(await outlinesOf(projectFont));
  });

  it('draws a SystemFont as the project default font', async () => {
    const projectFonts = { ...NO_PROJECT_FONTS, projectDefaultFont: projectFont };
    const mesh = textMeshWith({}, { [FONT_PATH]: systemFont() }, projectFonts);

    expect((await readyFace(mesh)).outlines).toBe(await outlinesOf(projectFont));
  });

  it("draws a SystemFont as the project theme's SystemFont font, not its TextMesh font", async () => {
    const projectFonts = {
      projectTheme: themeWith({ fonts: { SystemFont: { font: themeFont }, TextMesh: { font: ownFont } } }),
      projectDefaultFont: projectFont,
    };
    const mesh = textMeshWith({}, { [FONT_PATH]: systemFont() }, projectFonts);

    expect((await readyFace(mesh)).outlines).toBe(await outlinesOf(themeFont));
  });
});

describe('textMeshFontKey', () => {
  it('tells a font that awaits its outlines and metrics from one that is ready', async () => {
    const mesh = textMeshWith({}, loaded());
    const awaiting = textMeshFontKey(textMeshFont(mesh));
    await settledPeek(() => textMeshFont(mesh));

    expect(textMeshFontKey(textMeshFont(mesh))).not.toBe(awaiting);
  });

  it('holds for one font file and moves for a reload of equal bytes', async () => {
    const file = trueTypeFontFile();
    const first = textMeshWith({}, loaded(file));
    const second = textMeshWith({ text: '"Other"' }, loaded(file));
    const reloaded = textMeshWith({}, loaded(trueTypeFontFile()));
    await settledPeek(() => [first, second, reloaded].map(textMeshFont));

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

describe('textMeshFont on a BMFont', () => {
  /** The surface a TextMesh of `text` builds over the test BMFont at its fixed size. */
  function bitmapSurface(text: string) {
    const font = textMeshFont(textMeshWith({}, loaded(bitmapFontFile())));
    if (font.status !== 'ready') throw new Error(`expected a ready font, got ${font.status}`);
    return buildTextMeshSurface(decodeTextMesh({ text: `"${text}"`, font_size: '16' }), '', font.chain);
  }

  it('builds no glyph surface: a font with no FreeType face has no contours (`text_server_adv.cpp:3613`)', () => {
    expect(Array.from(bitmapSurface('Hi AV').indices)).toEqual([0, 0, 0]);
  });

  it('builds the hex-code box quad of a character the font lacks, as for any font', () => {
    expect(bitmapSurface('HzH').positions.length / 3).toBe(4);
  });
});

describe('textMeshFont of a face that fails to load', () => {
  // A face whose metrics fail draws the bundled metrics, and its own outlines would not match their advances.
  it('is unreadable, though its outlines read', async () => {
    vi.stubEnv('VITEST', 'false');
    vi.resetModules();
    const logger = await import('../../../logger');
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const fresh = await import('./textMeshFont');
    const { textMeshWith: freshMeshWith, trueTypeFontFile: freshFontFile } =
      await import('./textMeshFont.testkit');
    const mesh = freshMeshWith({}, { [FONT_PATH]: freshFontFile() });

    expect(await settledPeek(() => fresh.textMeshFont(mesh))).toEqual({ status: 'unreadable' });
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
});
