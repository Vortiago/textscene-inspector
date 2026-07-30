/**
 * `labelMinimumSize` vs Godot 4.6.3 (`scene/gui/label.cpp:973-998`, backed by
 * `_update_visible` at `:344-388` and `get_line_height` at `:111-136`).
 * Expected numbers are hand-derived from the vendored OpenSans_SemiBold
 * metrics (`unitsPerEm=2048`, `ascent=2189`, `descent=600`) and atlas advances
 * — an independent worked example, never the implementation's own output.
 *
 * At font size 16: ascentPx = ceil(2189*16/2048) = 18, descentPx =
 * ceil(600*16/2048) = 5, line_spacing = 3 (default_theme.cpp:392, scale 1) ->
 * linePitchPx = 26, fontHeightPx (no spacing) = 23.
 * Atlas xadvance (bake size 42, scale 16/42): 'A' = 28, 'B' = 28.
 */
import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import type { LabelProperties } from './types';
import { shapeText, AutowrapMode } from '../../../../r3f/controls/native/text/textLayout';
import { labelMinimumSize, LABEL_THEME_KEYS, LABEL_DEFAULT_FONT_COLOR, labelTextTheme, layoutLabelLines } from './nativeSolver';
import { originCorrectionPx } from '../../../../r3f/controls/native/text/textOrigin';

function node(props: Partial<LabelProperties>): SolveNode {
  return {
    path: 'L',
    node: { name: 'L', type: 'Label', children: [], properties: { name: 'L', ...props } as ControlProperties },
    children: [],
    styleBoxes: {},
    textureSize: null,
  };
}

function ctx(withMeasurer = true): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText: withMeasurer ? measureText : null,
    combinedMinimumSize: () => ({ x: 0, y: 0 }),
  };
}

const A_ADVANCE = 28 * (16 / 42); // 10.666...

describe('labelMinimumSize (label.cpp:973-998)', () => {
  it('is (1, fontHeightPx) for empty text (label.cpp:239-241, get_line_height with no lines falls to font->get_height, no line_spacing)', () => {
    expect(labelMinimumSize(node({}), ctx())).toEqual({ x: 1, y: 23 });
    expect(labelMinimumSize(node({ text: '' }), ctx())).toEqual({ x: 1, y: 23 });
  });

  it('autowrap OFF: width is the longest UNWRAPPED line, height is a single line (23px, no spacing to subtract)', () => {
    const result = labelMinimumSize(node({ text: 'AB', autowrapMode: 0 }), ctx());
    expect(result.x).toBeCloseTo(A_ADVANCE * 2, 6);
    expect(result.y).toBe(23);
  });

  it('autowrap OFF, explicit hard break: height sums per-line (asc+dsc+spacing) then drops ONE trailing spacing (label.cpp:379-387) — 2*26-3=49, not the naive 2*26=52', () => {
    const result = labelMinimumSize(node({ text: 'A\nAB', autowrapMode: 0 }), ctx());
    expect(result.y).toBe(49);
    // width floors to the WIDER of the two unwrapped lines ('AB'), not 'A'.
    expect(result.x).toBeCloseTo(A_ADVANCE * 2, 6);
  });

  it('autowrap ON (any non-zero mode): width floors to 1px regardless of text (label.cpp:984-991, always Size2(1, ...))', () => {
    const arbitrary = labelMinimumSize(node({ text: 'a very long line indeed', autowrapMode: 1 }), ctx());
    const wordSmart = labelMinimumSize(node({ text: 'a very long line indeed', autowrapMode: 3 }), ctx());
    expect(arbitrary.x).toBe(1);
    expect(wordSmart.x).toBe(1);
  });

  it('autowrap ON height substitutes the UNWRAPPED natural height (self-referential FIT_* shape, texturerect/nativeSolver.ts precedent) — single line is still 23px', () => {
    const result = labelMinimumSize(node({ text: 'AB', autowrapMode: 2 }), ctx());
    expect(result.y).toBe(23);
  });

  it('autowrap ON, explicit hard break still contributes its own per-line height (49px for two lines, same -spacing rule as OFF)', () => {
    const result = labelMinimumSize(node({ text: 'A\nAB', autowrapMode: 2 }), ctx());
    expect(result.y).toBe(49);
  });

  it('treats an absent measurer as no contribution (solverRegistry.ts contract) — except the always-known empty-text/autowrap-width branches', () => {
    expect(labelMinimumSize(node({ text: 'AB', autowrapMode: 0 }), ctx(false))).toEqual({ x: 0, y: 0 });
  });

  it('reads theme_override_font_sizes/font_size, not the theme default, when present', () => {
    const withOverride = labelMinimumSize(
      node({ text: '', themeOverrideFontSizes: { font_size: 32 } }),
      ctx()
    );
    // At size 32: ascentPx=ceil(2189*32/2048)=35, descentPx=ceil(600*32/2048)=10 -> fontHeightPx=45.
    expect(withOverride.y).toBe(45);
  });
});

