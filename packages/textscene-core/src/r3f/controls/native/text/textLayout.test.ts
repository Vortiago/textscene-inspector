/**
 * `shapeText` — a framework-free port of Godot's Label line-shaping, against
 * the vendored Open Sans SemiBold atlas/metrics. Every expected
 * pixel width below is hand-derived from `openSansMetrics.ts`'s
 * `OPEN_SANS_METRICS.advanceWidths[ch]` (the font's own `hmtx` advance width,
 * design units) put through the target font size — an independent source of
 * truth from the line-breaking algorithm under test, never the algorithm's
 * own arithmetic fed back at itself, and NOT `openSansAtlas.ts`'s own
 * `xadvance` (that table's own doc has the citation for why it is the wrong
 * source for a glyph's advance: it is msdf-bmfont-xml's OWN atlas-bake-
 * resolution-42 glyph table, integer-rounded at THAT resolution).
 *
 * Where a case below writes the scale as the plain `units * 16/2048`, that is
 * shorthand for a value where FreeType's 26.6 quantization
 * (`fontMetrics.ts`'s `getFontGlyphAdvancePx`) happens to land on the same
 * number — true of every EVEN design-unit advance at `unitsPerEm` 2048 and
 * size 16, which is what those cases pick. The two DO diverge in general, and
 * the suite at the bottom of this file pins that divergence against real
 * Godot glyph advances at both sides of the subpixel-positioning size branch.
 *
 * Citations:
 *   scene/gui/label.cpp :: Label::_shape() (~209-225) -- AUTOWRAP_* -> break
 *     flag mapping (BREAK_WORD_BOUND / BREAK_GRAPHEME_BOUND / BREAK_ADAPTIVE),
 *     ORed with `autowrap_flags_trim`.
 *   scene/gui/label.h:45 -- Label's default trim flags,
 *     BREAK_TRIM_START_EDGE_SPACES | BREAK_TRIM_END_EDGE_SPACES, applied even
 *     when a scene sets no trim flags of its own.
 *   servers/text/text_server.cpp :: TextServer::shaped_text_get_line_breaks()
 *     (~1024-1209) -- the scalar-width overflow/backtrack/tail algorithm
 *     ported below (the overload Label actually calls, not the multi-chunk
 *     `_adv` sibling).
 *   modules/text_server_adv/text_server_adv.cpp:1515-1516 -- FreeType's
 *     pixel-quantized ascent/descent, each ceiling-rounded independently
 *     before summing (see `openSansMetrics.ts#getLinePitchPx`).
 *   text_server.cpp:1174-1176 -- BREAK_ADAPTIVE, live only while `wordCount`
 *     is still zero on the current line (no word boundary found yet).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { AutowrapMode, shapeText, shapedTextSizeWidthPx, soloLineLayout } from './textLayout';
import { OPEN_SANS_METRICS } from './openSansMetrics';
import type { FontMetrics } from './fontMetrics';
import type { CanvasFontMetrics } from './runtimeFontMetrics';

/** Every line's rendered text, in order — the shape most tests care about. */
function lineTexts(text: string, boxWidthPx: number, autowrapMode: AutowrapMode, fontSizePx = 16): string[] {
  return shapeText(text, { fontSizePx, boxWidthPx, autowrapMode, lineSpacingPx: 3 }).lines.map((l) => l.text);
}

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
    // If the space's advance were dropped before the break decision, "AAAA B"
    // (46.857+10.667=57.52) would still be well under 90 and the algorithm
    // would keep pulling "BBBB" onto line 1 too eagerly at a narrower width —
    // pinned instead at the exact width (90) where S2 measured the real
    // Godot break, which only holds if the space's advance was counted.
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
      // GREEK CAPITAL LETTER OMEGA (U+03A9) — outside ASCII, Latin-1 Supplement,
      // and the individually-baked punctuation set; a character the vendored
      // font itself could shape but this atlas never bakes. Chosen deliberately:
      // nothing in Godot's own defaults or this repo's scene fixtures needs it,
      // so it stands in for "some future unbaked codepoint" to pin the FALLBACK
      // MECHANISM itself, not a specific known gap — unlike a test that asserts
      // a character Godot's own default theme actually uses draws nothing,
      // baking Omega would make this test wrong BY DESIGN (glyph would stop
      // being null), so don't "fix" it by adding Omega to the charset; pick a
      // different still-unbaked character instead if this ever needs re-proving.
      const layout = shapeText('AΩB', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 3 });
      const [a, omega, b] = layout.lines[0]!.glyphs;
      expect(omega!.glyph).toBeNull();
      expect(omega!.advance).toBeCloseTo(9.484375, 10);
      // 'A's own advance is unaffected, and 'B's pen x sits right after the
      // fallback advance — the fallback is folded into the running sum exactly
      // like every baked glyph's own advance is.
      expect(b!.x).toBeCloseTo(a!.advance + omega!.advance, 10);
    }
  );
});

