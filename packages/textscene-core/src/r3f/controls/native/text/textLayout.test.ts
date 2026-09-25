/**
 * Each expected width is hand-derived from the `hmtx` advance in `OPEN_SANS_METRICS.advanceWidths`,
 * not from the algorithm under test, and not from atlas `xadvance`, which is fixed at the 42 px bake
 * size. A plain `units * 16/2048` is used only for even advances, where 26.6 quantisation lands on
 * the same number. The last suite pins where the two diverge against real Godot advances.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { AutowrapMode, shapeText, shapedTextSizeWidthPx, soloLineLayout } from './textLayout';
import { OPEN_SANS_METRICS } from './openSansMetrics';
import type { FontMetrics } from './fontMetrics';
import type { CanvasFontMetrics } from './runtimeFontMetrics';

/** Every line's rendered text, in order. */
function lineTexts(text: string, boxWidthPx: number, autowrapMode: AutowrapMode, fontSizePx = 16): string[] {
  return shapeText(text, { fontSizePx, boxWidthPx, autowrapMode, lineSpacingPx: 3 }).lines.map((l) => l.text);
}

// Break flags per autowrap mode come from `Label::_shape()` (scene/gui/label.cpp, ~209-225), ORed
// with the default trims (scene/gui/label.h:45). The break algorithm is the scalar-width
// `shaped_text_get_line_breaks()` (servers/text/text_server.cpp, ~1024-1209).
describe('shapeText — autowrap OFF', () => {
  it('never soft-wraps, however narrow the box', () => {
    expect(lineTexts('AAAA BBBB CCCC', 5, AutowrapMode.OFF)).toEqual(['AAAA BBBB CCCC']);
  });

  it('still breaks on an explicit newline (Label always paragraph-splits on it)', () => {
    expect(lineTexts('AAAA\nBBBB', 0, AutowrapMode.OFF)).toEqual(['AAAA', 'BBBB']);
  });
});

describe('shapeText — autowrap ARBITRARY (BREAK_GRAPHEME_BOUND)', () => {
  it('wraps at any glyph boundary, irrespective of word count', () => {
    // 'A' hmtx advance width 1354 design units, unitsPerEm 2048 -> 1354*16/2048
    // = 10.578125 px/glyph at size 16. width 50 fits 4 (42.3125px) but not 5
    // (52.890625px) -> 4,4,2.
    expect(lineTexts('AAAAAAAAAA', 50, AutowrapMode.ARBITRARY)).toEqual(['AAAA', 'AAAA', 'AA']);
  });
});

describe('shapeText — autowrap WORD (BREAK_WORD_BOUND, no BREAK_ADAPTIVE)', () => {
  it('breaks only at spaces — an over-wide word overflows instead of splitting', () => {
    // No BREAK_ADAPTIVE fallback: since 'internationalization' never contains a
    // space, no safe break exists inside it, so it rides past the 60px box
    // whole rather than breaking mid-word (that is WORD_SMART's job, below).
    expect(lineTexts('short internationalization word', 60, AutowrapMode.WORD)).toEqual([
      'short',
      'internationalization',
      'word',
    ]);
  });
});

