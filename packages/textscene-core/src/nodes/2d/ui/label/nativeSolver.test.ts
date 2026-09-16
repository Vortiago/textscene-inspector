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
 * Per-glyph `hmtx` advance width, design units (`openSansMetrics.ts`'s
 * `advanceWidths`, unitsPerEm 2048 — the CONTINUOUS source, not
 * `openSansAtlas.ts`'s own atlas-bake-resolution-42 `xadvance`, which is
 * itself INTEGER-rounded at that resolution before this repo's bake script
 * ever reads it back): 'A' = 1354.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { controlSolverRegistry, type SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { createSolveContext, solveControlTree } from '../../../../r3f/controls/native/controlRectSolver';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import { panelContainerLayout, panelContainerMinimumSize } from '../panelcontainer/nativeSolver';
import { makeBoxContainerLayout, makeBoxContainerMinimumSize } from '../shared/boxContainerSolver';
import type { LabelProperties } from './types';
import { shapeText, AutowrapMode, type TextLayoutResult, type TextLineLayout } from '../../../../r3f/controls/native/text/textLayout';
import {
  labelMinimumSize,
  labelShapingWidthPx,
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

/** `labelMinimumSize`'s `size` half only — every test below except the dedicated `meta` describe cares only about this, exactly like before `{ size, meta }` existed. */
function minSize(...args: Parameters<typeof labelMinimumSize>): Vec2 {
  const result = labelMinimumSize(...args);
  return 'size' in result ? result.size : result;
}

/** `labelMinimumSize`'s `meta` half — the shaped `TextLayoutResult` (autowrap OFF only), or `undefined`. */
function minMeta(...args: Parameters<typeof labelMinimumSize>): unknown {
  const result = labelMinimumSize(...args);
  return 'meta' in result ? result.meta : undefined;
}

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

// 'A's hmtx advance width is 1354 design units, 'B's is 1350 — a DIFFERENT
// glyph, so 'AB's width is their SUM, not `A_ADVANCE * 2` (the two only
// coincided at the OLD atlas-bake-resolution-42 xadvance, where both rounded
// to the same integer 28 — a coincidence of that rounding, not a fact about
// the font).
const AB_WIDTH = (1354 + 1350) * (16 / 2048); // 21.125
// The SHAPED size of 'AB' — `TS->shaped_text_get_size(...).x` ceils the pen
// advance to a whole pixel (`text_server_adv.cpp:7524-7537`), and every
// minimum size below is built from that, not from the fractional sum.
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
    // width floors to the WIDER of the two unwrapped lines ('AB'), not 'A'.
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
    // Same source text, only `uppercase` differs — 'ab' -> lowercase glyphs
    // (narrower), 'AB' -> uppercase glyphs (wider, this atlas's own advances).
    const lower = minSize(node({ text: 'ab', autowrapMode: 0 }), ctx());
    const upper = minSize(node({ text: 'ab', uppercase: true, autowrapMode: 0 }), ctx());
    expect(upper.x).toBeCloseTo(AB_SHAPED_WIDTH, 6);
    expect(upper.x).toBeGreaterThan(lower.x);
  });
});

/**
 * Godot 4.6.3, `scenes/fixtures/complex-2d-gui.tscn` in a 1152x648 SubViewport
 * after `scripts/godot-ref/run.mjs`'s own 6-frame settle, reading
 * `Control.get_combined_minimum_size()` per node:
 *
 *   Frame/Shell/LeftColumn/HeaderCard/HeaderRow/HeaderText/Subtitle
 *     rect = (0, 41, 640, 49)   min = (1, 49)
 *   Frame/Shell/RightColumn/StatusCard/StatusRow/StatusColumn/SquadNote
 *     rect = (0, 102, 282, 49)  min = (1, 49)
 *
 * Both are autowrapped Labels wrapping to TWO lines, and both report the
 * two-line height (2*26 - 3 = 49) as their minimum — NOT a one-line 23. The
 * expected numbers below are that engine reading, at the same font size 16.
 */
