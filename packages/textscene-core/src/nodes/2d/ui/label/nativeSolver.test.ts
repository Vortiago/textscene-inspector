/**
 * Tests `labelMinimumSize` against Godot 4.6.3 (`scene/gui/label.cpp:973-998`, `:344-388`, `:111-136`)
 * with numbers derived by hand from OpenSans_SemiBold's `hmtx` advances (`openSansMetrics.ts`, not the
 * atlas's rounded `xadvance`), never from the code. At size 16: ascent ceil(2189*16/2048) = 18, descent
 * ceil(600*16/2048) = 5, line_spacing 3 (default_theme.cpp:392): pitch 26, font height 23.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { controlSolverRegistry, type SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { createSolveContext, solveControlTree } from '../../../../r3f/controls/native/controlRectSolver';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import { panelContainerLayout, panelContainerMinimumSize } from '../panelcontainer/nativeSolver';
import { makeBoxContainerLayout, makeBoxContainerMinimumSize } from '../shared/boxContainerSolver';
import type { LabelProperties } from './types';
import { shapeText, AutowrapMode, type TextLayoutResult, type TextLineLayout } from '../../../../r3f/controls/native/text/textLayout';
import { JustificationFlag } from '../../../../r3f/controls/native/text/textJustify';
import {
  labelMinimumSize,
  labelShapingWidthPx,
  labelUnwrappedShape,
  LABEL_THEME_KEYS,
  LABEL_THEME_FONT_KEY,
  LABEL_DEFAULT_FONT_COLOR,
  LABEL_LINE_SPACING_PX,
  labelTextTheme,
  layoutLabelLines,
  labelVisibleLineRange,
  windowLabelLines,
  labelPreShapeText,
  applyVisibleCharsReveal,
  labelEffectiveTextTheme,
  labelOutlineTheme,
  labelShadowTheme,
  VC_CHARS_BEFORE_SHAPING,
  VC_CHARS_AFTER_SHAPING,
  VC_GLYPHS_AUTO,
  VC_GLYPHS_LTR,
  VC_GLYPHS_RTL,
} from './nativeSolver';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import type { FontResource } from '../../../../resources/fonts/font/types';
import * as logger from '../../../../logger';

const minSize = labelMinimumSize;

function node(props: Partial<LabelProperties>, overrides: Partial<SolveNode> = {}): SolveNode {
  return {
    ...emptySolveNode(),
    path: 'L',
    node: { name: 'L', type: 'Label', children: [], properties: { name: 'L', ...props } as ControlProperties },
    ...overrides,
  };
}

function ctx(withMeasurer = true): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText: withMeasurer ? measureText : null,
    combinedMinimumSize: () => ({ x: 0, y: 0 }),
  };
}

// 'A' is 1354 design units and 'B' 1350, so 'AB' is their sum, not `A_ADVANCE * 2`.
const AB_WIDTH = (1354 + 1350) * (16 / 2048); // 21.125
// `TS->shaped_text_get_size(...).x` ceils the pen advance (`text_server_adv.cpp:7524-7537`), and every
// minimum size below builds on that, not on the fractional sum.
const AB_SHAPED_WIDTH = Math.ceil(AB_WIDTH); // 22

describe('labelMinimumSize (label.cpp:973-998)', () => {
  it('is (1, fontHeightPx) for empty text (label.cpp:239-241, get_line_height with no lines falls to font->get_height, no line_spacing)', () => {
    expect(labelMinimumSize(node({}), ctx())).toEqual({ x: 1, y: 23 });
    expect(labelMinimumSize(node({ text: '' }), ctx())).toEqual({ x: 1, y: 23 });
  });

  it('autowrap OFF: width is the longest UNWRAPPED line, height is a single line (23px, no spacing to subtract)', () => {
    const result = minSize(node({ text: 'AB', autowrapMode: 0 }), ctx());
    expect(result.x).toBeCloseTo(AB_SHAPED_WIDTH, 6);
    expect(result.y).toBe(23);
  });

  it('autowrap OFF, explicit hard break: height sums per-line (asc+dsc+spacing) then drops ONE trailing spacing (label.cpp:379-387) — 2*26-3=49, not the naive 2*26=52', () => {
    const result = minSize(node({ text: 'A\nAB', autowrapMode: 0 }), ctx());
    expect(result.y).toBe(49);
    // width floors to the wider of the two unwrapped lines ('AB'), not 'A'.
    expect(result.x).toBeCloseTo(AB_SHAPED_WIDTH, 6);
  });

  it('autowrap OFF + clip_text: width floors to 1px, ignoring the unwrapped line width (label.cpp:993-995)', () => {
    const result = minSize(node({ text: 'AB', autowrapMode: 0, clipText: true }), ctx());
    expect(result.x).toBe(1);
    expect(result.y).toBe(23);
  });

  it('autowrap OFF + a trimming text_overrun_behavior: width also floors to 1px, with clip_text left off (label.cpp:993-995, `clip || overrun_behavior != OVERRUN_NO_TRIMMING`)', () => {
    const result = minSize(node({ text: 'AB', autowrapMode: 0, overrunBehavior: 3 }), ctx());
    expect(result.x).toBe(1);
  });

  it('autowrap OFF + OVERRUN_NO_TRIMMING (0) and no clip_text: width is unaffected (the explicit default, same as omitting the property)', () => {
    const result = minSize(node({ text: 'AB', autowrapMode: 0, overrunBehavior: 0 }), ctx());
    expect(result.x).toBeCloseTo(AB_SHAPED_WIDTH, 6);
  });

  it('autowrap ON (any non-zero mode): width floors to 1px regardless of text (label.cpp:984-991, always Size2(1, ...))', () => {
    const arbitrary = minSize(node({ text: 'a very long line indeed', autowrapMode: 1 }), ctx());
    const wordSmart = minSize(node({ text: 'a very long line indeed', autowrapMode: 3 }), ctx());
    expect(arbitrary.x).toBe(1);
    expect(wordSmart.x).toBe(1);
  });

  it('autowrap ON, FIRST pass (no tentativeRect): height substitutes the UNWRAPPED natural height (self-referential FIT_* shape, texturerect/nativeSolver.ts precedent) — single line is still 23px', () => {
    const result = minSize(node({ text: 'AB', autowrapMode: 2 }), ctx());
    expect(result.y).toBe(23);
  });

  it('autowrap ON, explicit hard break still contributes its own per-line height (49px for two lines, same -spacing rule as OFF)', () => {
    const result = minSize(node({ text: 'A\nAB', autowrapMode: 2 }), ctx());
    expect(result.y).toBe(49);
  });

  it('treats an absent measurer as no contribution (solverRegistry.ts contract) — except the always-known empty-text/autowrap-width branches', () => {
    expect(labelMinimumSize(node({ text: 'AB', autowrapMode: 0 }), ctx(false))).toEqual({ x: 0, y: 0 });
  });

  it('reads theme_override_font_sizes/font_size, not the theme default, when present', () => {
    const withOverride = minSize(
      node({ text: '', themeOverrideFontSizes: { font_size: 32 } }),
      ctx()
    );
    // At size 32: ascentPx=ceil(2189*32/2048)=35, descentPx=ceil(600*32/2048)=10 -> fontHeightPx=45.
    expect(withOverride.y).toBe(45);
  });

  it('uppercase transforms the text BEFORE measuring (label.cpp:154, read by get_minimum_size via _ensure_shaped) — uppercase glyphs are WIDER in this atlas', () => {
    // Only `uppercase` differs, and uppercase glyphs are wider in this atlas.
    const lower = minSize(node({ text: 'ab', autowrapMode: 0 }), ctx());
    const upper = minSize(node({ text: 'ab', uppercase: true, autowrapMode: 0 }), ctx());
    expect(upper.x).toBeCloseTo(AB_SHAPED_WIDTH, 6);
    expect(upper.x).toBeGreaterThan(lower.x);
  });
});

/**
 * Godot 4.6.3 on `scenes/fixtures/complex-2d-gui.tscn` (1152x648 SubViewport, `scripts/godot-ref/run.mjs`'s
 * 6-frame settle, `get_combined_minimum_size()`): the autowrapped Subtitle has rect (0, 41, 640, 49) and
 * SquadNote (0, 102, 282, 49), each with minimum (1, 49). That is the two-line height 2*26 - 3, not a
 * one-line 23, at font size 16.
 */