// BREAK_ADAPTIVE is live only while `wordCount` is zero on the line (text_server.cpp:1174-1176).
describe('shapeText — autowrap WORD_SMART (BREAK_WORD_BOUND | BREAK_ADAPTIVE | BREAK_MANDATORY)', () => {
  it('breaks at the word boundary that keeps every line under the box width', () => {
    // AAAA=42.667, ' '=4.190, BBBB=42.667 -> "AAAA BBBB"=89.52 (<90) but the
    // trailing space of the NEXT word's lookahead pushes over 90 first.
    expect(lineTexts('AAAA BBBB CCCC', 90, AutowrapMode.WORD_SMART)).toEqual(['AAAA', 'BBBB CCCC']);
  });

  it('falls back to BREAK_ADAPTIVE mid-word only while no word has fit yet on the line', () => {
    expect(lineTexts('short internationalization word', 60, AutowrapMode.WORD_SMART)).toEqual([
      'short',
      'interna',
      'tionaliz',
      'ation',
      'word',
    ]);
  });

  it('trims the edge space at a soft break from the emitted line, per Label.h:45 defaults', () => {
    const lines = shapeText('AAAA BBBB CCCC', {
      fontSizePx: 16,
      boxWidthPx: 90,
      autowrapMode: AutowrapMode.WORD_SMART,
      lineSpacingPx: 3,
    }).lines;
    expect(lines[0]!.text.endsWith(' ')).toBe(false);
    expect(lines[0]!.text.startsWith(' ')).toBe(false);
  });

  it("but the trimmed space's advance still counted toward the width that decided the break", () => {
    // Pinned at 90, the width where Godot was measured to break, which holds only if the space's
    // advance counts. Without it, "AAAA B" (57.52) stays under 90 and "BBBB" joins line 1.
    expect(lineTexts('AAAA BBBB CCCC', 90, AutowrapMode.WORD_SMART)).toEqual(['AAAA', 'BBBB CCCC']);
  });
});

describe('shapeText — uppercase transform', () => {
  it('shapes the UPPERCASED string, not the source casing', () => {
    const layout = shapeText('abc', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, uppercase: true, lineSpacingPx: 3 });
    expect(layout.lines[0]!.text).toBe('ABC');
    expect(layout.lines[0]!.glyphs.map((g) => g.char)).toEqual(['A', 'B', 'C']);
  });

  it('leaves the string as-is when uppercase is not requested', () => {
    const layout = shapeText('abc', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 3 });
    expect(layout.lines[0]!.text).toBe('abc');
  });
});

describe('shapeText — glyph pen positions', () => {
  it('places the first glyph at x=0 and advances by exactly its own advance', () => {
    const layout = shapeText('AB', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 3 });
    const [a, b] = layout.lines[0]!.glyphs;
    expect(a!.x).toBe(0);
    expect(b!.x).toBeCloseTo(a!.advance, 10);
    // 'A' hmtx advance width 1354 design units, unitsPerEm 2048 -> 1354*16/2048.
    expect(a!.advance).toBeCloseTo((1354 * 16) / 2048, 10);
  });
});

describe('shapeText — a character outside the baked charset', () => {
  it(
    'still advances the pen by the font\'s own OS/2 xAvgCharWidth fallback (9.484375px at size 16: ' +
      '1214 * 16/2048, an independent literal — openSansMetrics.ts\'s OPEN_SANS_METRICS.averageAdvanceUnits ' +
      'is 1214, unitsPerEm 2048) rather than collapsing to a zero-width gap; the placement still carries ' +
      'no atlas glyph, so it draws no ink, only occupies its own width',
    () => {
      // U+03A9 OMEGA stands in for any unbaked codepoint, to pin the fallback itself. If the charset
      // ever bakes it, pick another unbaked character rather than changing the assertions.
      const layout = shapeText('AΩB', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 3 });
      const [a, omega, b] = layout.lines[0]!.glyphs;
      expect(omega!.glyph).toBeNull();
      expect(omega!.advance).toBeCloseTo(9.484375, 10);
      // The fallback advance joins the running sum like a baked one.
      expect(b!.x).toBeCloseTo(a!.advance + omega!.advance, 10);
    }
  );
});

