/**
 * `optionbutton/nativeSolver.ts` vs Godot 4.6.3 (`scene/gui/option_button.cpp`,
 * `scene/theme/default_theme.cpp:212-251`). Expected numbers are hand-derived
 * from the source, NOT recomputed the way the implementation itself computes
 * them (`AGENTS.md`'s test-authoring rule) — same vendored OpenSans_SemiBold
 * metrics/atlas `button/nativeSolver.test.ts` cites.
 *
 * At font size 16 an OptionButton floors on `font->get_height()` = 23 (ascent
 * 18 + descent 5); `line_spacing` is Label's constant and OptionButton sets
 * none. 'A' `hmtx` advance width at 16px = 1354*(16/2048) = 10.578125 (the
 * CONTINUOUS source, `openSansMetrics.ts`'s `advanceWidths` — not
 * `openSansAtlas.ts`'s own atlas-bake-resolution-42 `xadvance`); 'AB' =
 * 21.15625. `textOffset` is the paragraph's own BOX TOP-LEFT — the MSDF
 * bake's own line anchor is `<TextRun>`'s to reconcile (`TextRun.test.tsx`
 * pins it).
 *
 * The OptionButton "normal"/"hover"/"pressed"/"disabled" styleboxes use
 * `2*default_margin(4)=8` horizontal / `default_margin(4)=4` vertical content
 * margins (`default_theme.cpp:212-215`, `godotDefaultTheme.ts`'s own
 * `OPTION_BUTTON_CONTENT_MARGIN_X/Y`), a DIFFERENT pair from the arrow's own
 * placement, which uses `arrow_margin` (`:249`, `round(4*scale)`) measured
 * from the FULL rect edge, not the content-margin edge — verified against
 * `pnpm ref:godot scenes/fixtures/unit-optionbutton.tscn --mode 2d`: the
 * 150x32 button's box fill (rgb(46,46,46)) extends flush to its right pixel
 * edge (probe (649,y)=46, (651,y)=76 background) while the chevron's own ink
 * sits at probe (641,y), i.e. `150 - 12(arrow) - 4(arrow_margin) = 134` in
 * from the left, NOT `150 - 12 - 8`.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext, MinimumSizeResult } from '../../../../r3f/controls/native/solverRegistry';
import type { Vec2 } from '../../../../r3f/controls/native/rect';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import { resolveButtonDrawState } from '../../../../r3f/controls/native/buttonBase';
import type { FontResource } from '../../../../resources/processing/fontProcessing';
import * as logger from '../../../../logger';
import type { OptionButtonProperties } from './types';
import {
  optionButtonMinimumSize,
  optionButtonTextTheme,
  resolveOptionButtonSelectedText,
  layoutOptionButtonContent,
  OPTION_BUTTON_DEFAULT_FONT_COLOR,
  OPTION_BUTTON_DEFAULT_DISABLED_FONT_COLOR,
  OPTION_BUTTON_ARROW_NATURAL_SIZE,
  OPTION_BUTTON_THEME_FONT_KEY,
} from './nativeSolver';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

const A_ADVANCE = 1354 * (16 / 2048); // 10.578125
// 'B's hmtx advance width is 1350 design units, DIFFERENT from 'A's 1354 — the
// two only coincided at the OLD atlas-bake-resolution-42 xadvance (both
// rounded to the integer 28), not a fact about the font.
const AB_WIDTH = (1354 + 1350) * (16 / 2048); // 21.125
const FONT_HEIGHT = 23;

function node(props: Partial<OptionButtonProperties>): SolveNode {
  return {
    ...solveNode(),
    path: 'O',
    node: {
      name: 'O',
      type: 'OptionButton',
      children: [],
      properties: { name: 'O', ...props } as OptionButtonProperties,
    },
  };
}

/** `optionButtonMinimumSize`'s `size` half only — see `button/nativeSolver.test.ts`'s own `minSize` for why the union is here at all. */
function minSize(result: Vec2 | MinimumSizeResult): Vec2 {
  return 'size' in result ? result.size : result;
}

function ctx(withMeasurer = true): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText: withMeasurer ? measureText : null,
    combinedMinimumSize: () => ({ x: 0, y: 0 }),
  };
}

describe('OPTION_BUTTON_ARROW_NATURAL_SIZE', () => {
  it('is 12x12 — option_button_arrow.svg\'s own authored size, never clamped by icon_max_width', () => {
    expect(OPTION_BUTTON_ARROW_NATURAL_SIZE).toEqual({ x: 12, y: 12 });
  });
});