describe('labelMinimumSize — autowrap ON reports the WRAPPED height once a prior pass has resolved its width', () => {
  const SUBTITLE = 'Changes apply to the active deployment only, and are discarded when the corridor closes.';

  /** A `SolveContext` whose `tentativeRect` answers for every node, as after a completed pass. */
  function ctxAt(width: number): SolveContext {
    return { ...ctx(), tentativeRect: () => ({ x: 0, y: 0, w: width, h: 0 }) };
  }

  it("640px box (Godot's own solved Subtitle width): two lines, 49px", () => {
    expect(minSize(node({ text: SUBTITLE, autowrapMode: 2 }), ctxAt(640)).y).toBe(49);
  });

  it("282px box (Godot's own solved SquadNote width) wraps the SAME sentence further: still at least two lines", () => {
    const short = 'Two of four wing members are still reporting inside the corridor.';
    expect(minSize(node({ text: short, autowrapMode: 2 }), ctxAt(282)).y).toBe(49);
  });

  it('a narrower box reports a TALLER minimum — the height is a function of the width the container handed back', () => {
    const wide = minSize(node({ text: SUBTITLE, autowrapMode: 2 }), ctxAt(640)).y;
    const narrow = minSize(node({ text: SUBTITLE, autowrapMode: 2 }), ctxAt(200)).y;
    expect(narrow).toBeGreaterThan(wide);
  });

  it('a box wide enough for the whole sentence reports the one-line height', () => {
    expect(minSize(node({ text: SUBTITLE, autowrapMode: 2 }), ctxAt(4000)).y).toBe(23);
  });

  it('the width floor stays 1px on the second pass too (label.cpp:984-991 returns Size2(1, ...) unconditionally)', () => {
    expect(minSize(node({ text: SUBTITLE, autowrapMode: 2 }), ctxAt(640)).x).toBe(1);
  });

  it('autowrap OFF ignores tentativeRect entirely — its own width floor is the unwrapped line, on every pass', () => {
    expect(labelMinimumSize(node({ text: 'AB', autowrapMode: 0 }), ctxAt(4)).y).toBe(23);
  });

  it('shapes at a TRUNCATED width (label.cpp:581 `int width = get_size().width - ...`), so a fractional box does not fit a word its whole-pixel width cannot', () => {
    const full = shapeText('AB AB', { fontSizePx: 16, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 3 }).widthPx;
    // The discriminating band: trunc(box) < full <= box. Vacuous if `full`
    // landed on a whole pixel, so pin that it did not.
    expect(Number.isInteger(full)).toBe(false);
    const box = Math.floor(full) + 0.9;
    expect(box).toBeGreaterThan(full);
    expect(minSize(node({ text: 'AB AB', autowrapMode: 2 }), ctxAt(box)).y).toBe(49);
  });
});

/**
 * An autowrapped Label's wrapped height must reach the container that set its width, or the overflow
 * draws outside it. `complex-2d-gui.tscn`'s header card, cut to two Labels: PanelContainer (margins
 * 14/12/14/12) min height 114, VBoxContainer (separation 2) 90, unwrapped Label (font_size 28) 39,
 * wrapped Label (autowrap WORD, box 640) 49.
 */