describe('shapeText — preserveControl / control characters (text_server_adv.cpp:6844-6907, char_utils.h:117-118 is_control)', () => {
  // U+0001 START OF HEADING is `is_control` (<=0x001F) and neither tab nor linebreak.
  const CONTROL = '';

  it('without preserveControl (the default), a control character contributes ZERO width and no ink -- Godot drops it entirely (no Glyph pushed absent preserve_invalid/preserve_control, :6844)', () => {
    const layout = shapeText(`A${CONTROL}B`, { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 3 });
    const [a, control, b] = layout.lines[0]!.glyphs;
    expect(control!.advance).toBe(0);
    expect(control!.glyph).toBeNull();
    expect(control!.controlCodepoint).toBeUndefined();
    expect(b!.x).toBeCloseTo(a!.advance, 10);
  });

  it('with preserveControl, a control character advances by the hex-code-box width and carries its own codepoint, drawing no atlas ink', () => {
    const layout = shapeText(`A${CONTROL}B`, {
      fontSizePx: 15,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.OFF,
      lineSpacingPx: 3,
      preserveControl: true,
    });
    const [a, control, b] = layout.lines[0]!.glyphs;
    // hexCodeBoxAdvanceSize(15, 1).x = (4+3*1+0+1)*1 = 8 (hexCodeBox.test.ts's own worked example).
    expect(control!.advance).toBe(8);
    expect(control!.glyph).toBeNull();
    expect(control!.controlCodepoint).toBe(0x0001);
    expect(b!.x).toBeCloseTo(a!.advance + 8, 10);
  });

  it('preserveControl leaves tab and hard-break characters alone -- both are already handled before is_control is ever consulted', () => {
    const layout = shapeText('A\tB\nC', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.OFF,
      lineSpacingPx: 3,
      preserveControl: true,
    });
    const tab = layout.lines[0]!.glyphs[1]!;
    expect(tab.controlCodepoint).toBeUndefined();
    // The hard break starts a new line and is never emitted as a glyph at all.
    expect(layout.lines).toHaveLength(2);
  });
});

describe('shapeText — kerning plumbing', () => {
  // The vendored font has no kern pairs, so a synthetic pair injected into the exported metrics
  // exercises the kerning path.
  afterEach(() => {
    delete OPEN_SANS_METRICS.kerning.AB;
  });

  it('folds a kerning adjustment for an adjacent pair into the pen advance', () => {
    // -256 design units @ unitsPerEm 2048 -> -256*16/2048 = -2px at size 16.
    OPEN_SANS_METRICS.kerning.AB = -256;
    const layout = shapeText('AB', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 3 });
    const [a, b] = layout.lines[0]!.glyphs;
    const bareAdvance = (1354 * 16) / 2048;
    expect(a!.advance).toBeCloseTo(bareAdvance - 2, 10);
    expect(b!.x).toBeCloseTo(bareAdvance - 2, 10);
  });
});

