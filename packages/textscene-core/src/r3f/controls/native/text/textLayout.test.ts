/**
 * `shapeText` — a framework-free port of Godot's Label line-shaping, against
 * the vendored Open Sans SemiBold atlas/metrics (packet P10). Every expected
 * pixel width below is hand-derived from `openSansMetrics.ts`'s
 * `OPEN_SANS_METRICS.advanceWidths[ch]` (the font's own CONTINUOUS `hmtx`
 * advance width, design units) scaled to the target font size
 * (`fontSizePx / OPEN_SANS_METRICS.unitsPerEm`) — an independent source of
 * truth from the line-breaking algorithm under test, never the algorithm's
 * own arithmetic fed back at itself, and NOT `openSansAtlas.ts`'s own
 * `xadvance` (that table's own doc has the citation for why it is the wrong
 * source for a glyph's advance: it is msdf-bmfont-xml's OWN atlas-bake-
 * resolution-42 glyph table, integer-rounded at THAT resolution).
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
import { AutowrapMode, shapeText } from './textLayout';
import { OPEN_SANS_METRICS } from './openSansMetrics';
import type { FontMetrics } from './fontMetrics';

/** Every line's rendered text, in order — the shape most tests care about. */
function lineTexts(text: string, boxWidthPx: number, autowrapMode: AutowrapMode, fontSizePx = 16): string[] {
  return shapeText(text, { fontSizePx, boxWidthPx, autowrapMode }).lines.map((l) => l.text);
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
    const layout = shapeText('abc', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, uppercase: true });
    expect(layout.lines[0]!.text).toBe('ABC');
    expect(layout.lines[0]!.glyphs.map((g) => g.char)).toEqual(['A', 'B', 'C']);
  });

  it('leaves the string as-is when uppercase is not requested', () => {
    const layout = shapeText('abc', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF });
    expect(layout.lines[0]!.text).toBe('abc');
  });
});

describe('shapeText — glyph pen positions', () => {
  it('places the first glyph at x=0 and advances by exactly its own advance', () => {
    const layout = shapeText('AB', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF });
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
      const layout = shapeText('AΩB', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF });
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

describe('shapeText — kerning plumbing', () => {
  // OpenSans_SemiBold carries only mark/mkmk GPOS features -- zero ASCII kern
  // pairs -- but the table must still be wired in generically (per packet P10's
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
    const layout = shapeText('AB', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF });
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
    const layout = shapeText('AA', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.OFF,
      fontSizePxAt: (i) => (i === 0 ? 16 : 18),
    });
    const [a0, a1] = layout.lines[0]!.glyphs;
    expect(a0!.advance).toBeCloseTo((1354 * 16) / 2048, 10);
    expect(a1!.x).toBeCloseTo((1354 * 16) / 2048, 10);
    expect(a1!.advance).toBeCloseTo((1354 * 18) / 2048, 10);
  });

  it('is a pure additive option: omitting it reproduces the flat-fontSizePx result exactly', () => {
    const withCallback = shapeText('AB', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.OFF,
      fontSizePxAt: () => 16,
    });
    const flat = shapeText('AB', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF });
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
    });
    expect(wideLayout.lines.length).toBeGreaterThan(1);

    const mixedLayout = shapeText('A A', {
      fontSizePx: 40,
      boxWidthPx: 60,
      autowrapMode: AutowrapMode.WORD,
      fontSizePxAt: (i) => (i === 0 ? 40 : 8),
    });
    expect(mixedLayout.lines.map((l) => l.text)).toEqual(['A A']);
  });
});

describe('shapeText — line pitch', () => {
  it('pins line height at font size 16 to 26px (ceil(ascent)+ceil(descent)+3, not the raw float sum of 24.79)', () => {
    const layout = shapeText('X', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF });
    expect(layout.linePitchPx).toBe(26);
  });

  it('reports total height as lines.length * linePitchPx', () => {
    const layout = shapeText('AAAA\nBBBB\nCCCC', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF });
    expect(layout.lines).toHaveLength(3);
    expect(layout.heightPx).toBe(3 * 26);
  });
});

describe('shapeText — empty text', () => {
  it('shapes to exactly one empty line', () => {
    const layout = shapeText('', { fontSizePx: 16, boxWidthPx: 100, autowrapMode: AutowrapMode.WORD_SMART });
    expect(layout.lines).toHaveLength(1);
    expect(layout.lines[0]!.text).toBe('');
    expect(layout.heightPx).toBe(26);
  });
});

describe('shapeText — TextLayoutResult.fontMetrics / baselineOffsetPx (the shaping/painting dispatch seam)', () => {
  it('echoes back the default OPEN_SANS_FONT_METRICS (kind "atlas") and its own ceil(ascent) as baselineOffsetPx when no fontMetrics option is given', () => {
    const layout = shapeText('X', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF });
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
    const layout = shapeText('AB', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, fontMetrics: canvasMetrics });
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