describe('labelMinimumSize wired through the registry + full solve — the wrapped height reaches the container', () => {
  afterEach(() => {
    controlSolverRegistry.clear();
  });

  const SUBTITLE = 'Changes apply to the active deployment only, and are discarded when the corridor closes.';

  function register(): void {
    controlSolverRegistry.registerMinimumSize('Label', labelMinimumSize);
    controlSolverRegistry.registerSizeDependentMinimum('Label');
    controlSolverRegistry.registerMinimumSize('PanelContainer', panelContainerMinimumSize);
    controlSolverRegistry.registerContainerLayout('PanelContainer', panelContainerLayout);
    controlSolverRegistry.registerMinimumSize('VBoxContainer', makeBoxContainerMinimumSize(true));
    controlSolverRegistry.registerContainerLayout('VBoxContainer', makeBoxContainerLayout(true));
  }

  /** `PanelContainer > VBoxContainer > [unwrapped Label, wrapped Label]`, the shape both measured scenes reduce to. */
  function card(
    margin: number,
    separation: number,
    heading: Partial<LabelProperties>,
    body: Partial<LabelProperties>
  ): SolveNode {
    const label = (name: string, props: Partial<LabelProperties>): SolveNode => ({
      ...emptySolveNode(),
      path: `Card/Column/${name}`,
      node: { name, type: 'Label', children: [], properties: { name, ...props } as ControlProperties },
    });
    const column: SolveNode = {
      ...emptySolveNode(),
      path: 'Card/Column',
      node: {
        name: 'Column',
        type: 'VBoxContainer',
        children: [],
        properties: { name: 'Column', themeOverrideConstants: { separation } } as ControlProperties,
      },
      children: [label('Heading', heading), label('Body', body)],
      // A local theme_override_constants/* reaches `separationOf` through `n.constants`, which the
      // walker fills unconditionally, not through props.
      constants: { separation },
    };
    return {
      ...emptySolveNode(),
      path: 'Card',
      node: {
        name: 'Card',
        type: 'PanelContainer',
        children: [],
        properties: { name: 'Card', layoutMode: 3, anchorsPreset: 15 } as ControlProperties,
      },
      children: [column],
      styleBoxes: {
        panel: {
          bgColor: { r: 0, g: 0, b: 0, a: 1 },
          borderColor: { r: 0, g: 0, b: 0, a: 1 },
          borderWidth: { left: 0, top: 0, right: 0, bottom: 0 },
          cornerRadius: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
          expandMargin: { left: 0, top: 0, right: 0, bottom: 0 },
          contentMargin: { left: margin, top: margin, right: margin, bottom: margin },
          drawCenter: true,
          borderBlend: false,
          antiAliased: true,
          aaSize: 1,
          cornerDetail: 8,
          skew: { x: 0, y: 0 },
          shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
          shadowSize: 0,
          shadowOffset: { x: 0, y: 0 },
        },
      },
    };
  }

  function solve(root: SolveNode, viewport: Rect2) {
    register();
    return solveControlTree([root], viewport, createSolveContext(nativeTheme(1), measureText));
  }

  describe("complex-2d-gui.tscn's header card (margins 14/12, separation 2, font_size 28 title)", () => {
    // The Label's own 640 + the panel's 14+14 horizontal margins. The vertical
    // margins are 12, so the card's 114 is 12 + 39 + 2 + 49 + 12.
    const VIEWPORT: Rect2 = { x: 0, y: 0, w: 668, h: 114 };
    const build = () =>
      card(0, 2, { text: 'FIELD OPERATIONS', themeOverrideFontSizes: { font_size: 28 } }, { text: SUBTITLE, autowrapMode: 2 });

    function headerCard(): SolveNode {
      const n = build();
      return {
        ...n,
        styleBoxes: {
          panel: { ...n.styleBoxes.panel!, contentMargin: { left: 14, top: 12, right: 14, bottom: 12 } },
        },
      };
    }

    it("the card's own minimum height covers both lines of the Subtitle (114, not 88)", () => {
      expect(solve(headerCard(), VIEWPORT).get('Card')?.minSize.y).toBe(114);
    });

    it('the Subtitle is laid out 49px tall inside it — its second line is inside the card, not below it', () => {
      const subtitle = solve(headerCard(), VIEWPORT).get('Card/Column/Body');
      expect(subtitle?.rect.w).toBe(640);
      expect(subtitle?.rect.h).toBe(49);
      expect(subtitle?.rect.y).toBe(41);
    });

    it('the box container between them sees the same 90px minimum Godot does', () => {
      expect(solve(headerCard(), VIEWPORT).get('Card/Column')?.minSize.y).toBe(90);
    });
  });

  /**
   * `scenes/fixtures/unit-label-autowrap-in-container.tscn` in Godot 4.6.3, same settle, as rect and min:
   * Card (64, 64, 400, 130) and (189, 130). Column (12, 12, 376, 106) and (165, 106). Heading
   * (0, 0, 376, 23) and (165, 23), one line. Body (0, 31, 376, 75) and (1, 75), three lines.
   */
  describe('unit-label-autowrap-in-container.tscn (margins 12, separation 8, three wrapped lines)', () => {
    const VIEWPORT: Rect2 = { x: 0, y: 0, w: 400, h: 130 };
    const BODY =
      'This paragraph has no width of its own. The container decides how wide it is, and only then can it say how tall it needs to be.';
    const build = () => card(12, 8, { text: 'Container-sized wrap' }, { text: BODY, autowrapMode: 3 });

    it('the card is 130 tall — 12 + 23 + 8 + 75 + 12, not the 78 a one-line body would give', () => {
      expect(solve(build(), VIEWPORT).get('Card')?.minSize.y).toBe(130);
    });

    it('the body wraps to three lines inside a 376px content width (3 * 26 - 3 = 75)', () => {
      const body = solve(build(), VIEWPORT).get('Card/Column/Body');
      expect(body?.rect.w).toBe(376);
      expect(body?.rect.h).toBe(75);
      expect(body?.rect.y).toBe(31);
    });
  });
});

describe('labelUnwrappedShape — the one shaping the solver and the painter share when autowrap is OFF', () => {
  const shape = (props: Partial<LabelProperties>): TextLayoutResult | null =>
    labelUnwrappedShape(node(props), nativeTheme(1));

  it('shapes the text unwrapped', () => {
    const layout = shape({ text: 'AB' })!;
    expect(layout.widthPx).toBeCloseTo(AB_WIDTH, 6);
    expect(layout.lines).toHaveLength(1);
  });

  it('is uppercase-transformed exactly like the minimum size', () => {
    // Trailing ZWSP is Label's own per-paragraph terminator (`label.cpp:164`).
    expect(shape({ text: 'ab', uppercase: true })!.lines[0]?.text).toBe(`AB${'\u200b'}`);
  });

  it('is null for empty text', () => {
    expect(shape({})).toBeNull();
  });

  it('windows to lines_skipped/max_lines_visible, so a caller must not window it again', () => {
    expect(shape({ text: 'A\nB\nC', maxLinesVisible: 2 })!.lines).toHaveLength(2);
  });
});

describe("labelShapingWidthPx (label.cpp:581's `int width = get_size().width - style->get_minimum_size().width`)", () => {
  it('leaves a whole-pixel width alone — every container that hands out integers is unaffected', () => {
    expect(labelShapingWidthPx(376)).toBe(376);
    expect(labelShapingWidthPx(0)).toBe(0);
  });

  it('drops the fraction of a fractional width, so a word only just too wide for the whole pixel wraps', () => {
    expect(labelShapingWidthPx(320.9)).toBe(320);
    expect(labelShapingWidthPx(320.0001)).toBe(320);
  });

  it('truncates a negative width toward zero, like the C++ conversion — a degenerate rect never becomes a wider one', () => {
    expect(labelShapingWidthPx(-0.5)).toBe(-0);
    expect(labelShapingWidthPx(-4.7)).toBe(-4);
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
    const resolved = labelTextTheme(node({}), { name: 'L' } as LabelProperties, { theme: nativeTheme(1) });
    expect(resolved).toEqual({ fontSizePx: 16, color: LABEL_DEFAULT_FONT_COLOR });
  });
});