describe('shapeText — fontSizePxAt (per-character size override)', () => {
  it('advances each character by ITS OWN resolved size, not the flat fontSizePx', () => {
    // 'A' is 1354 units at 2048/em. At 16 px the fixed-point chain lands on 1354*16/2048 = 677/64.
    // At 18 px the 16.16 advance is 779904, and (779904 + 512) >> 10 = 762 gives 762/64 = 11.90625,
    // against a continuous 11.900390625.
    const layout = shapeText('AA', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.OFF,
      fontSizePxAt: (i) => (i === 0 ? 16 : 18),
      lineSpacingPx: 3,
    });
    const [a0, a1] = layout.lines[0]!.glyphs;
    expect(a0!.advance).toBeCloseTo((1354 * 16) / 2048, 10);
    expect(a1!.x).toBeCloseTo((1354 * 16) / 2048, 10);
    expect(a1!.advance).toBe(762 / 64);
  });

  it('is a pure additive option: omitting it reproduces the flat-fontSizePx result exactly', () => {
    const withCallback = shapeText('AB', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.OFF,
      fontSizePxAt: () => 16,
      lineSpacingPx: 3,
    });
    const flat = shapeText('AB', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 3 });
    expect(withCallback).toEqual(flat);
  });

  it('skips kerning across a size boundary (a proxy for a shaped-run boundary — no GPOS pair spans two Items)', () => {
    OPEN_SANS_METRICS.kerning.AB = -256;
    try {
      const layout = shapeText('AB', {
        fontSizePx: 16,
        boxWidthPx: 0,
        autowrapMode: AutowrapMode.OFF,
        fontSizePxAt: (i) => (i === 0 ? 16 : 18),
        lineSpacingPx: 3,
      });
      const [a] = layout.lines[0]!.glyphs;
      // No -2px kerning fold-in, unlike the same-size case in the kerning
      // plumbing suite above.
      expect(a!.advance).toBeCloseTo((1354 * 16) / 2048, 10);
    } finally {
      delete OPEN_SANS_METRICS.kerning.AB;
    }
  });

  it('line-break width accounting still uses each character\'s own (possibly smaller or larger) advance', () => {
    // Two 'A's at 40px each (80px total) overflow a 60px box on their own;
    // shrinking the second character to 8px brings the pair under budget.
    const wideLayout = shapeText('A A', {
      fontSizePx: 40,
      boxWidthPx: 60,
      autowrapMode: AutowrapMode.WORD,
      fontSizePxAt: () => 40,
      lineSpacingPx: 3,
    });
    expect(wideLayout.lines.length).toBeGreaterThan(1);

    const mixedLayout = shapeText('A A', {
      fontSizePx: 40,
      boxWidthPx: 60,
      autowrapMode: AutowrapMode.WORD,
      fontSizePxAt: (i) => (i === 0 ? 40 : 8),
      lineSpacingPx: 3,
    });
    expect(mixedLayout.lines.map((l) => l.text)).toEqual(['A A']);
  });
});

// Ascent and descent are FreeType's pixel-quantised values, each ceiled before summing
// (modules/text_server_adv/text_server_adv.cpp:1515-1516).
describe('shapeText — line pitch', () => {
  it('pins line height at font size 16 to 26px (ceil(ascent)+ceil(descent)+3, not the raw float sum of 24.79)', () => {
    const layout = shapeText('X', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 3 });
    expect(layout.linePitchPx).toBe(26);
  });

  it('reports total height as lines.length * linePitchPx', () => {
    const layout = shapeText('AAAA\nBBBB\nCCCC', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 3 });
    expect(layout.lines).toHaveLength(3);
    expect(layout.heightPx).toBe(3 * 26);
  });
});

describe('shapeText — empty text', () => {
  it('shapes to exactly one empty line', () => {
    const layout = shapeText('', { fontSizePx: 16, boxWidthPx: 100, autowrapMode: AutowrapMode.WORD_SMART, lineSpacingPx: 3 });
    expect(layout.lines).toHaveLength(1);
    expect(layout.lines[0]!.text).toBe('');
    expect(layout.heightPx).toBe(26);
  });
});

describe('shapeText — TextLayoutResult.fontMetrics / baselineOffsetPx (the shaping/painting dispatch seam)', () => {
  it('echoes back the default OPEN_SANS_FONT_METRICS (kind "atlas") and its own ceil(ascent) as baselineOffsetPx when no fontMetrics option is given', () => {
    const layout = shapeText('X', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 3 });
    expect(layout.fontMetrics?.kind).toBe('atlas');
    // ceil(2189 * 16/2048) = 18 -- OPEN_SANS_METRICS.ascent's own value, same
    // arithmetic openSansMetrics.ts's getAscentPx documents.
    expect(layout.baselineOffsetPx).toBe(18);
  });

  it('a font of kind "canvas" shapes through the SAME line-breaking/placement code but every glyph placement carries no atlas bitmap', () => {
    const canvasMetrics: FontMetrics = {
      kind: 'canvas',
      unitsPerEm: 1000,
      ascent: 800,
      descent: 200,
      getGlyphAdvanceUnits: () => 500,
      getKerningAdjustmentUnits: () => 0,
      averageAdvanceUnits: 500,
    };
    const layout = shapeText('AB', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, fontMetrics: canvasMetrics, lineSpacingPx: 3 });
    expect(layout.fontMetrics).toBe(canvasMetrics);
    for (const gp of layout.lines[0]!.glyphs) {
      expect(gp.glyph).toBeNull();
    }
    // Pen advance still comes from the injected metrics, not the atlas's own
    // xadvance: 500 design units @ unitsPerEm 1000, size 16 -> 8px.
    expect(layout.lines[0]!.glyphs[0]!.advance).toBeCloseTo(8, 10);
    // ceil(800 * 16/1000) = 13.
    expect(layout.baselineOffsetPx).toBe(13);
  });
});