describe('labelMinimumSize — autowrap ON reports the WRAPPED height once a prior pass has resolved its width', () => {
  const SUBTITLE = 'Changes apply to the active deployment only, and are discarded when the corridor closes.';

  /** A `SolveContext` whose `tentativeRect` answers for every node — a completed prior pass. */
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

  it('still attaches NO meta on the second pass — the tentative width is not necessarily the final one', () => {
    expect(minMeta(node({ text: SUBTITLE, autowrapMode: 2 }), ctxAt(640))).toBeUndefined();
  });

  it('autowrap OFF ignores tentativeRect entirely — its own width floor is the unwrapped line, on every pass', () => {
    const off = labelMinimumSize(node({ text: 'AB', autowrapMode: 0 }), ctxAt(4));
    expect('size' in off ? off.size.y : off.y).toBe(23);
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
 * The whole point of the second pass, end to end: an autowrapped Label's
 * WRAPPED height has to reach the container that decided its width, or the
 * container believes a two-line Label fits in one line's worth of space and the
 * overflow is drawn outside it.
 *
 * The subtree is `complex-2d-gui.tscn`'s header card, cut to the two nodes that
 * carry the effect (Godot's own numbers for the full card are in the
 * `autowrap ON reports the WRAPPED height` block above):
 *
 *   PanelContainer  content margins 14/12/14/12  ->  min height 114
 *     VBoxContainer separation 2                 ->  min height  90
 *       Label  font_size 28, no wrap             ->  min height  39
 *       Label  autowrap WORD, box 640            ->  min height  49
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

  /**
   * `PanelContainer > VBoxContainer > [unwrapped Label, wrapped Label]`, the
   * shape both measured scenes reduce to. `margin`/`separation`/the two Labels
   * are the only things that differ between them.
   */
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
      // A local theme_override_constants/* now reaches `separationOf` through
      // `n.constants` (the walker folds it in unconditionally), not props.
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
   * `scenes/fixtures/unit-label-autowrap-in-container.tscn`, the single-variable
   * scene for this. Godot 4.6.3, same 1152x648 SubViewport and 6-frame settle:
   *
   *   Card    rect (64, 64, 400, 130)  min (189, 130)
   *   Column  rect (12, 12, 376, 106)  min (165, 106)
   *   Heading rect (0, 0, 376, 23)     min (165, 23)   1 line
   *   Body    rect (0, 31, 376, 75)    min (1, 75)     3 lines
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

describe('labelMinimumSize — meta carries the shaped TextLayoutResult when autowrap is OFF (ITEM C: no re-shape in the painter)', () => {
  it('attaches the shaped layout as meta when autowrap is OFF and there is text', () => {
    const meta = minMeta(node({ text: 'AB', autowrapMode: 0 }), ctx()) as TextLayoutResult;
    expect(meta.widthPx).toBeCloseTo(AB_WIDTH, 6);
    expect(meta.lines).toHaveLength(1);
  });

  it('the meta layout is uppercase-transformed exactly like the size half', () => {
    const meta = minMeta(node({ text: 'ab', uppercase: true, autowrapMode: 0 }), ctx()) as TextLayoutResult;
    // Trailing ZWSP is Label's own per-paragraph terminator (`label.cpp:164`).
    expect(meta.lines[0]?.text).toBe(`AB${'\u200b'}`);
  });

  it('attaches NO meta when autowrap is ON — the unwrapped shape behind the height substitute is not what a box-constrained painter needs', () => {
    expect(minMeta(node({ text: 'AB', autowrapMode: 2 }), ctx())).toBeUndefined();
  });

  it('attaches no meta for empty text or an absent measurer', () => {
    expect(minMeta(node({}), ctx())).toBeUndefined();
    expect(minMeta(node({ text: 'AB', autowrapMode: 0 }), ctx(false))).toBeUndefined();
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

  // `Label::get_layout_data` declares `int vbegin = 0, vsep = 0;` and assigns
  // the floating-point alignment expressions into them, so both land on whole
  // pixels with C++'s truncation-toward-zero. Expected rows below come from a
  // Godot 4.6.3 render of a Label whose box is 100px tall around one 23px line
  // of 16px text: its glyphs land on the SAME row as the identical Label in a
  // 99px box, which only a truncated offset can produce.
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
 * `Label::_get_line_rect`'s x (`label.cpp:487-512`) measured in Godot 4.6.3
 * rather than derived. One Label per row, `text = "Wave rift"` at the default
 * font size 16, whose single shaped line is exactly 70.0 px wide; the box width
 * comes from the node's own offsets, and the origin is read back through the
 * public `Label.get_character_bounds(0).position.x`, which `label.cpp:935-936`
 * seeds from `_get_line_rect(p, i).position.x` with a zero glyph offset for the
 * first character.
 *
 * `theme_cache.normal_style` is Label's `StyleBoxEmpty` (`default_theme.cpp:379`),
 * so both `style->get_offset().x` and `style->get_margin(SIDE_RIGHT)` are 0 and
 * drop out of every branch below.
 *
 *   H_CENTER, `int(size.width - line_size.width) / 2`
 *     box 200    -> 65     box 202   -> 66     box 20    -> -25
 *     box 200.5  -> 65     box 203   -> 66     box 20.5  -> -24
 *     box 201    -> 65     box 204   -> 67     box 21    -> -24
 *     box 201.5  -> 65     box 260.25 -> 95    box 23    -> -23
 *
 *   H_RIGHT, `int(size.width - margin - line_size.width)`
 *     box 200    -> 130    box 202   -> 132    box 20    -> -50
 *     box 200.5  -> 130    box 203   -> 133    box 20.5  -> -49
 *     box 201    -> 131    box 260.25 -> 190   box 21.5  -> -48
 *     box 201.5  -> 131    box 260.75 -> 190   box 25    -> -45
 *
 * The negative rows come from `clip_text = true`, which drops Label's own
 * width floor to 1 (`label.cpp:997-998`) so the box can be narrower than its
 * unwrapped line — the only configuration in which `size.width -
 * line_size.width` goes negative, and the only one that separates a C++ `int`
 * conversion from a floor.
 *
 * Godot's H_CENTER rounds TWICE (an `int` conversion, then C++ integer
 * division). Measured, that is indistinguishable from one truncation of the
 * halved difference at every width above, including the odd ones — box 201
 * (difference 131) and box 21 (difference -49) both land where a single
 * `Math.trunc(d / 2)` does. The transcription below keeps both steps because
 * that is what the source writes, not because a case has been found where they
 * disagree.
 */
describe('layoutLabelLines — horizontal origins vs Godot 4.6.3 (label.cpp:487-512)', () => {
  const FONT_SIZE = 16;
  const GODOT_LINE_WIDTH_PX = 70;

  /**
   * A one-line layout whose width is pinned to the engine's own measurement of
   * `"Wave rift"`, so this compares the PLACEMENT formula against Godot's
   * numbers and not the MSDF atlas's advances against FreeType's.
   */
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
   * `_shape` justifies with the same `int width` it broke lines at
   * (`label.cpp:297,331`), while `_get_line_rect` aligns against the raw
   * `get_size()` — two different widths, and both measured. Godot 4.6.3, a
   * `HORIZONTAL_ALIGNMENT_FILL` Label wrapping at three box widths, walking
   * `get_character_bounds` across the first line and taking the last
   * character's right edge:
   *
   *   box 300.0 -> 300.0    box 300.7 -> 300.0    box 301.4 -> 301.0
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
  // See `resolveNodeFontMetrics.test.ts`'s own doc for why an UNRESOLVABLE
  // font's warn is the observable proof here, not a resolved FontMetrics value.
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
 * The whole-pixel shaped extent, end to end through `labelMinimumSize`.
 *
 * `Label::_shape` folds `TS->shaped_text_get_size(line_rid).x` into
 * `minsize.width` (`label.cpp:252-257`), and that accessor returns
 * `Size2(sd->width, ...).ceil()` (`text_server_adv.cpp:7524-7537`) — so a
 * Label's own minimum width is a WHOLE number however fractional its pen
 * advances are. Godot 4.6.3, `scenes/fixtures/complex-2d-gui.tscn` in a
 * 1152x648 SubViewport, `Control.get_combined_minimum_size()` per node:
 *
 *   MasterLabel      "Master volume"     min.x = 116
 *   MusicLabel       "Music bed"         min.x = 79
 *   CallsignLabel    "Callsign"          min.x = 60
 *   SubtitlesLabel   "Comms"             min.x = 59
 *   DifficultyLabel  "Threat level"      min.x = 92
 *   Title            "FIELD OPERATIONS"  min.x = 257  (font_size 28)
 *
 * The same engine's `get_string_size` on those strings returns 116/79/60/59
 * while its own per-character advance sums are 115.875/78.453125/59.671875/
 * 58.234375 — the ceil, not the advances, is what makes them integers.
 *
 * These are the numbers a GridContainer's `Size2i` column bookkeeping
 * (`grid_container.cpp:290`) truncates: a minimum a fraction below the whole
 * pixel truncates a whole pixel DOWN, and every column past it opens one
 * pixel early.
 */
describe('labelMinimumSize — the shaped extent is ceiled (text_server_adv.cpp:7524-7537)', () => {
  it.each([
    ['Master volume', 116],
    ['Music bed', 79],
    ['Callsign', 60],
    ['Comms', 59],
    // 'l' (571 design units) and 'T' (1157) both have ODD advances, which
    // FreeType's 26.6 grid rounds UP where a continuous scale leaves them
    // between two steps: the pen sum is 91.03125, not the 91.0 flat scaling
    // gives, and only the former ceils to Godot's own 92.
    ['Threat level', 92],
  ])('%p floors this Label at Godot\'s own whole-pixel minimum width %p', (text, expected) => {
    expect(minSize(node({ text, autowrapMode: 0 }), ctx()).x).toBe(expected);
  });

  it('a font_size above SUBPIXEL_POSITIONING_ONE_HALF_MAX_SIZE floors on WHOLE-pixel advances, which is NARROWER than the fractional sum', () => {
    const n = node({ text: 'FIELD OPERATIONS', autowrapMode: 0, themeOverrideFontSizes: { font_size: 28 } });
    // Godot rounds each advance to a whole pixel with the remainder carried
    // (text_server_adv.cpp:7079-7084), summing to exactly 257 — where the
    // unrounded 26.6 advances sum to 257.140625 and a flat scale of the hmtx
    // table to 257.099609375, both of which would ceil to 258.
    expect(minSize(n, ctx()).x).toBe(257);
  });

  it("is strictly wider than the raw pen advance whenever that advance is fractional — the fraction is what a container's Size2i truncation would otherwise lose", () => {
    const raw = shapeText('Master volume', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.OFF,
      lineSpacingPx: 3,
    }).widthPx;
    // Real Godot 4.6.3 reports the same fractional extent for this string:
    // `ThemeDB.fallback_font.get_string_size("Master volume",
    // HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x` is 116, and summing the same
    // font's own `get_char_size(c, 16).x` over the characters gives 115.875.
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

// --- lines_skipped / max_lines_visible ---------------------------------------

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

// --- visible_characters / visible_characters_behavior ------------------------

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

// --- label_settings precedence (label.cpp:186,346,759,761) -------------------

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

// --- Outline/shadow theme resolution (label.cpp:765-767, default_theme.cpp:385-391) ---

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

// --- Integration: labelMinimumSize honouring all four properties together ---

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