describe('shapeText — preserveControl / control characters (text_server_adv.cpp:6844-6907, char_utils.h:117-118 is_control)', () => {
  // U+0001 START OF HEADING -- unambiguously `is_control` (<=0x001F), and not
  // tab/linebreak, so it takes neither of those two's OWN special-casing.
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
  // OpenSans_SemiBold carries only mark/mkmk GPOS features -- zero ASCII kern
  // pairs -- but the table must still be wired in generically (per the
  // vendoring notes) so a future bold/italic synthesis or a different theme
  // font, which DOES have pairs, does not need a shape change downstream.
  // Injecting a synthetic pair into the real (mutable, exported) metrics
  // object is how that plumbing is exercised without inventing a second,
  // parallel metrics format just for this test.
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
    // 'A' hmtx advance width 1354 design units, unitsPerEm 2048. First char at
    // 16px, second at 18px — two DIFFERENT scales of the same glyph, an
    // independent worked example from `glyphAdvancePx`'s own arithmetic.
    //
    // At 16 the fixed-point chain (`getFontGlyphAdvancePx`) lands exactly on
    // the continuous scale, 1354*16/2048 = 10.578125 = 677/64: x_scale is
    // 0.5 in 16.16, so the 16.16 advance is a whole multiple of 1024 and the
    // 26.6 round has nothing to round. At 18 it does not — x_scale is 0.5625,
    // the 16.16 advance is 779904, and (779904 + 512) >> 10 = 762 gives
    // 762/64 = 11.90625 against a continuous 1354*18/2048 = 11.900390625.
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
 * `shapedTextSizeWidthPx` vs Godot 4.6.3
 * (`modules/text_server_adv/text_server_adv.cpp:7524-7537`). Corroborated
 * against the running engine: `ThemeDB.fallback_font.get_string_size(text,
 * HORIZONTAL_ALIGNMENT_LEFT, -1, 16)` at font size 16 returns a WHOLE number
 * for every string, while summing the same font's `get_char_size(c, 16).x`
 * over the same characters does not —
 *
 *   "Master volume"  char-advance sum 115.875    get_string_size 116
 *   "Music bed"      char-advance sum  78.453125 get_string_size  79
 *   "Threat level"   char-advance sum  91.03125  get_string_size  92
 *   "Ma"             char-advance sum  24.03125  get_string_size  25
 *   "M"              char-advance sum  14.75     get_string_size  15
 *
 * — i.e. the engine ceils, and does so even for a 0.03 px overhang.
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
 * Per-glyph advances against real Godot 4.6.3, read out of the running engine
 * rather than derived from this repo's own arithmetic: a scratch project
 * shapes the same string through `TextServer.shaped_text_add_string` +
 * `shaped_text_get_glyphs` at the same font size, against the SAME vendored
 * Open Sans SemiBold (`ThemeDB.fallback_font`), and prints each glyph's
 * `advance`. Both strings below are real `Label.text` values from this repo's
 * composition fixture, and each pins one side of the size branch at
 * `text_server_adv.cpp:6936`:
 *
 * - size 16 (`subpos` TRUE — `SUBPIXEL_POSITIONING_AUTO`, `fs <=
 *   SUBPIXEL_POSITIONING_ONE_HALF_MAX_SIZE`): every advance is a whole
 *   number of 1/64 px, FreeType's 26.6 fixed point, and NOT a continuous
 *   `hmtx` scale — `l` measures 4.46875 (286/64) where a raw scale of its
 *   571 design units gives 4.4609375.
 * - size 28 (`subpos` FALSE): every advance is a WHOLE pixel
 *   (`text_server_adv.cpp:7080`'s `Math::round`), with the rounding
 *   remainder carried into the next glyph — which is why the two `E`s of
 *   "FIELD OPERATIONS" measure 16 and 15 despite being the same glyph at
 *   the same size.
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

// --- Label's paragraph pre-split -------------------------------------------
// `Label::_shape` does NOT hand the whole string to the line breaker. It splits
// on `paragraph_separator` first — `txt.split(ps)` keeps empty entries — and
// gives each paragraph its own shaped text, terminated with a ZERO WIDTH SPACE
// (`label.cpp:158-166`, `para.text = str + String::chr(0x200B)`). That
// terminator is what makes an empty paragraph a LINE: the break loop's guard
// (`text_server.cpp:948`) drops a range whose start equals its end, so a
// paragraph with no glyph at all would vanish, while one holding a single ZWSP
// survives at zero width.
//
// Scoped to Label deliberately. Label3D shapes the whole string in one pass
// (`label_3d.cpp:485,530`), and `TextParagraph` — Button's and LineEdit's path
// — neither splits nor appends a terminator, so their blank lines really do
// collapse in Godot.
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
    // `split` yields ["a", ""] — the second entry is still a paragraph.
    expect(para('a\n').lines).toHaveLength(2);
  });

  // The tail push ends at `range.y` — the end of the SHAPED text, terminator
  // included, with no end-trim (`text_server.cpp:1185-1200`). So the last line
  // of every paragraph really does carry the ZWSP in Godot too. It advances
  // nothing and has no atlas bitmap, so it costs no width and paints nothing.
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
    // "AAAA   " (4 A's + 3 spaces) = 46.46875+12.46875 = 54.78125; the only
    // overflow is adding the 4th 'B' (96.96875 > 90), whose recorded safe
    // break is the THIRD space (word-bound updates it at every space passed)
    // -- with no END trim the emitted line keeps all three rather than
    // walking back off them.
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
 * `BREAK_TRIM_INDENT` (`servers/text/text_server.cpp:1048-1062,1090-1102,1169`).
 *
 * "Subtract first line indentation width from all lines after the first one"
 * (`doc/classes/TextServer.xml`, the constant's own description): the leading
 * run of tabs and spaces is measured once, capped at `0.6 * width`, and every
 * row that starts past that run breaks at `width - indent` instead. The same
 * `indent_end` also blocks a soft break INSIDE the indent (`:1169`).
 *
 * `TextEdit` is the only caller: `Text::_shape_line` sets the flag whenever
 * `indent_wrapped_lines` is on (`text_edit.cpp:285-287`).
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
    // Row 0 holds the indent and one word, and no more.
    expect(widthOf(`${INDENT}alpha`)).toBeLessThanOrEqual(WIDTH);
    expect(widthOf(`${INDENT}alpha bravo`)).toBeGreaterThan(WIDTH);
    // The two remaining words fit the FULL width but not the narrowed one.
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
    // An indent WIDER than 60% of the box: uncapped it would leave a
    // negative-to-nothing width and break every word apart.
    const narrow = Math.ceil(widthOf(INDENT) / 0.8);
    expect(widthOf(INDENT)).toBeGreaterThan(0.6 * narrow);
    const rows = rowsAt(narrow, true);
    expect(rows).toContain('bravo');
    expect(rows).toContain('charlie');
  });
});