describe('soloLineLayout — re-wrapping one line of an already-shaped result', () => {
  const FAKE_SCENE_FONT_METRICS: CanvasFontMetrics = {
    kind: 'canvas',
    cssFontFamily: 'tscn-scene-font-test',
    unitsPerEm: 1000,
    ascent: 800,
    descent: 200,
    getGlyphAdvanceUnits: () => 500,
    getKerningAdjustmentUnits: () => 0,
    averageAdvanceUnits: 500,
  };

  it("echoes the parent's own fontMetrics — TextRun dispatches paint by layout.fontMetrics.kind, so a scene-font line must not fall back to the atlas painter", () => {
    const parent = shapeText('AB', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.OFF,
      fontMetrics: FAKE_SCENE_FONT_METRICS,
      lineSpacingPx: 3,
    });
    const solo = soloLineLayout(parent.lines[0]!, parent);
    expect(solo.fontMetrics).toBe(FAKE_SCENE_FONT_METRICS);
    expect(solo.baselineOffsetPx).toBe(parent.baselineOffsetPx);
    expect(solo.linePitchPx).toBe(parent.linePitchPx);
  });

  it('echoes the atlas metrics when the parent was shaped against them', () => {
    const parent = shapeText('AB', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 3 });
    const solo = soloLineLayout(parent.lines[0]!, parent);
    expect(solo.fontMetrics).toBe(parent.fontMetrics);
    expect(solo.fontMetrics.kind).toBe('atlas');
  });

  it('takes its width from the LINE, not the parent — a multi-line parent reports its widest line', () => {
    const parent = shapeText('WWWW\nI', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 3 });
    const narrow = soloLineLayout(parent.lines[1]!, parent);
    expect(narrow.widthPx).toBe(parent.lines[1]!.widthPx);
    expect(narrow.widthPx).toBeLessThan(parent.widthPx);
    expect(narrow.heightPx).toBe(parent.linePitchPx);
    expect(narrow.lines).toHaveLength(1);
  });

  it('honours an explicit baselineOffsetPx — a RichTextLabel run shaped at its own [b]/[i] size sits at its OWN baseline, not the paragraph ascent', () => {
    const parent = shapeText('AB', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 0 });
    const solo = soloLineLayout(parent.lines[0]!, parent, 99);
    expect(solo.baselineOffsetPx).toBe(99);
    expect(solo.fontMetrics).toBe(parent.fontMetrics);
  });
});

/**
 * `shapedTextSizeWidthPx` against Godot 4.6.3 (`modules/text_server_adv/text_server_adv.cpp:7524-7537`).
 * At size 16, `get_string_size` ceils the `get_char_size` sums, even a 0.03 px overhang:
 * "Master volume" 115.875 to 116, "Music bed" 78.453125 to 79, "Threat level" 91.03125 to 92,
 * "Ma" 24.03125 to 25, "M" 14.75 to 15.
 */