describe('theme.widgets.optionButton', () => {
  it('uses 8px horizontal / 4px vertical content margins (2*default_margin / default_margin), identical for normal+disabled', () => {
    const boxes = nativeTheme(1).widgets.optionButton;
    expect(boxes.normal.contentMargin).toEqual({ left: 8, top: 4, right: 8, bottom: 4 });
    expect(boxes.disabled.contentMargin).toEqual({ left: 8, top: 4, right: 8, bottom: 4 });
  });

  it('normal fill is style_normal_color (0.1,0.1,0.1,0.6); disabled is style_disabled_color (0.1,0.1,0.1,0.3)', () => {
    const boxes = nativeTheme(1).widgets.optionButton;
    expect(boxes.normal.bgColor).toEqual({ r: 0.1, g: 0.1, b: 0.1, a: 0.6 });
    expect(boxes.disabled.bgColor).toEqual({ r: 0.1, g: 0.1, b: 0.1, a: 0.3 });
  });
});

describe('resolveOptionButtonSelectedText (parity with Component.tsx\'s own bounds-guarded lookup)', () => {
  it('resolves items[selected].text when selected is a valid index', () => {
    const items = [{ text: 'Easy', id: 0 }, { text: 'Normal', id: 1 }, { text: 'Hard', id: 2 }];
    expect(resolveOptionButtonSelectedText({ items, selected: 1 } as OptionButtonProperties)).toBe('Normal');
  });

  it('is empty string when selected is out of range', () => {
    const items = [{ text: 'Easy', id: 0 }];
    expect(resolveOptionButtonSelectedText({ items, selected: 5 } as OptionButtonProperties)).toBe('');
  });

  it('is empty string when selected is absent or items is absent', () => {
    expect(resolveOptionButtonSelectedText({} as OptionButtonProperties)).toBe('');
    expect(resolveOptionButtonSelectedText({ selected: 0 } as OptionButtonProperties)).toBe('');
  });
});

describe('optionButtonMinimumSize (option_button.cpp:50-68, fit_to_longest_item=true, the engine default)', () => {
  it('floors at margin + arrow contribution with zero items (no text at all)', () => {
    // width = marginX(16) + text(0) + arrow(12) + h_separation(4) = 32.
    // height = marginY(8) + max(text(0), arrow(12)) = 20.
    expect(optionButtonMinimumSize(node({}), ctx())).toEqual({ x: 16 + 12 + 4, y: 8 + 12 });
  });

  it('uses the WIDEST item\'s text, not the selected one\'s, for the width floor', () => {
    const items = [
      { text: 'A', id: 0 }, // 10.578125 wide
      { text: 'AB', id: 1 }, // 21.125 wide — the widest
    ];
    const result = minSize(optionButtonMinimumSize(node({ items, selected: 0 }), ctx()));
    // width = 16 (margin) + 21.125 (widest item) + 12 (arrow) + 4 (h_separation).
    expect(result.x).toBeCloseTo(16 + AB_WIDTH + 12 + 4, 6);
  });

  it('height is 8 (marginY) + max(tallest item text height, arrow height 12) — the 23px font height wins', () => {
    const items = [{ text: 'AB', id: 0 }];
    const result = minSize(optionButtonMinimumSize(node({ items, selected: 0 }), ctx()));
    expect(result.y).toBe(8 + FONT_HEIGHT);
  });

  it('treats an absent measurer as "no item contributes text width" — margin+arrow floor still returns', () => {
    const items = [{ text: 'AB', id: 0 }];
    const result = optionButtonMinimumSize(node({ items, selected: 0 }), ctx(false));
    expect(result).toEqual({ x: 16 + 12 + 4, y: 8 + 12 });
  });

  it('h_separation theme_override_constants wins over the theme default', () => {
    const items = [{ text: 'A', id: 0 }];
    const result = minSize(
      optionButtonMinimumSize(node({ items, selected: 0, themeOverrideConstants: { h_separation: 10 } }), ctx())
    );
    expect(result.x).toBeCloseTo(16 + A_ADVANCE + 12 + 10, 6);
  });

  it('uses the DISABLED stylebox margin once disabled=true (same margins in the default theme, so no numeric change)', () => {
    const result = optionButtonMinimumSize(node({ disabled: true }), ctx());
    expect(result).toEqual({ x: 16 + 12 + 4, y: 8 + 12 });
  });
});