describe('layoutLabelLines (label.cpp:592-617 vbegin/vsep, :592-605 _get_line_rect x)', () => {
  const FONT_SIZE = 16;
  const PITCH = 26; // getLinePitchPx(16)

  function layoutFor(text: string, boxWidthPx = 0, autowrapMode = AutowrapMode.OFF) {
    return shapeText(text, { fontSizePx: FONT_SIZE, boxWidthPx, autowrapMode, lineSpacingPx: 3 });
  }

  it('left alignment (default/undefined): every line starts at x=0', () => {
    const layout = layoutFor('A\nAB'); // two lines, different widths
    const placements = layoutLabelLines(layout, 200, 200, undefined, undefined);
    expect(placements.map((p) => p.x)).toEqual([0, 0]);
  });

  it('center alignment (1): each line centers independently by ITS OWN width', () => {
    const layout = layoutFor('A\nAB');
    const placements = layoutLabelLines(layout, 200, 200, 1, undefined);
    expect(placements[0]!.x).toBe(Math.trunc(Math.trunc(200 - layout.lines[0]!.widthPx) / 2));
    expect(placements[1]!.x).toBe(Math.trunc(Math.trunc(200 - layout.lines[1]!.widthPx) / 2));
    expect(placements[0]!.x).not.toBe(placements[1]!.x);
  });

  it('right alignment (2): each line right-aligns to the box width', () => {
    const layout = layoutFor('AB');
    const placements = layoutLabelLines(layout, 200, 200, 2, undefined);
    expect(placements[0]!.x).toBe(Math.trunc(200 - layout.lines[0]!.widthPx));
  });

  it('vertical TOP (default): line N sits at exactly N*linePitchPx — the pure label.cpp box top, with no painter-side anchor folded in (`<TextRun>` owns that)', () => {
    const layout = layoutFor('A\nB\nC');
    const placements = layoutLabelLines(layout, 200, 200, undefined, 0);
    expect(placements.map((p) => p.y)).toEqual([0, PITCH, 2 * PITCH]);
  });

  it('vertical CENTER (1): vbegin centers the whole text block in the box', () => {
    const layout = layoutFor('A\nB'); // 2 lines: contentHeight = 2*26-3 = 49
    const placements = layoutLabelLines(layout, 200, 149, undefined, 1);
    const vbegin = (149 - 49) / 2;
    expect(placements[0]!.y).toBeCloseTo(vbegin, 6);
  });

  it('vertical BOTTOM (2): vbegin pins the block against the box bottom', () => {
    const layout = layoutFor('A\nB');
    const placements = layoutLabelLines(layout, 200, 149, undefined, 2);
    const vbegin = 149 - 49;
    expect(placements[0]!.y).toBeCloseTo(vbegin, 6);
  });

  it('vertical FILL (3): distributes the box height evenly across N-1 inter-line gaps', () => {
    const layout = layoutFor('A\nB\nC'); // 3 lines, contentHeight = 3*26-3 = 75
    const placements = layoutLabelLines(layout, 200, 175, undefined, 3);
    const vsep = (175 - 75) / 2;
    expect(placements[0]!.y).toBeCloseTo(0, 6);
    expect(placements[1]!.y).toBeCloseTo(PITCH + vsep, 6);
    expect(placements[2]!.y).toBeCloseTo(2 * (PITCH + vsep), 6);
  });

  // `get_layout_data` assigns into `int vbegin = 0, vsep = 0;`, so both truncate toward zero. A Godot
  // 4.6.3 render puts one 23px line of 16px text in a 100px box on the same row as in a 99px box,
  // which only a truncated offset produces.
  it('vertical CENTER (1) truncates a half-pixel offset: a 100px box and a 99px box around the same 23px line place their text on the SAME row (38, not 38.5)', () => {
    const layout = layoutFor('A'); // one line: contentHeight = 26 - 3 = 23
    const odd = layoutLabelLines(layout, 200, 99, undefined, 1);
    const even = layoutLabelLines(layout, 200, 100, undefined, 1);
    expect(odd[0]!.y).toBe(38);
    expect(even[0]!.y).toBe(38);
  });

  it('vertical BOTTOM (2) truncates too — a fractional box height cannot put the text on a fractional row', () => {
    const layout = layoutFor('A');
    const placements = layoutLabelLines(layout, 200, 100.75, undefined, 2);
    expect(placements[0]!.y).toBe(77);
  });

  it('vertical FILL (3) truncates the SEPARATION, not the accumulated pitch: four lines in a 205px box sit 60px apart, so the last line lands on 180 rather than drifting to 182', () => {
    const layout = layoutFor('A\nB\nC\nD'); // 4 lines: contentHeight = 4*26-3 = 101
    // (205 - 101) / 3 = 34.666..., truncated to 34, on top of the 26px pitch.
    const placements = layoutLabelLines(layout, 200, 205, undefined, 3);
    expect(placements.map((p) => p.y)).toEqual([0, 60, 120, 180]);
  });

  it('truncates TOWARD ZERO, not toward minus infinity, when the box is SHORTER than the text (C++ `int` conversion, not a floor)', () => {
    const layout = layoutFor('A'); // contentHeight 23
    // (10 - 23) / 2 = -6.5 -> -6 under an int conversion; a floor would give -7.
    expect(layoutLabelLines(layout, 200, 10, undefined, 1)[0]!.y).toBe(-6);
    // FILL's separation goes the same way: (10 - 101) / 3 = -30.333... -> -30.
    const four = layoutFor('A\nB\nC\nD');
    expect(layoutLabelLines(four, 200, 10, undefined, 3)[1]!.y).toBe(PITCH - 30);
  });

  it('horizontal FILL (3), single line: widens that line to the box width (JUSTIFICATION_DO_NOT_SKIP_SINGLE_LINE, label.h:46)', () => {
    const layout = layoutFor('A B');
    const placements = layoutLabelLines(layout, 200, 200, 3, undefined);
    expect(placements[0]!.line.widthPx).toBeCloseTo(200, 6);
    expect(placements[0]!.x).toBe(0);
  });

  it("horizontal FILL (3), multi-line: the LAST line is NOT justified (JUSTIFICATION_SKIP_LAST_LINE, label.h:46) — earlier lines are", () => {
    const layout = layoutFor('A B\nA B');
    const naturalWidth = layout.lines[0]!.widthPx;
    const placements = layoutLabelLines(layout, 200, 200, 3, undefined);
    expect(placements[0]!.line.widthPx).toBeCloseTo(200, 6);
    expect(placements[1]!.line.widthPx).toBeCloseTo(naturalWidth, 6);
  });
});