describe('shapedTextSizeWidthPx (text_server_adv.cpp:7524-7537)', () => {
  it('ceils a fractional pen advance to the next whole pixel', () => {
    expect(shapedTextSizeWidthPx(115.875)).toBe(116);
    expect(shapedTextSizeWidthPx(91.03125)).toBe(92);
  });

  it('leaves a whole-pixel advance alone — an integral sum is already the shaped size', () => {
    expect(shapedTextSizeWidthPx(70)).toBe(70);
    expect(shapedTextSizeWidthPx(0)).toBe(0);
  });

  it('ceils TOWARD POSITIVE INFINITY, so a negative width rounds up to zero rather than away from it', () => {
    expect(shapedTextSizeWidthPx(-0.5)).toBe(-0);
    expect(shapedTextSizeWidthPx(-2.25)).toBe(-2);
  });

  it("is the ceil of shapeText's own raw advance sum, for real vendored-atlas text", () => {
    const layout = shapeText('Master volume', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.OFF,
      lineSpacingPx: 3,
    });
    expect(layout.widthPx).toBeCloseTo(115.875, 6);
    expect(shapedTextSizeWidthPx(layout.widthPx)).toBe(116);
  });
});

/**
 * Per-glyph advances read from Godot 4.6.3 (`shaped_text_get_glyphs` on `ThemeDB.fallback_font`),
 * one string per side of the size branch at `text_server_adv.cpp:6936`. At 16 (`subpos` true) each
 * advance is a whole 1/64 px: `l` is 286/64, not 4.4609375. At 28 each is a whole pixel with the
 * remainder carried (`text_server_adv.cpp:7080`), so the two `E`s of "FIELD OPERATIONS" are 16 and 15.
 */
describe('shapeText — glyph advances vs real Godot (text_server_adv.cpp:6936,7077-7084)', () => {
  it('size 16, subpixel positioning ON: each advance is FreeType 26.6-quantized, not a continuous hmtx scale', () => {
    const layout = shapeText('Threat level', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.OFF,
      lineSpacingPx: 3,
    });
    expect(layout.lines[0]!.glyphs.map((g) => g.advance)).toEqual([
      9.046875, 10.171875, 6.90625, 9.21875, 9.28125, 6.328125, 4.15625, 4.46875, 9.21875, 8.546875, 9.21875, 4.46875,
    ]);
    expect(layout.widthPx).toBe(91.03125);
    expect(shapedTextSizeWidthPx(layout.widthPx)).toBe(92);
  });

  it('size 28, subpixel positioning OFF: each advance is a whole pixel, with the rounding remainder carried forward', () => {
    const layout = shapeText('FIELD OPERATIONS', {
      fontSizePx: 28,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.OFF,
      lineSpacingPx: 3,
    });
    expect(layout.lines[0]!.glyphs.map((g) => g.advance)).toEqual([
      15, 8, 16, 15, 21, 7, 22, 18, 15, 18, 19, 15, 9, 22, 22, 15,
    ]);
    expect(layout.widthPx).toBe(257);
    expect(shapedTextSizeWidthPx(layout.widthPx)).toBe(257);
  });
});

// `Label::_shape` splits on `paragraph_separator` first, keeping empty entries, and ends each
// paragraph with a ZERO WIDTH SPACE (`label.cpp:158-166`). The break loop drops an empty range
// (`text_server.cpp:948`), so the terminator keeps an empty paragraph as a line. Label3D
// (`label_3d.cpp:485,530`) and `TextParagraph` do not split, so their blank lines collapse.
describe('shapeText — paragraphSeparator (Label::_shape)', () => {
  const para = (text: string): ReturnType<typeof shapeText> =>
    shapeText(text, {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.OFF,
      lineSpacingPx: 3,
      paragraphSeparator: '\n',
    });

  it('keeps the empty paragraph between two hard breaks as its own line', () => {
    const layout = para('a\n\nb');
    expect(layout.lines).toHaveLength(3);
    expect(layout.lines[1]!.widthPx).toBe(0);
  });

  it('keeps every empty paragraph in a run of them', () => {
    expect(para('x\n\ny\n\nz').lines).toHaveLength(5);
  });

  it('keeps the trailing empty paragraph a final separator produces', () => {
    // `split` yields ["a", ""], and the second entry is still a paragraph.
    expect(para('a\n').lines).toHaveLength(2);
  });

  // The tail push ends at `range.y`, the shaped text's end with no end trim
  // (`text_server.cpp:1185-1200`), so the last line of each paragraph carries the ZWSP, at no width.
  it('carries the terminator on the line without moving any visible metric', () => {
    const opts = { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 3 };
    const split = shapeText('AAAA BBBB', { ...opts, paragraphSeparator: '\n' });
    const unsplit = shapeText('AAAA BBBB', opts);
    expect(split.lines[0]!.text).toBe(`AAAA BBBB${'\u200b'}`);
    expect(split.widthPx).toBe(unsplit.widthPx);
    expect(split.lines[0]!.glyphs.at(-1)!.advance).toBe(0);
    expect(split.lines[0]!.glyphs.at(-1)!.glyph).toBeNull();
  });

  it('is off by default — the callers whose engine counterpart never splits', () => {
    expect(shapeText('a\n\nb', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.OFF,
      lineSpacingPx: 3,
    }).lines).toHaveLength(2);
  });
});