describe('optionButtonTextTheme', () => {
  it('resolves control_font_color for the normal state', () => {
    expect(optionButtonTextTheme(node({}), {} as OptionButtonProperties, 'normal', ctx())).toEqual({
      fontSizePx: 16,
      color: OPTION_BUTTON_DEFAULT_FONT_COLOR,
    });
  });

  it('resolves control_font_disabled_color for the disabled state', () => {
    expect(optionButtonTextTheme(node({}), {} as OptionButtonProperties, 'disabled', ctx()).color).toEqual(
      OPTION_BUTTON_DEFAULT_DISABLED_FONT_COLOR
    );
  });

  it('a theme_override_colors/font_color override wins over the default', () => {
    const props: OptionButtonProperties = {
      name: 'O',
      themeOverrideColors: { font_color: { r: 1, g: 0, b: 0, a: 1 } },
    };
    expect(optionButtonTextTheme(node(props), props, 'normal', ctx()).color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });
});

describe('resolveButtonDrawState reused for OptionButton (no CheckBox-style pressed complication)', () => {
  it('the popup being closed means OptionButton never draws DRAW_PRESSED regardless of `selected`', () => {
    expect(resolveButtonDrawState(false)).toBe('normal');
    expect(resolveButtonDrawState(true)).toBe('disabled');
  });
});

describe('layoutOptionButtonContent (option_button.cpp:95-135 + button.cpp:247-260,444-456)', () => {
  const BASE = {
    rectSize: { x: 150, y: 32 },
    styleMargin: { left: 8, top: 4, right: 8, bottom: 4 },
    arrowSize: { x: 12, y: 12 },
    arrowMargin: 4,
    textNaturalSize: { x: 60, y: 26 },
  };

  it('the arrow sits at (rect.w - arrowSize.w - arrowMargin), NOT the content-margin edge', () => {
    const { arrowRect } = layoutOptionButtonContent(BASE);
    // x = 150 - 12 - 4 = 134.
    expect(arrowRect.x).toBe(134);
  });

  it('the arrow is vertically centred within the FULL rect height (not the content box)', () => {
    const { arrowRect } = layoutOptionButtonContent(BASE);
    // floor(abs((32-12)/2)) = 10.
    expect(arrowRect.y).toBe(10);
  });

  it('text starts flush at the LEFT content margin (OptionButton sets text_alignment LEFT)', () => {
    const { textOffset } = layoutOptionButtonContent(BASE);
    expect(textOffset.x).toBe(8);
  });

  it('text is vertically centred within the content box (margins symmetric here)', () => {
    const { textOffset } = layoutOptionButtonContent(BASE);
    // customElementHeight = 32-8=24; y = (24-26)/2 + 4 = -1+4 = 3.
    expect(textOffset.y).toBeCloseTo(3, 10);
  });

  it("floors a half-pixel centring remainder DOWN, matching Button's own text_ofs.y (never floored in the source itself, only per-glyph — text_server_adv.cpp:4083) — the ACTUAL 'Normal' item at font size 16 (ascent 18 + descent 5 = 23)", () => {
    // customElementHeight = 32-8=24; (24-23)/2=0.5; +styleMargin.top(4)=4.5 -> floor 4.
    const { textOffset } = layoutOptionButtonContent({ ...BASE, textNaturalSize: { x: 60, y: 23 } });
    expect(textOffset.y).toBe(4);
  });
});

describe(`optionButtonMinimumSize — resolves this OptionButton's own theme font key ("${OPTION_BUTTON_THEME_FONT_KEY}", default_theme.cpp:237)`, () => {
  // See `resolveNodeFontMetrics.test.ts`'s own doc for why an UNRESOLVABLE
  // font's warn is the observable proof here, not a resolved FontMetrics value.
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('a theme_override_fonts/font local override is fed to the text engine (resolved unconditionally, before the per-item measurement loop)', () => {
    const systemFont: FontResource = { kind: 'system', fontNames: ['sans-serif'], properties: {} };
    const n: SolveNode = { ...node({}), fontOverrides: { [OPTION_BUTTON_THEME_FONT_KEY]: systemFont } };
    optionButtonMinimumSize(n, ctx());
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('a local override under a different key is not consulted', () => {
    const systemFont: FontResource = { kind: 'system', fontNames: ['sans-serif'], properties: {} };
    const n: SolveNode = { ...node({}), fontOverrides: { normal_font: systemFont } };
    optionButtonMinimumSize(n, ctx());
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