/**
 * `Label::_get_line_rect`'s x (`label.cpp:487-512`) measured in Godot 4.6.3: "Wave rift" at size 16, one
 * 70.0px line, read back through `get_character_bounds(0).position.x` (`label.cpp:935-936`). Label's
 * `StyleBoxEmpty` (`default_theme.cpp:379`) zeroes offset and margin. A negative row needs `clip_text`,
 * which drops the width floor to 1 (`label.cpp:997-998`), and only it separates an `int` from a floor.
 */
describe('layoutLabelLines — horizontal origins vs Godot 4.6.3 (label.cpp:487-512)', () => {
  const FONT_SIZE = 16;
  const GODOT_LINE_WIDTH_PX = 70;

  /** A one-line layout pinned to Godot's measured width of "Wave rift", so this tests the placement formula, not the atlas advances against FreeType's. */
  function lineOfWidth(widthPx: number) {
    const layout = shapeText('Wave rift', { fontSizePx: FONT_SIZE, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 3 });
    return { ...layout, lines: layout.lines.map((l) => ({ ...l, widthPx })), widthPx };
  }

  function originAt(boxWidthPx: number, alignment: number): number {
    return layoutLabelLines(lineOfWidth(GODOT_LINE_WIDTH_PX), boxWidthPx, 100, alignment, undefined)[0]!.x;
  }

  const CENTER_CASES: Array<[number, number]> = [
    [200, 65], [200.5, 65], [201, 65], [201.5, 65],
    [202, 66], [202.5, 66], [203, 66], [203.5, 66], [204, 67],
    [260, 95], [260.25, 95], [260.75, 95],
  ];
  it.each(CENTER_CASES)('H_CENTER at box %p places the line at Godot\'s x = %p', (boxWidthPx, expected) => {
    expect(originAt(boxWidthPx, 1)).toBe(expected);
  });

  const RIGHT_CASES: Array<[number, number]> = [
    [200, 130], [200.5, 130], [201, 131], [201.5, 131],
    [202, 132], [202.5, 132], [203, 133], [203.5, 133], [204, 134],
    [260, 190], [260.25, 190], [260.75, 190],
  ];
  it.each(RIGHT_CASES)('H_RIGHT at box %p places the line at Godot\'s x = %p', (boxWidthPx, expected) => {
    expect(originAt(boxWidthPx, 2)).toBe(expected);
  });

  const CENTER_NEGATIVE: Array<[number, number]> = [
    [20, -25], [20.5, -24], [21, -24], [21.5, -24], [22, -24], [23, -23], [24, -23], [25, -22],
  ];
  it.each(CENTER_NEGATIVE)(
    'H_CENTER truncates TOWARD ZERO when the box is narrower than the line: box %s -> %s',
    (boxWidthPx, expected) => {
      expect(originAt(boxWidthPx, 1)).toBe(expected);
    }
  );

  const RIGHT_NEGATIVE: Array<[number, number]> = [
    [20, -50], [20.5, -49], [21, -49], [21.5, -48], [22, -48], [23, -47], [24, -46], [25, -45],
  ];
  it.each(RIGHT_NEGATIVE)(
    'H_RIGHT truncates TOWARD ZERO when the box is narrower than the line: box %s -> %s',
    (boxWidthPx, expected) => {
      expect(originAt(boxWidthPx, 2)).toBe(expected);
    }
  );

  /**
   * `_shape` justifies at the `int width` it broke lines at (`label.cpp:297,331`), while
   * `_get_line_rect` aligns against the raw `get_size()`. Measured in Godot 4.6.3 as the first line's
   * last right edge under `HORIZONTAL_ALIGNMENT_FILL`.
   */
  it.each([
    [300, 300],
    [300.7, 300],
    [301.4, 301],
  ])('H_FILL stretches a line to the TRUNCATED box width: box %s -> right edge %s', (boxWidthPx, expected) => {
    const layout = shapeText('A B C\nD', { fontSizePx: FONT_SIZE, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 3 });
    const placements = layoutLabelLines(layout, boxWidthPx, 200, 3, undefined);
    expect(placements[0]!.x).toBe(0);
    expect(placements[0]!.line.widthPx).toBe(expected);
  });

  it('a floor would put H_RIGHT a whole pixel left of the engine at every fractional difference', () => {
    expect(originAt(20.5, 2)).toBe(-49);
    expect(Math.floor(20.5 - GODOT_LINE_WIDTH_PX)).toBe(-50);
  });
});