describe('shapeText — tab_stops (ShapeTextOptions.tabStopsPx, label.cpp:196-198,228-230)', () => {
  const opts = { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 3 };

  it("a tab's advance lands on the next stop past the pen — 'A' = 10.578125px, stop 15 -> tab advance 4.421875", () => {
    const layout = shapeText('A\tB', { ...opts, tabStopsPx: [15] });
    expect(layout.lines[0]!.glyphs[1]!.char).toBe('\t');
    expect(layout.lines[0]!.glyphs[1]!.advance).toBeCloseTo(4.421875, 10);
    expect(layout.lines[0]!.glyphs[2]!.x).toBeCloseTo(10.578125 + 4.421875, 10);
  });

  it('restarts the tab-stop cycle at each EMITTED line, not the paragraph (second `shaped_text_tab_align` pass, label.cpp:228-230)', () => {
    const layout = shapeText('A\tB\nA\tB', { ...opts, tabStopsPx: [15] });
    expect(layout.lines).toHaveLength(2);
    // Both lines' tabs land on the SAME stop despite line 2 starting at a
    // large cumulative paragraph offset -- proof the second pass measures
    // from line 2's own pen origin, not the paragraph's.
    expect(layout.lines[0]!.glyphs[1]!.advance).toBeCloseTo(4.421875, 10);
    expect(layout.lines[1]!.glyphs[1]!.advance).toBeCloseTo(4.421875, 10);
  });

  it('no stops is a no-op, matching every caller before this option existed', () => {
    const withoutOption = shapeText('A\tB', opts);
    const withEmptyStops = shapeText('A\tB', { ...opts, tabStopsPx: [] });
    expect(withEmptyStops.lines[0]!.glyphs[1]!.advance).toBe(withoutOption.lines[0]!.glyphs[1]!.advance);
  });
});

describe('shapeText — autowrap_trim_flags (ShapeTextOptions.autowrapTrimFlags, label.h:45, text_server.cpp:1076-1093)', () => {
  it('undefined defaults to BOTH edge trims on, exactly like every caller before this option existed', () => {
    const withOption = shapeText('AAAA   BBBB', {
      fontSizePx: 16, boxWidthPx: 47, autowrapMode: AutowrapMode.WORD, lineSpacingPx: 3, autowrapTrimFlags: 192,
    });
    const withoutOption = shapeText('AAAA   BBBB', {
      fontSizePx: 16, boxWidthPx: 47, autowrapMode: AutowrapMode.WORD, lineSpacingPx: 3,
    });
    expect(withoutOption.lines.map((l) => l.text)).toEqual(withOption.lines.map((l) => l.text));
  });

  it('BREAK_TRIM_END_EDGE_SPACES off (start-only, 64) keeps the trailing spaces the default would drop', () => {
    // "AAAA   " = 54.78125. The 4th 'B' overflows (96.96875 > 90) with the third space as the safe
    // break, and with no end trim the emitted line keeps all three spaces.
    const layout = shapeText('AAAA   BBBB', {
      fontSizePx: 16, boxWidthPx: 90, autowrapMode: AutowrapMode.WORD, lineSpacingPx: 3, autowrapTrimFlags: 64,
    });
    expect(layout.lines[0]!.text).toBe('AAAA   ');
    expect(layout.lines[1]!.text).toBe('BBBB');
  });

  it('BREAK_TRIM_START_EDGE_SPACES off (end-only, 128) keeps a hard-break continuation\'s leading spaces (text_server.cpp:1097-1103, 1101 finalStart)', () => {
    const layout = shapeText('AAAA\n   BBBB', {
      fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 3, autowrapTrimFlags: 128,
    });
    expect(layout.lines[0]!.text).toBe('AAAA');
    expect(layout.lines[1]!.text).toBe('   BBBB');
  });
});

