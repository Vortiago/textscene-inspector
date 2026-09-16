/**
 * `lineEditMinimumSize` vs Godot 4.6.3 (`LineEdit::get_minimum_size`,
 * `scene/gui/line_edit.cpp:2443-2477`). Expected numbers are hand-derived
 * from the vendored OpenSans_SemiBold metrics/atlas (`unitsPerEm=2048`,
 * `ascent=2189`, `descent=600`; `hmtx` advance width for 'W' is 1936 design
 * units — `openSansMetrics.ts`'s CONTINUOUS `advanceWidths`, not
 * `openSansAtlas.ts`'s own atlas-bake-resolution-42 `xadvance`) and the
 * default theme's LineEdit margin (`content_margin` = `round(4*scale)` = 4 at
 * scale 1, all four sides, from `make_flat_stylebox`'s own default —
 * `nativeTheme.ts`'s `widgets.lineEdit`) — an independent worked example,
 * never the implementation's own output.
 *
 * At font size 16: fontHeightPx (ceil(ascent)+ceil(descent), NO line_spacing
 * — LineEdit sets none, unlike Label/Button) = ceil(2189*16/2048) +
 * ceil(600*16/2048) = 18 + 5 = 23. 'W' advance at 16px = 1936*(16/2048) = 15.125.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext, MinimumSizeResult } from '../../../../r3f/controls/native/solverRegistry';
import type { Vec2 } from '../../../../r3f/controls/native/rect';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { FontResource } from '../../../../resources/fonts/font/types';
import * as logger from '../../../../logger';
import type { LineEditProperties } from './types';
import {
  lineEditMinimumSize,
  lineEditTextTheme,
  resolveLineEditTextState,
  layoutLineEditContent,
  LINE_EDIT_DEFAULT_FONT_COLOR,
  LINE_EDIT_DEFAULT_UNEDITABLE_COLOR,
  LINE_EDIT_DEFAULT_PLACEHOLDER_COLOR,
  LINE_EDIT_THEME_FONT_KEY,
} from './nativeSolver';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

const W_ADVANCE = 1936 * (16 / 2048); // 15.125
const FONT_HEIGHT = 23; // ceil(2189*16/2048) + ceil(600*16/2048)

/** `lineEditMinimumSize` is a `MinimumSizeFn`, so it's typed to allow the `MinimumSizeResult` shape even though this implementation only ever returns a bare `Vec2` — narrow to the size for the tests that read `.x`/`.y`. */
function size(result: Vec2 | MinimumSizeResult): Vec2 {
  return 'x' in result ? result : result.size;
}

function node(props: Partial<LineEditProperties>, styleBoxes: Record<string, StyleBoxFlatData> = {}): SolveNode {
  return {
    ...solveNode(),
    path: 'L',
    node: { name: 'L', type: 'LineEdit', children: [], properties: { name: 'L', ...props } as LineEditProperties },
    styleBoxes,
    // A local theme_override_colors/* reaches `resolveTextTheme` through
    // `n.colors` (the walker folds it in unconditionally), not props.
    colors: props.themeOverrideColors ?? {},
  };
}

function ctx(withMeasurer = true): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText: withMeasurer ? measureText : null,
    combinedMinimumSize: () => ({ x: 0, y: 0 }),
  };
}

function flatStyleBox(overrides: Partial<StyleBoxFlatData> = {}): StyleBoxFlatData {
  return {
    bgColor: { r: 0, g: 0, b: 0, a: 1 },
    borderColor: { r: 0, g: 0, b: 0, a: 1 },
    borderWidth: { left: 0, top: 0, right: 0, bottom: 0 },
    cornerRadius: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
    expandMargin: { left: 0, top: 0, right: 0, bottom: 0 },
    contentMargin: { left: 4, top: 4, right: 4, bottom: 4 },
    drawCenter: true,
    borderBlend: false,
    antiAliased: true,
    aaSize: 1,
    cornerDetail: 8,
    skew: { x: 0, y: 0 },
    shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
    shadowSize: 0,
    shadowOffset: { x: 0, y: 0 },
    ...overrides,
  };
}

