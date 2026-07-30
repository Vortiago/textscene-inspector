/**
 * `lineEditMinimumSize` vs Godot 4.6.3 (`LineEdit::get_minimum_size`,
 * `scene/gui/line_edit.cpp:2443-2477`). Expected numbers are hand-derived
 * from the vendored OpenSans_SemiBold metrics/atlas (`unitsPerEm=2048`,
 * `ascent=2189`, `descent=600`; atlas `xadvance` for 'W' is 40 at bake size
 * 42) and the default theme's LineEdit margin (`content_margin` =
 * `round(4*scale)` = 4 at scale 1, all four sides, from `make_flat_stylebox`'s
 * own default — `nativeTheme.ts`'s `widgets.lineEdit`) — an independent
 * worked example, never the implementation's own output.
 *
 * At font size 16: fontHeightPx (ceil(ascent)+ceil(descent), NO line_spacing
 * — LineEdit sets none, unlike Label/Button) = ceil(2189*16/2048) +
 * ceil(600*16/2048) = 18 + 5 = 23. 'W' advance at 16px = 39*(16/42) = 14.857...
 */
import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { LineEditProperties } from './types';
import { originCorrectionPx } from '../../../../r3f/controls/native/text/textOrigin';
import {
  lineEditMinimumSize,
  lineEditTextTheme,
  resolveLineEditTextState,
  layoutLineEditContent,
  LINE_EDIT_DEFAULT_FONT_COLOR,
  LINE_EDIT_DEFAULT_UNEDITABLE_COLOR,
  LINE_EDIT_DEFAULT_PLACEHOLDER_COLOR,
} from './nativeSolver';

const W_ADVANCE = 40 * (16 / 42); // 15.238...
const FONT_HEIGHT = 23; // ceil(2189*16/2048) + ceil(600*16/2048)

function node(props: Partial<LineEditProperties>, styleBoxes: Record<string, StyleBoxFlatData> = {}): SolveNode {
  return {
    path: 'L',
    node: { name: 'L', type: 'LineEdit', children: [], properties: { name: 'L', ...props } as ControlProperties },
    children: [],
    styleBoxes,
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
    ...overrides,
  };
}