/**
 * `BREAK_TRIM_INDENT` (`servers/text/text_server.cpp:1048-1062,1090-1102,1169`, `doc/classes/TextServer.xml`):
 * the leading tabs and spaces are measured once, capped at `0.6 * width`, and later rows break at
 * `width - indent`. `indent_end` blocks a soft break inside the indent (`:1169`). Only `TextEdit`
 * sets the flag (`text_edit.cpp:285-287`).
 */
describe('shapeText — BREAK_TRIM_INDENT (text_server.cpp:1048-1062,1090-1102)', () => {
  const INDENT = '        ';
  const INDENTED = `${INDENT}alpha bravo charlie`;

  /** The unconstrained shaped width of `text`, to pick a wrap width from. */
  function widthOf(text: string): number {
    return shapeText(text, {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.OFF,
      lineSpacingPx: 0,
    }).widthPx;
  }

  function rowsAt(boxWidthPx: number, trimIndent: boolean): string[] {
    return shapeText(INDENTED, {
      fontSizePx: 16,
      boxWidthPx,
      autowrapMode: AutowrapMode.WORD,
      lineSpacingPx: 0,
      trimIndent,
    }).lines.map((l) => l.text);
  }

  const WIDTH = widthOf('bravo charlie');

  it('is the width that makes the flag observable at all', () => {
    // Row 0 holds the indent and one word.
    expect(widthOf(`${INDENT}alpha`)).toBeLessThanOrEqual(WIDTH);
    expect(widthOf(`${INDENT}alpha bravo`)).toBeGreaterThan(WIDTH);
    // The two remaining words fit the full width but not the narrowed one.
    expect(WIDTH).toBeGreaterThan(WIDTH - widthOf(INDENT));
    expect(widthOf('bravo charlie')).toBeGreaterThan(WIDTH - widthOf(INDENT));
  });

  it('leaves the rows alone with the flag off', () => {
    expect(rowsAt(WIDTH, false)).toEqual([`${INDENT}alpha`, 'bravo charlie']);
  });

  it('narrows every row past the indent by the indent width', () => {
    expect(rowsAt(WIDTH, true)).toEqual([`${INDENT}alpha`, 'bravo', 'charlie']);
  });

  it('never breaks inside the indent itself (text_server.cpp:1169)', () => {
    expect(rowsAt(WIDTH, true)[0]).toBe(`${INDENT}alpha`);
  });

  it('caps the subtraction at 0.6 of the width, so a continuation row keeps 0.4 of it (text_server.cpp:1062)', () => {
    // An indent wider than 60% of the box: uncapped, it would leave no width and break every word apart.
    const narrow = Math.ceil(widthOf(INDENT) / 0.8);
    expect(widthOf(INDENT)).toBeGreaterThan(0.6 * narrow);
    const rows = rowsAt(narrow, true);
    expect(rows).toContain('bravo');
    expect(rows).toContain('charlie');
  });
});