describe(`labelMinimumSize — resolves this Label's own theme font key ("${LABEL_THEME_FONT_KEY}", default_theme.cpp:381)`, () => {
  // An unresolvable font's warn is the observable proof here (`resolveNodeFontMetrics.test.ts`).
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('a theme_override_fonts/font local override is fed to the text engine, even for empty text (fontHeightPx is resolved unconditionally)', () => {
    const systemFont: FontResource = { kind: 'system', fontNames: ['sans-serif'], properties: {} };
    const n = { ...node({}), fontOverrides: { [LABEL_THEME_FONT_KEY]: systemFont } };
    labelMinimumSize(n, ctx());
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('a local override under a different key is not consulted', () => {
    const systemFont: FontResource = { kind: 'system', fontNames: ['sans-serif'], properties: {} };
    const n = { ...node({}), fontOverrides: { normal_font: systemFont } };
    labelMinimumSize(n, ctx());
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

/**
 * `Label::_shape` folds `TS->shaped_text_get_size(line_rid).x`, which is `Size2(sd->width, ...).ceil()`
 * (`text_server_adv.cpp:7524-7537`), into `minsize.width` (`label.cpp:252-257`). Godot 4.6.3 on `complex-2d-gui.tscn`
 * measures the whole values below from advance sums 115.875, 78.453125, 59.671875 and 58.234375. `Size2i` columns
 * (`grid_container.cpp:290`) truncate them, so a minimum a fraction short opens each later column a pixel early.
 */
describe('labelMinimumSize — the shaped extent is ceiled (text_server_adv.cpp:7524-7537)', () => {
  it.each([
    ['Master volume', 116],
    ['Music bed', 79],
    ['Callsign', 60],
    ['Comms', 59],
    // 'l' (571 units) and 'T' (1157) have odd advances, which FreeType's 26.6 grid rounds up: the pen
    // sum is 91.03125, not the 91.0 of flat scaling, and only the former ceils to 92.
    ['Threat level', 92],
  ])('%p floors this Label at Godot\'s own whole-pixel minimum width %p', (text, expected) => {
    expect(minSize(node({ text, autowrapMode: 0 }), ctx()).x).toBe(expected);
  });

  it('a font_size above SUBPIXEL_POSITIONING_ONE_HALF_MAX_SIZE floors on WHOLE-pixel advances, which is NARROWER than the fractional sum', () => {
    const n = node({ text: 'FIELD OPERATIONS', autowrapMode: 0, themeOverrideFontSizes: { font_size: 28 } });
    // Godot rounds each advance to a whole pixel with the remainder carried
    // (text_server_adv.cpp:7079-7084), summing to 257. The unrounded 26.6 sum (257.140625) and a flat
    // hmtx scale (257.099609375) would both ceil to 258.
    expect(minSize(n, ctx()).x).toBe(257);
  });

  it("is strictly wider than the raw pen advance whenever that advance is fractional — the fraction is what a container's Size2i truncation would otherwise lose", () => {
    const raw = shapeText('Master volume', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.OFF,
      lineSpacingPx: 3,
    }).widthPx;
    // Godot 4.6.3: `ThemeDB.fallback_font.get_string_size("Master volume", HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x`
    // is 116, and the font's `get_char_size(c, 16).x` sum is 115.875.
    expect(raw).toBeCloseTo(115.875, 6);
    expect(Math.trunc(raw)).toBe(115);
    expect(minSize(node({ text: 'Master volume', autowrapMode: 0 }), ctx()).x).toBe(116);
  });

  it('takes the ceil of the WIDEST line, not the sum of per-line ceils, for a hard-broken Label', () => {
    const twoLines = minSize(node({ text: 'Callsign\nComms', autowrapMode: 0 }), ctx());
    expect(twoLines.x).toBe(60);
  });

  it('leaves the 1px autowrap-ON width floor alone — that branch never reads a shaped size at all (label.cpp:984-991)', () => {
    expect(minSize(node({ text: 'Master volume', autowrapMode: 2 }), ctx()).x).toBe(1);
  });
});

// lines_skipped and max_lines_visible

describe('labelVisibleLineRange (label.cpp:344-361)', () => {
  it('drops the first linesSkipped lines, uncapped when maxLinesVisible is unset (happy path)', () => {
    expect(labelVisibleLineRange(5, 2, undefined)).toEqual({ start: 2, end: 5 });
  });

  it('caps what remains to maxLinesVisible after the skip', () => {
    expect(labelVisibleLineRange(5, 1, 2)).toEqual({ start: 1, end: 3 });
  });

  it('-1 is the documented "no limit" sentinel, same as unset (error path)', () => {
    expect(labelVisibleLineRange(4, 0, -1)).toEqual({ start: 0, end: 4 });
  });

  it('max_lines_visible = 0 shows zero lines', () => {
    expect(labelVisibleLineRange(4, 0, 0)).toEqual({ start: 0, end: 0 });
  });

  it('skipping past the end yields an empty range, never a negative one (edge case)', () => {
    expect(labelVisibleLineRange(3, 5, undefined)).toEqual({ start: 3, end: 3 });
  });
});

describe('windowLabelLines', () => {
  const layout: TextLayoutResult = {
    lines: [
      { text: 'a', glyphs: [], widthPx: 10 },
      { text: 'b', glyphs: [], widthPx: 30 },
      { text: 'c', glyphs: [], widthPx: 20 },
    ],
    linePitchPx: 26,
    widthPx: 30,
    heightPx: 78,
    baselineOffsetPx: 18,
    fontMetrics: { kind: 'atlas' } as TextLayoutResult['fontMetrics'],
  };

  it('recomputes widthPx/heightPx over the KEPT lines only (happy path)', () => {
    const windowed = windowLabelLines(layout, { start: 1, end: 3 });
    expect(windowed.lines.map((l) => l.widthPx)).toEqual([30, 20]);
    expect(windowed.widthPx).toBe(30);
    expect(windowed.heightPx).toBe(52);
  });

  it('an empty range yields zero lines and zero height (edge case)', () => {
    const windowed = windowLabelLines(layout, { start: 3, end: 3 });
    expect(windowed.lines).toEqual([]);
    expect(windowed.heightPx).toBe(0);
    expect(windowed.widthPx).toBe(0);
  });
});

// visible_characters and visible_characters_behavior

describe('labelPreShapeText (label.cpp:155-156)', () => {
  it('truncates at the default behaviour, VC_CHARS_BEFORE_SHAPING (happy path)', () => {
    expect(labelPreShapeText('Hello', 3, undefined)).toBe('Hel');
    expect(labelPreShapeText('Hello', 3, VC_CHARS_BEFORE_SHAPING)).toBe('Hel');
  });

  it('is a no-op for every other behaviour — those trim at draw time instead (error path)', () => {
    expect(labelPreShapeText('Hello', 3, VC_CHARS_AFTER_SHAPING)).toBe('Hello');
    expect(labelPreShapeText('Hello', 3, VC_GLYPHS_LTR)).toBe('Hello');
  });

  it('a negative or absent visibleChars is "show all" (edge case)', () => {
    expect(labelPreShapeText('Hello', -1, VC_CHARS_BEFORE_SHAPING)).toBe('Hello');
    expect(labelPreShapeText('Hello', undefined, VC_CHARS_BEFORE_SHAPING)).toBe('Hello');
  });
});

function fakeLine(charCount: number): TextLineLayout {
  return {
    text: 'x'.repeat(charCount),
    glyphs: Array.from({ length: charCount }, (_, i) => ({ char: 'x', x: i, advance: 1, glyph: null })),
    widthPx: charCount,
  };
}

describe('applyVisibleCharsReveal (draw_text, label.cpp:778-883)', () => {
  it('VC_CHARS_AFTER_SHAPING keeps a running CHARACTER budget across lines (happy path)', () => {
    const [l1, l2] = applyVisibleCharsReveal([fakeLine(3), fakeLine(3)], {
      behavior: VC_CHARS_AFTER_SHAPING,
      visibleChars: 4,
      visibleRatio: undefined,
    });
    expect(l1!.glyphs.length).toBe(3);
    expect(l2!.glyphs.length).toBe(1);
  });

  it('VC_GLYPHS_AUTO/LTR reveal GLYPHS from the FRONT, budgeted by visible_ratio * total_glyphs', () => {
    const [l1, l2] = applyVisibleCharsReveal([fakeLine(4), fakeLine(4)], {
      behavior: VC_GLYPHS_LTR,
      visibleChars: undefined,
      visibleRatio: 0.5,
    });
    expect(l1!.glyphs.length).toBe(4);
    expect(l2!.glyphs.length).toBe(0);
    const auto = applyVisibleCharsReveal([fakeLine(4), fakeLine(4)], {
      behavior: VC_GLYPHS_AUTO,
      visibleChars: undefined,
      visibleRatio: 0.5,
    });
    expect(auto[0]!.glyphs.length).toBe(4);
    expect(auto[1]!.glyphs.length).toBe(0);
  });

  it('VC_GLYPHS_RTL reveals GLYPHS from the BACK — the opposite end from LTR/AUTO (error path)', () => {
    const [l1, l2] = applyVisibleCharsReveal([fakeLine(4), fakeLine(4)], {
      behavior: VC_GLYPHS_RTL,
      visibleChars: undefined,
      visibleRatio: 0.5,
    });
    expect(l1!.glyphs.length).toBe(0);
    expect(l2!.glyphs.length).toBe(4);
  });

  it('a ratio/chars of "show everything" (>=1, -1, or absent) is a no-op (edge case)', () => {
    const lines = [fakeLine(3)];
    expect(applyVisibleCharsReveal(lines, { behavior: VC_GLYPHS_LTR, visibleChars: undefined, visibleRatio: 1 })[0]!.glyphs.length).toBe(3);
    expect(applyVisibleCharsReveal(lines, { behavior: VC_CHARS_AFTER_SHAPING, visibleChars: -1, visibleRatio: undefined })[0]!.glyphs.length).toBe(3);
  });

  it('VC_CHARS_BEFORE_SHAPING is a no-op here — it already ran pre-shape', () => {
    const lines = [fakeLine(3)];
    expect(applyVisibleCharsReveal(lines, { behavior: VC_CHARS_BEFORE_SHAPING, visibleChars: 0, visibleRatio: 0 })[0]!.glyphs.length).toBe(3);
  });
});

// label_settings precedence (label.cpp:186,346,759,761)

describe('labelEffectiveTextTheme', () => {
  const themeResolved = { fontSizePx: 40, color: { r: 1, g: 0, b: 0, a: 1 } };

  it('falls back to the theme-resolved values absent label_settings (happy path)', () => {
    expect(labelEffectiveTextTheme(themeResolved, null)).toEqual({
      fontSizePx: 40,
      color: { r: 1, g: 0, b: 0, a: 1 },
      lineSpacingPx: LABEL_LINE_SPACING_PX,
    });
  });

  it('a valid label_settings wins OUTRIGHT, even at its own class defaults, over a node-local theme override (error path)', () => {
    const settings = { lineSpacing: 3, fontSize: 16, fontColor: { r: 1, g: 1, b: 1, a: 1 }, outlineSize: 0, outlineColor: { r: 1, g: 1, b: 1, a: 1 }, shadowSize: 1, shadowColor: { r: 0, g: 0, b: 0, a: 0 }, shadowOffset: { x: 1, y: 1 } };
    expect(labelEffectiveTextTheme(themeResolved, settings)).toEqual({
      fontSizePx: 16,
      color: { r: 1, g: 1, b: 1, a: 1 },
      lineSpacingPx: 3,
    });
  });

  it('truncates a fractional line_spacing toward zero — a real_t assigned into a C++ int (label.cpp:346)', () => {
    const settings = { lineSpacing: 3.7, fontSize: 16, fontColor: { r: 1, g: 1, b: 1, a: 1 }, outlineSize: 0, outlineColor: { r: 1, g: 1, b: 1, a: 1 }, shadowSize: 1, shadowColor: { r: 0, g: 0, b: 0, a: 0 }, shadowOffset: { x: 1, y: 1 } };
    expect(labelEffectiveTextTheme(themeResolved, settings).lineSpacingPx).toBe(3);
  });
});

// Outline and shadow theme resolution (label.cpp:765-767, default_theme.cpp:385-391)

describe('labelOutlineTheme', () => {
  it('defaults to Label\'s own theme (outline_size=0, font_outline_color opaque black) absent everything (happy path)', () => {
    expect(labelOutlineTheme(node({}), null)).toEqual({ size: 0, color: { r: 0, g: 0, b: 0, a: 1 } });
  });

  it('reads a node-local theme_override_constants/colors override (error path)', () => {
    const n = node({}, { constants: { outline_size: 3 }, colors: { font_outline_color: { r: 1, g: 0, b: 0, a: 1 } } });
    expect(labelOutlineTheme(n, null)).toEqual({ size: 3, color: { r: 1, g: 0, b: 0, a: 1 } });
  });

  it('a valid label_settings wins OUTRIGHT over the node-local theme override (edge case)', () => {
    const n = node({}, { constants: { outline_size: 3 } });
    const settings = { lineSpacing: 3, fontSize: 16, fontColor: { r: 1, g: 1, b: 1, a: 1 }, outlineSize: 5, outlineColor: { r: 0, g: 1, b: 0, a: 1 }, shadowSize: 1, shadowColor: { r: 0, g: 0, b: 0, a: 0 }, shadowOffset: { x: 1, y: 1 } };
    expect(labelOutlineTheme(n, settings)).toEqual({ size: 5, color: { r: 0, g: 1, b: 0, a: 1 } });
  });
});

describe('labelShadowTheme', () => {
  it('defaults to Label\'s own theme (shadow_outline_size=1, transparent font_shadow_color, offset (1,1)) absent everything (happy path)', () => {
    expect(labelShadowTheme(node({}), null)).toEqual({ size: 1, color: { r: 0, g: 0, b: 0, a: 0 }, offset: { x: 1, y: 1 } });
  });

  it('reads node-local theme_override_constants/colors overrides (error path)', () => {
    const n = node(
      {},
      { constants: { shadow_outline_size: 2, shadow_offset_x: 4, shadow_offset_y: 5 }, colors: { font_shadow_color: { r: 0, g: 0, b: 0, a: 0.6 } } }
    );
    expect(labelShadowTheme(n, null)).toEqual({ size: 2, color: { r: 0, g: 0, b: 0, a: 0.6 }, offset: { x: 4, y: 5 } });
  });

  it('a valid label_settings wins OUTRIGHT over the node-local theme override (edge case)', () => {
    const n = node({}, { constants: { shadow_outline_size: 2 } });
    const settings = { lineSpacing: 3, fontSize: 16, fontColor: { r: 1, g: 1, b: 1, a: 1 }, outlineSize: 0, outlineColor: { r: 1, g: 1, b: 1, a: 1 }, shadowSize: 7, shadowColor: { r: 0, g: 0, b: 0, a: 0.9 }, shadowOffset: { x: 3, y: 3 } };
    expect(labelShadowTheme(n, settings)).toEqual({ size: 7, color: { r: 0, g: 0, b: 0, a: 0.9 }, offset: { x: 3, y: 3 } });
  });
});

// Integration: labelMinimumSize with all four properties together

describe('labelMinimumSize — lines_skipped / max_lines_visible / label_settings / visible_characters', () => {
  it('lines_skipped windows the reported height (label.cpp:344-361)', () => {
    const full = minSize(node({ text: 'A\nAB\nA', autowrapMode: 0 }), ctx());
    const skipped = minSize(node({ text: 'A\nAB\nA', autowrapMode: 0, linesSkipped: 1 }), ctx());
    // 3 lines: 3*26-3=75. Skip the first ('A'), leaving 2: 2*26-3=49.
    expect(full.y).toBe(75);
    expect(skipped.y).toBe(49);
  });

  it('max_lines_visible caps the window from the front', () => {
    const capped = minSize(node({ text: 'A\nAB\nA', autowrapMode: 0, maxLinesVisible: 1 }), ctx());
    // 1 line kept ('A'): 1*26-3=23, floored at fontHeightPx (23) either way.
    expect(capped.y).toBe(23);
  });

  it('label_settings.font_size overrides the theme font size outright, for empty text too', () => {
    const settings = { id: '1', type: 'LabelSettings', data: { id: '1', font_size: '32' } };
    const withSettings = node(
      { labelSettings: 'SubResource("1")' },
      { resources: { internalResources: [settings as never], externalResources: [] } }
    );
    // ascentPx = ceil(2189*32/2048) = 35, descentPx = ceil(600*32/2048) = 10.
    expect(minSize(withSettings, ctx()).y).toBe(45);
  });

  it('visible_characters at the default VC_CHARS_BEFORE_SHAPING truncates the shaped text itself', () => {
    const truncated = minSize(node({ text: 'AB', autowrapMode: 0, visibleCharacters: 1 }), ctx());
    // 'A' alone: ceil(1354*16/2048) = 11, narrower than 'AB's 22.
    expect(truncated.x).toBeCloseTo(11, 6);
  });
});

describe('layoutLabelLines — RTL layout (label.cpp:472-497)', () => {
  const FONT_SIZE = 16;

  function lineOfWidth(widthPx: number) {
    const layout = shapeText('Wave rift', { fontSizePx: FONT_SIZE, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 3 });
    return { ...layout, lines: layout.lines.map((l) => ({ ...l, widthPx })), widthPx };
  }

  function originAt(alignment: number, rtl: boolean): number {
    return layoutLabelLines(lineOfWidth(70), 200, 100, alignment, undefined, undefined, FONT_SIZE, { rtl })[0]!.x;
  }

  it('H_LEFT takes the trailing edge under RTL (:481-486)', () => {
    // `offset.x = int(size.width - style->get_margin(SIDE_RIGHT) - line_size.width)`, with a zero
    // margin for Label's StyleBoxEmpty: the value LTR H_RIGHT gets.
    expect(originAt(0, true)).toBe(130);
    expect(originAt(0, false)).toBe(0);
  });

  it('H_RIGHT takes style->get_offset().x — zero — under RTL (:493-497)', () => {
    expect(originAt(2, true)).toBe(0);
    expect(originAt(2, false)).toBe(130);
  });

  it('H_CENTER carries no RTL arm (:488-490)', () => {
    expect(originAt(1, true)).toBe(originAt(1, false));
  });

  // A line the jst_flags skip keeps its own width, so FILL's own arm is the
  // only thing that could move it. WORD_BOUND|SKIP_LAST_LINE without
  // DO_NOT_SKIP_SINGLE_LINE leaves this single line unstretched.
  const UNJUSTIFIED_FLAGS = JustificationFlag.WORD_BOUND | JustificationFlag.SKIP_LAST_LINE;

  it('H_FILL keeps every line at x 0 under RTL — its own arm reads the PARAGRAPH direction (:472-478)', () => {
    // `if (rtl && autowrap_mode != AUTOWRAP_OFF)` reads `shaped_text_get_inferred_direction` (:470),
    // not `rtl_layout` (:471). `text_direction` defaults to TEXT_DIRECTION_AUTO (`label.h:70`), so `:179`
    // hands the TextServer DIRECTION_AUTO and a Latin paragraph infers LTR (`text_server_adv.cpp:7241-7247`).
    const placements = layoutLabelLines(lineOfWidth(70), 200, 100, 3, undefined, UNJUSTIFIED_FLAGS, FONT_SIZE, {
      rtl: true,
    });
    expect(placements[0]!.x).toBe(0);
  });
});

describe('applyVisibleCharsReveal — RTL layout (label.cpp:779-780)', () => {
  it('VC_GLYPHS_AUTO reveals from the BACK under RTL layout', () => {
    // `trim_glyphs_rtl = ... || ((behavior == VC_GLYPHS_AUTO) && rtl_layout)`: AUTO follows the
    // layout direction, so the same budget hides the opposite end from the LTR case.
    const [l1, l2] = applyVisibleCharsReveal([fakeLine(4), fakeLine(4)], {
      behavior: VC_GLYPHS_AUTO,
      visibleChars: undefined,
      visibleRatio: 0.5,
      rtl: true,
    });
    expect(l1!.glyphs.length).toBe(0);
    expect(l2!.glyphs.length).toBe(4);
  });

  it('VC_GLYPHS_LTR and VC_GLYPHS_RTL are explicit and ignore the layout direction (:779-780)', () => {
    const ltr = applyVisibleCharsReveal([fakeLine(4), fakeLine(4)], {
      behavior: VC_GLYPHS_LTR,
      visibleChars: undefined,
      visibleRatio: 0.5,
      rtl: true,
    });
    expect(ltr[0]!.glyphs.length).toBe(4);
    const rtlBehavior = applyVisibleCharsReveal([fakeLine(4), fakeLine(4)], {
      behavior: VC_GLYPHS_RTL,
      visibleChars: undefined,
      visibleRatio: 0.5,
      rtl: false,
    });
    expect(rtlBehavior[0]!.glyphs.length).toBe(0);
  });
});