describe('lineEditMinimumSize — StyleBox content margins + minimum_character_width*W-advance + font height', () => {
  it('is exactly minimum_character_width(4)*W-advance + margin(8), and fontHeight(23) + margin(8), by default', () => {
    const result = size(lineEditMinimumSize(node({}), ctx()));
    expect(result.x).toBeCloseTo(8 + 4 * W_ADVANCE, 6);
    expect(result.y).toBe(8 + FONT_HEIGHT);
  });

  it('treats an absent measurer as "the W-advance contributes nothing", NOT the whole function failing — margin + font height alone still return', () => {
    const result = lineEditMinimumSize(node({}), ctx(false));
    expect(result).toEqual({ x: 8, y: 8 + FONT_HEIGHT });
  });

  it('reads a resolved theme_override_styles/normal content margin instead of the default theme', () => {
    const wide = flatStyleBox({ contentMargin: { left: 14, top: 6, right: 14, bottom: 6 } });
    const result = size(lineEditMinimumSize(node({}, { normal: wide }), ctx()));
    expect(result.x).toBeCloseTo(28 + 4 * W_ADVANCE, 6);
    expect(result.y).toBe(12 + FONT_HEIGHT);
  });

  it(
    'takes the MAX of BOTH normal and read_only styles\' margins, regardless of the node\'s OWN editable state ' +
      '(`theme_cache.normal->get_minimum_size().max(theme_cache.read_only->get_minimum_size())`, line_edit.cpp:2475)',
    () => {
      const wideReadOnly = flatStyleBox({ contentMargin: { left: 20, top: 10, right: 20, bottom: 10 } });
      // editable defaults true (uses "normal" for DRAWING), but min-size still floors against read_only's wider box.
      const result = size(lineEditMinimumSize(node({}, { read_only: wideReadOnly }), ctx()));
      expect(result.x).toBeCloseTo(40 + 4 * W_ADVANCE, 6);
      expect(result.y).toBe(20 + FONT_HEIGHT);
    }
  );

  it('is unaffected by the node\'s own text/placeholder content — LineEdit floors width on minimum_character_width, not on what is typed', () => {
    const withLongText = lineEditMinimumSize(node({ text: 'a much longer string than four characters' }), ctx());
    const empty = lineEditMinimumSize(node({}), ctx());
    expect(withLongText).toEqual(empty);
  });

  it('a theme_override_font_sizes/font_size override changes BOTH the W-advance and the font height', () => {
    const result = size(lineEditMinimumSize(node({ themeOverrideFontSizes: { font_size: 32 } }), ctx()));
    // 'W' hmtx advance 1936 design units quantizes to 1936/64 = 30.25 at size
    // 32, but 32 is above SUBPIXEL_POSITIONING_ONE_HALF_MAX_SIZE, so the
    // engine reports a WHOLE-pixel advance — `_font_get_glyph_advance`'s own
    // `.round()` branch, text_server_adv.cpp:3282-3283. Confirmed against
    // real Godot 4.6.3: `ThemeDB.fallback_font.get_char_size(0x57, 32).x` is
    // 30.0 and a bare LineEdit at `font_size` 32 has minimum size (128, 53).
    const wAdvance32 = 30;
    const fontHeight32 = Math.ceil(2189 * (32 / 2048)) + Math.ceil(600 * (32 / 2048));
    expect(result.x).toBe(8 + 4 * wAdvance32);
    expect(result.y).toBe(8 + fontHeight32);
  });
});

describe('resolveLineEditTextState — which theme_override_colors key/default this node reads', () => {
  it('is "placeholder" whenever the displayed string IS the placeholder, regardless of editable', () => {
    expect(resolveLineEditTextState(true, true)).toBe('placeholder');
    expect(resolveLineEditTextState(false, true)).toBe('placeholder');
  });

  it('is "read_only" for real text on a non-editable field', () => {
    expect(resolveLineEditTextState(false, false)).toBe('read_only');
  });

  it('is "normal" for real text on an editable field (the default)', () => {
    expect(resolveLineEditTextState(true, false)).toBe('normal');
    expect(resolveLineEditTextState(undefined, false)).toBe('normal');
  });
});

