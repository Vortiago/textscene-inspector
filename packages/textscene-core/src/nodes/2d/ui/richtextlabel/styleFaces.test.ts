/**
 * The faces of a RichTextLabel against `scene/theme/default_theme.cpp:1195-1197,1366-1403` and
 * `RichTextLabel::_find_font` (`scene/gui/rich_text_label.cpp:3226-3296`). Under vitest a settled
 * scene font reads as the bundled one, so the tests read the embolden and skew a face carries.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { controlNode, solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { OPEN_SANS_FONT_METRICS } from '../../../../r3f/controls/native/text/openSansFontMetrics';
import type { FontResource } from '../../../../resources/fonts/font/types';
import type { ThemeResource } from '../../../../resources/styles/theme/types';
import * as logger from '../../../../logger';
import { faceOfStyle, resolveRichTextFaces } from './styleFaces';

/** `default_theme.cpp:1399`/`:1403`: the second number of the italics `Transform2D`. */
const ITALIC_SKEW = 0.2;

function richTextNode(overrides: Partial<SolveNode> = {}): SolveNode {
  return {
    ...solveNode(),
    path: 'Root/RTL',
    node: controlNode('RTL', 'RichTextLabel', { name: 'RTL' }),
    ...overrides,
  };
}

function variation(embolden: string): FontResource {
  return { kind: 'variation', baseFont: null, properties: { variation_embolden: embolden } };
}

function themeWith(
  fonts: Record<string, FontResource>,
  defaultFont: FontResource | null = null
): ThemeResource {
  return {
    defaultFont,
    defaultFontSize: undefined,
    fonts: { RichTextLabel: fonts },
    fontSizes: {},
    typeVariations: {},
    properties: {},
  };
}

const ALL_STYLES = [
  { bold: false, italic: false },
  { bold: true, italic: false },
  { bold: false, italic: true },
  { bold: true, italic: true },
];

/** The faces of `n` for text that uses every style. */
function facesOf(n: SolveNode) {
  return resolveRichTextFaces(n, ALL_STYLES);
}

/** The embolden and skew a face carries: 0 for none. */
function variationOf(face: { embolden?: number; skew?: number }) {
  return { embolden: face.embolden ?? 0, skew: face.skew ?? 0 };
}

describe('resolveRichTextFaces', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("builds the default theme's styles over the default font: bold embolden 1.2, italics skew 0.2, both for bold italics (default_theme.cpp:1393-1403)", () => {
    const faces = facesOf(richTextNode());
    expect(faces.normal).toBe(OPEN_SANS_FONT_METRICS);
    expect(variationOf(faces.bold)).toEqual({ embolden: 1.2, skew: 0 });
    expect(variationOf(faces.italic)).toEqual({ embolden: 0, skew: ITALIC_SKEW });
    expect(variationOf(faces.boldItalic)).toEqual({ embolden: 1.2, skew: ITALIC_SKEW });
  });

  it("bases the styles on the project's default font, not the bundled one", () => {
    const projectFont: FontResource = { kind: 'system', fontNames: ['sans-serif'], properties: {} };
    facesOf(richTextNode({ projectDefaultFont: projectFont }));
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockClear();
    facesOf(richTextNode());
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("reads each style from its own key: a node's bold_font, italics_font and bold_italics_font", () => {
    const faces = facesOf(
      richTextNode({
        fontOverrides: {
          bold_font: variation('2'),
          italics_font: variation('3'),
          bold_italics_font: variation('4'),
        },
      })
    );
    expect([faces.bold, faces.italic, faces.boldItalic].map((face) => face.embolden)).toEqual([2, 3, 4]);
  });

  it('lets a style key set in an ancestor theme or the project theme replace only that style', () => {
    const ancestor = facesOf(richTextNode({ themeChain: [themeWith({ bold_font: variation('2') })] }));
    expect(variationOf(ancestor.bold).embolden).toBe(2);
    expect(variationOf(ancestor.italic)).toEqual({ embolden: 0, skew: ITALIC_SKEW });
    const project = facesOf(richTextNode({ projectTheme: themeWith({ bold_font: variation('4') }) }));
    expect(variationOf(project.bold).embolden).toBe(4);
  });

  it("gives every style a theme's default_font when that theme sets no style font (theme.cpp:550)", () => {
    const faces = facesOf(richTextNode({ themeChain: [themeWith({}, variation('0.5'))] }));
    expect(variationOf(faces.bold)).toEqual({ embolden: 0.5, skew: 0 });
    expect(variationOf(faces.italic)).toEqual({ embolden: 0.5, skew: 0 });
    expect(variationOf(faces.boldItalic)).toEqual({ embolden: 0.5, skew: 0 });
  });

  it('answers the same face objects on every call, so a memo keyed on them keeps its hits', () => {
    const first = facesOf(richTextNode());
    const second = facesOf(richTextNode());
    expect([second.normal, second.bold, second.italic, second.boldItalic]).toEqual([
      first.normal,
      first.bold,
      first.italic,
      first.boldItalic,
    ]);
    expect(second.bold).toBe(first.bold);
  });

  it("lets a style's own embolden win over the project font's, as the outermost FontVariation does (font.cpp:3128-3131)", () => {
    const projectFont: FontResource = {
      kind: 'variation',
      baseFont: null,
      properties: { variation_embolden: '0.5' },
    };
    const faces = facesOf(richTextNode({ projectDefaultFont: projectFont }));
    expect(variationOf(faces.normal)).toEqual({ embolden: 0.5, skew: 0 });
    expect(variationOf(faces.bold)).toEqual({ embolden: 1.2, skew: 0 });
    expect(variationOf(faces.italic)).toEqual({ embolden: 0, skew: ITALIC_SKEW });
  });
});

describe('resolveRichTextFaces — only the styles a run uses', () => {
  it('leaves a style no run uses at the normal face, and never resolves its font', () => {
    const unusedFont: FontResource = { kind: 'system', fontNames: ['sans-serif'], properties: {} };
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    try {
      const faces = resolveRichTextFaces(richTextNode({ fontOverrides: { italics_font: unusedFont } }), [
        { bold: true, italic: false },
      ]);
      expect(variationOf(faces.bold).embolden).toBe(1.2);
      expect([faces.italic, faces.boldItalic]).toEqual([faces.normal, faces.normal]);
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('faceOfStyle', () => {
  const faces = facesOf(richTextNode());

  it('picks the face of the bold and italic flags of a run', () => {
    expect(faceOfStyle(faces, { bold: false, italic: false })).toBe(faces.normal);
    expect(faceOfStyle(faces, { bold: true, italic: false })).toBe(faces.bold);
    expect(faceOfStyle(faces, { bold: false, italic: true })).toBe(faces.italic);
    expect(faceOfStyle(faces, { bold: true, italic: true })).toBe(faces.boldItalic);
  });
});