describe('labelTextTheme / LABEL_THEME_KEYS / LABEL_DEFAULT_FONT_COLOR', () => {
  it('uses font_size/font_color as the override keys', () => {
    expect(LABEL_THEME_KEYS).toEqual({ sizeKey: 'font_size', colorKey: 'font_color' });
  });

  it("defaults to Label's own opaque-white font colour, not a gray control_font_color", () => {
    expect(LABEL_DEFAULT_FONT_COLOR).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it("resolves the theme's own default font size absent an override", () => {
    const resolved = labelTextTheme({ name: 'L' } as LabelProperties, { theme: nativeTheme(1) });
    expect(resolved).toEqual({ fontSizePx: 16, color: LABEL_DEFAULT_FONT_COLOR });
  });
});

describe('originCorrectionPx (TextRun box-top vs. Godot baseline-anchored origin, spike S2 residual)', () => {
  it('at size 16: ascentPx(18) - base(45 bake)*scale(16/42) = 0.857142857...', () => {
    // 45 * 16 / 42 = 17.142857142857142; 18 - that = 0.8571428571428577.
    expect(originCorrectionPx(16)).toBeCloseTo(18 - (45 * 16) / 42, 10);
  });

  it('is a genuinely nonzero constant (proves the reconciliation is not a no-op)', () => {
    expect(originCorrectionPx(16)).not.toBe(0);
  });
});

describe('layoutLabelLines (label.cpp:592-617 vbegin/vsep, :592-605 _get_line_rect x)', () => {
  const FONT_SIZE = 16;
  const PITCH = 26; // getLinePitchPx(16)

  function layoutFor(text: string, boxWidthPx = 0, autowrapMode = AutowrapMode.OFF) {
    return shapeText(text, { fontSizePx: FONT_SIZE, boxWidthPx, autowrapMode });
  }

  it('left alignment (default/undefined): every line starts at x=0', () => {
    const layout = layoutFor('A\nAB'); // two lines, different widths
    const placements = layoutLabelLines(layout, 200, 200, undefined, undefined, FONT_SIZE);
    expect(placements.map((p) => p.x)).toEqual([0, 0]);
  });

  it('center alignment (1): each line centers independently by ITS OWN width', () => {
    const layout = layoutFor('A\nAB');
    const placements = layoutLabelLines(layout, 200, 200, 1, undefined, FONT_SIZE);
    expect(placements[0]!.x).toBeCloseTo((200 - layout.lines[0]!.widthPx) / 2, 6);
    expect(placements[1]!.x).toBeCloseTo((200 - layout.lines[1]!.widthPx) / 2, 6);
    expect(placements[0]!.x).not.toBeCloseTo(placements[1]!.x, 3);
  });

  it('right alignment (2): each line right-aligns to the box width', () => {
    const layout = layoutFor('AB');
    const placements = layoutLabelLines(layout, 200, 200, 2, undefined, FONT_SIZE);
    expect(placements[0]!.x + placements[0]!.line.widthPx).toBeCloseTo(200, 6);
  });

  it('vertical TOP (default): line N sits at originCorrectionPx + N*linePitchPx, no vbegin', () => {
    const layout = layoutFor('A\nB\nC');
    const placements = layoutLabelLines(layout, 200, 200, undefined, 0, FONT_SIZE);
    const origin = originCorrectionPx(FONT_SIZE);
    expect(placements.map((p) => p.y)).toEqual([origin, origin + PITCH, origin + 2 * PITCH]);
  });

  it('vertical CENTER (1): vbegin centers the whole text block in the box', () => {
    const layout = layoutFor('A\nB'); // 2 lines: contentHeight = 2*26-3 = 49
    const placements = layoutLabelLines(layout, 200, 149, undefined, 1, FONT_SIZE);
    const vbegin = (149 - 49) / 2;
    expect(placements[0]!.y).toBeCloseTo(vbegin + originCorrectionPx(FONT_SIZE), 6);
  });

  it('vertical BOTTOM (2): vbegin pins the block against the box bottom', () => {
    const layout = layoutFor('A\nB');
    const placements = layoutLabelLines(layout, 200, 149, undefined, 2, FONT_SIZE);
    const vbegin = 149 - 49;
    expect(placements[0]!.y).toBeCloseTo(vbegin + originCorrectionPx(FONT_SIZE), 6);
  });

  it('vertical FILL (3): distributes the box height evenly across N-1 inter-line gaps', () => {
    const layout = layoutFor('A\nB\nC'); // 3 lines, contentHeight = 3*26-3 = 75
    const placements = layoutLabelLines(layout, 200, 175, undefined, 3, FONT_SIZE);
    const vsep = (175 - 75) / 2;
    const origin = originCorrectionPx(FONT_SIZE);
    expect(placements[0]!.y).toBeCloseTo(origin, 6);
    expect(placements[1]!.y).toBeCloseTo(origin + PITCH + vsep, 6);
    expect(placements[2]!.y).toBeCloseTo(origin + 2 * (PITCH + vsep), 6);
  });

  it('horizontal FILL (3), single line: widens that line to the box width (JUSTIFICATION_DO_NOT_SKIP_SINGLE_LINE, label.h:46)', () => {
    const layout = layoutFor('A B');
    const placements = layoutLabelLines(layout, 200, 200, 3, undefined, FONT_SIZE);
    expect(placements[0]!.line.widthPx).toBeCloseTo(200, 6);
    expect(placements[0]!.x).toBe(0);
  });

  it("horizontal FILL (3), multi-line: the LAST line is NOT justified (JUSTIFICATION_SKIP_LAST_LINE, label.h:46) — earlier lines are", () => {
    const layout = layoutFor('A B\nA B');
    const naturalWidth = layout.lines[0]!.widthPx;
    const placements = layoutLabelLines(layout, 200, 200, 3, undefined, FONT_SIZE);
    expect(placements[0]!.line.widthPx).toBeCloseTo(200, 6);
    expect(placements[1]!.line.widthPx).toBeCloseTo(naturalWidth, 6);
  });
});