describe('lineEditTextTheme — font_color / font_uneditable_color / font_placeholder_color key mapping', () => {
  it('resolves control_font_color (0.875, opaque) for the normal state', () => {
    expect(lineEditTextTheme(node({}), {} as LineEditProperties, 'normal', ctx())).toEqual({
      fontSizePx: 16,
      color: LINE_EDIT_DEFAULT_FONT_COLOR,
    });
    expect(LINE_EDIT_DEFAULT_FONT_COLOR).toEqual({ r: 0.875, g: 0.875, b: 0.875, a: 1 });
  });

  it('resolves control_font_disabled_color (alpha 0.5) for font_uneditable_color, the read_only state', () => {
    expect(lineEditTextTheme(node({}), {} as LineEditProperties, 'read_only', ctx()).color).toEqual(
      LINE_EDIT_DEFAULT_UNEDITABLE_COLOR
    );
    expect(LINE_EDIT_DEFAULT_UNEDITABLE_COLOR).toEqual({ r: 0.875, g: 0.875, b: 0.875, a: 0.5 });
  });

  it('resolves control_font_placeholder_color (alpha 0.6) for the placeholder state', () => {
    expect(lineEditTextTheme(node({}), {} as LineEditProperties, 'placeholder', ctx()).color).toEqual(
      LINE_EDIT_DEFAULT_PLACEHOLDER_COLOR
    );
    expect(LINE_EDIT_DEFAULT_PLACEHOLDER_COLOR).toEqual({ r: 0.875, g: 0.875, b: 0.875, a: 0.6 });
  });

  it('a theme_override_colors/font_placeholder_color override wins over the default', () => {
    const props = {
      themeOverrideColors: { font_placeholder_color: { r: 1, g: 0, b: 0, a: 1 } },
    } as unknown as LineEditProperties;
    expect(lineEditTextTheme(node(props), props, 'placeholder', ctx()).color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('theme_override_font_sizes/font_size overrides the theme default for EVERY state', () => {
    const props = { themeOverrideFontSizes: { font_size: 24 } } as unknown as LineEditProperties;
    expect(lineEditTextTheme(node(props), props, 'normal', ctx()).fontSizePx).toBe(24);
    expect(lineEditTextTheme(node(props), props, 'read_only', ctx()).fontSizePx).toBe(24);
    expect(lineEditTextTheme(node(props), props, 'placeholder', ctx()).fontSizePx).toBe(24);
  });
});

describe('layoutLineEditContent — NOTIFICATION_DRAW content rect + x_ofs/y_ofs (line_edit.cpp:1392-1427)', () => {
  const MARGIN = { left: 4, top: 4, right: 4, bottom: 4 };

  it('LEFT (default): x_ofs is exactly the left margin, content rect is the rect inset by all four margins', () => {
    const result = layoutLineEditContent({
      rectSize: { x: 200, y: 30 },
      styleMargin: MARGIN,
      alignment: 0,
      textWidthPx: 50,
      textHeightPx: 23,
    });
    expect(result.contentRect).toEqual({ x: 4, y: 4, w: 192, h: 22 });
    expect(result.textOffset.x).toBe(4);
    // y_ofs = style->get_offset().y + (y_area - text_height) / 2 (line_edit.cpp:1427), truncated
    // toward zero on assignment to `int y_ofs`: trunc(4 + (22 - 23) / 2) = trunc(3.5) = 3.
    expect(result.textOffset.y).toBe(3);
  });

  it('y_ofs includes the ACTIVE style\'s own TOP margin — `style->get_offset().y` (style_box.cpp:87-89) — not just the text/area centring term', () => {
    // A margin-heavy style shifts y_ofs down by (its own top margin), even though the
    // centring term (y_area - text_height)/2 is identical to the LEFT case above.
    const result = layoutLineEditContent({
      rectSize: { x: 200, y: 38 },
      styleMargin: { left: 4, top: 12, right: 4, bottom: 4 },
      alignment: 0,
      textWidthPx: 50,
      textHeightPx: 23,
    });
    // y_area = trunc(38 - 12 - 4) = 22; y_ofs = trunc(12 + (22 - 23) / 2) = trunc(11.5) = 11.
    expect(result.textOffset.y).toBe(11);
  });

  it('FILL shares LEFT\'s branch exactly (line_edit.cpp:1398-1399 falls through the same case)', () => {
    const left = layoutLineEditContent({
      rectSize: { x: 200, y: 30 },
      styleMargin: MARGIN,
      alignment: 0,
      textWidthPx: 50,
      textHeightPx: 23,
    });
    const fill = layoutLineEditContent({
      rectSize: { x: 200, y: 30 },
      styleMargin: MARGIN,
      alignment: 3,
      textWidthPx: 50,
      textHeightPx: 23,
    });
    expect(fill).toEqual(left);
  });

  it('CENTER: x_ofs centres the text within the margin-inset box, truncating toward zero like the C++ int casts', () => {
    // total_margin=8; diff = trunc(200-8-50)=142; centered=trunc(142/2)=71; x_ofs=4+71=75.
    const result = layoutLineEditContent({
      rectSize: { x: 200, y: 30 },
      styleMargin: MARGIN,
      alignment: 1,
      textWidthPx: 50,
      textHeightPx: 23,
    });
    expect(result.textOffset.x).toBe(75);
  });

  it('CENTER: floors the shift at 0 rather than going negative for text wider than the box', () => {
    const result = layoutLineEditContent({
      rectSize: { x: 20, y: 30 },
      styleMargin: MARGIN,
      alignment: 1,
      textWidthPx: 500,
      textHeightPx: 23,
    });
    expect(result.textOffset.x).toBe(4); // MAX(0, negative) -> 0, + marginLeft
  });

  it('RIGHT: x_ofs right-aligns against the right margin, ceiling the reserved text width', () => {
    // candidate = trunc(200 - ceil(4+50)) = trunc(200-54) = 146; MAX(4, 146) = 146.
    const result = layoutLineEditContent({
      rectSize: { x: 200, y: 30 },
      styleMargin: MARGIN,
      alignment: 2,
      textWidthPx: 50,
      textHeightPx: 23,
    });
    expect(result.textOffset.x).toBe(146);
  });

  it('RIGHT: floors at the left margin rather than pushing past it for a very wide run', () => {
    const result = layoutLineEditContent({
      rectSize: { x: 20, y: 30 },
      styleMargin: MARGIN,
      alignment: 2,
      textWidthPx: 500,
      textHeightPx: 23,
    });
    expect(result.textOffset.x).toBe(4);
  });

  it('clamps the content rect at zero rather than going negative when margins exceed the rect', () => {
    const result = layoutLineEditContent({
      rectSize: { x: 4, y: 4 },
      styleMargin: MARGIN,
      alignment: 0,
      textWidthPx: 0,
      textHeightPx: 0,
    });
    expect(result.contentRect.w).toBe(0);
    expect(result.contentRect.h).toBe(0);
  });
});

describe(`lineEditMinimumSize — resolves this LineEdit's own theme font key ("${LINE_EDIT_THEME_FONT_KEY}", default_theme.cpp:419)`, () => {
  // See `resolveNodeFontMetrics.test.ts`'s own doc for why an UNRESOLVABLE
  // font's warn is the observable proof here, not a resolved FontMetrics value.
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('a theme_override_fonts/font local override is fed to BOTH the em-space TextMeasurer call and the font-height floor', () => {
    const systemFont: FontResource = { kind: 'system', fontNames: ['sans-serif'], properties: {} };
    const n: SolveNode = { ...node({}), fontOverrides: { [LINE_EDIT_THEME_FONT_KEY]: systemFont } };
    lineEditMinimumSize(n, ctx());
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('a local override under a different key is not consulted', () => {
    const systemFont: FontResource = { kind: 'system', fontNames: ['sans-serif'], properties: {} };
    const n: SolveNode = { ...node({}), fontOverrides: { normal_font: systemFont } };
    lineEditMinimumSize(n, ctx());
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