describe('lineEditMinimumSize — StyleBox content margins + minimum_character_width*W-advance + font height', () => {
  it('is exactly minimum_character_width(4)*W-advance + margin(8), and fontHeight(23) + margin(8), by default', () => {
    const result = lineEditMinimumSize(node({}), ctx());
    expect(result.x).toBeCloseTo(8 + 4 * W_ADVANCE, 6);
    expect(result.y).toBe(8 + FONT_HEIGHT);
  });

  it('treats an absent measurer as "the W-advance contributes nothing", NOT the whole function failing — margin + font height alone still return', () => {
    const result = lineEditMinimumSize(node({}), ctx(false));
    expect(result).toEqual({ x: 8, y: 8 + FONT_HEIGHT });
  });

  it('reads a resolved theme_override_styles/normal content margin instead of the default theme', () => {
    const wide = flatStyleBox({ contentMargin: { left: 14, top: 6, right: 14, bottom: 6 } });
    const result = lineEditMinimumSize(node({}, { normal: wide }), ctx());
    expect(result.x).toBeCloseTo(28 + 4 * W_ADVANCE, 6);
    expect(result.y).toBe(12 + FONT_HEIGHT);
  });

  it(
    'takes the MAX of BOTH normal and read_only styles\' margins, regardless of the node\'s OWN editable state ' +
      '(`theme_cache.normal->get_minimum_size().max(theme_cache.read_only->get_minimum_size())`, line_edit.cpp:2475)',
    () => {
      const wideReadOnly = flatStyleBox({ contentMargin: { left: 20, top: 10, right: 20, bottom: 10 } });
      // editable defaults true (uses "normal" for DRAWING), but min-size still floors against read_only's wider box.
      const result = lineEditMinimumSize(node({}, { read_only: wideReadOnly }), ctx());
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
    const result = lineEditMinimumSize(node({ themeOverrideFontSizes: { font_size: 32 } }), ctx());
    const wAdvance32 = 40 * (32 / 42);
    const fontHeight32 = Math.ceil(2189 * (32 / 2048)) + Math.ceil(600 * (32 / 2048));
    expect(result.x).toBeCloseTo(8 + 4 * wAdvance32, 6);
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
    expect(lineEditTextTheme({} as LineEditProperties, 'normal', ctx())).toEqual({
      fontSizePx: 16,
      color: LINE_EDIT_DEFAULT_FONT_COLOR,
    });
    expect(LINE_EDIT_DEFAULT_FONT_COLOR).toEqual({ r: 0.875, g: 0.875, b: 0.875, a: 1 });
  });

  it('resolves control_font_disabled_color (alpha 0.5) for font_uneditable_color, the read_only state', () => {
    expect(lineEditTextTheme({} as LineEditProperties, 'read_only', ctx()).color).toEqual(
      LINE_EDIT_DEFAULT_UNEDITABLE_COLOR
    );
    expect(LINE_EDIT_DEFAULT_UNEDITABLE_COLOR).toEqual({ r: 0.875, g: 0.875, b: 0.875, a: 0.5 });
  });

  it('resolves control_font_placeholder_color (alpha 0.6) for the placeholder state', () => {
    expect(lineEditTextTheme({} as LineEditProperties, 'placeholder', ctx()).color).toEqual(
      LINE_EDIT_DEFAULT_PLACEHOLDER_COLOR
    );
    expect(LINE_EDIT_DEFAULT_PLACEHOLDER_COLOR).toEqual({ r: 0.875, g: 0.875, b: 0.875, a: 0.6 });
  });

  it('a theme_override_colors/font_placeholder_color override wins over the default', () => {
    const props = {
      themeOverrideColors: { font_placeholder_color: { r: 1, g: 0, b: 0, a: 1 } },
    } as unknown as LineEditProperties;
    expect(lineEditTextTheme(props, 'placeholder', ctx()).color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('theme_override_font_sizes/font_size overrides the theme default for EVERY state', () => {
    const props = { themeOverrideFontSizes: { font_size: 24 } } as unknown as LineEditProperties;
    expect(lineEditTextTheme(props, 'normal', ctx()).fontSizePx).toBe(24);
    expect(lineEditTextTheme(props, 'read_only', ctx()).fontSizePx).toBe(24);
    expect(lineEditTextTheme(props, 'placeholder', ctx()).fontSizePx).toBe(24);
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
      fontSizePx: 16,
    });
    expect(result.contentRect).toEqual({ x: 4, y: 4, w: 192, h: 22 });
    expect(result.textOffset.x).toBe(4);
    expect(result.textOffset.y).toBeCloseTo((22 - 23) / 2 + originCorrectionPx(16), 6);
  });

  it('FILL shares LEFT\'s branch exactly (line_edit.cpp:1398-1399 falls through the same case)', () => {
    const left = layoutLineEditContent({
      rectSize: { x: 200, y: 30 },
      styleMargin: MARGIN,
      alignment: 0,
      textWidthPx: 50,
      textHeightPx: 23,
      fontSizePx: 16,
    });
    const fill = layoutLineEditContent({
      rectSize: { x: 200, y: 30 },
      styleMargin: MARGIN,
      alignment: 3,
      textWidthPx: 50,
      textHeightPx: 23,
      fontSizePx: 16,
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
      fontSizePx: 16,
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
      fontSizePx: 16,
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
      fontSizePx: 16,
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
      fontSizePx: 16,
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
      fontSizePx: 16,
    });
    expect(result.contentRect.w).toBe(0);
    expect(result.contentRect.h).toBe(0);
  });
});
