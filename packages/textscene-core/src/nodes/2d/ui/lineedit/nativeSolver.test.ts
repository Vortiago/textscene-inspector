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
  lineEditRightIconSize,
  lineEditCaretRect,
  lineEditTextureSlots,
  LINE_EDIT_DEFAULT_FONT_COLOR,
  LINE_EDIT_DEFAULT_UNEDITABLE_COLOR,
  LINE_EDIT_DEFAULT_PLACEHOLDER_COLOR,
  LINE_EDIT_THEME_FONT_KEY,
  EXPAND_MODE_ORIGINAL_SIZE,
  EXPAND_MODE_FIT_TO_TEXT,
  EXPAND_MODE_FIT_TO_LINE_EDIT,
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

describe('lineEditMinimumSize — expand_to_text_length (line_edit.cpp:2454-2457)', () => {
  // 'W' has no kerning partner in the vendored metrics (`kerning: {}`), so N
  // repeats shape to exactly N * W_ADVANCE, ceiled (`shaped_text_get_size`,
  // `shapedTextSizeWidthPx`). 6 * 15.125 = 90.75 -> ceil 91.
  const SIX_W_WIDTH = 91;

  it('floors width on ceil(shaped display text) + caret_width once it exceeds the 4-char floor', () => {
    const result = size(
      lineEditMinimumSize(node({ text: 'WWWWWW', expandToTextLength: true }), ctx())
    );
    // caret_width theme constant defaults to 1 (default_theme.cpp:434); 8+91+1=100.
    expect(result.x).toBe(8 + SIX_W_WIDTH + 1);
    expect(result.y).toBe(8 + FONT_HEIGHT);
  });

  it('sizes to the PLACEHOLDER when text is empty — _shape() shapes whichever string using_placeholder selects', () => {
    const result = size(
      lineEditMinimumSize(node({ placeholderText: 'WWWWWW', expandToTextLength: true }), ctx())
    );
    expect(result.x).toBe(8 + SIX_W_WIDTH + 1);
  });

  it('a caret_width theme override changes the added margin', () => {
    const n = { ...node({ text: 'WWWWWW', expandToTextLength: true }), constants: { caret_width: 3 } };
    const result = size(lineEditMinimumSize(n, ctx()));
    expect(result.x).toBe(8 + SIX_W_WIDTH + 3);
  });

  it('leaves width at the 4-char floor for a short string (the floor still wins the MAX)', () => {
    const withShort = size(lineEditMinimumSize(node({ text: 'W', expandToTextLength: true }), ctx()));
    const withoutFlag = size(lineEditMinimumSize(node({ text: 'W' }), ctx()));
    expect(withShort).toEqual(withoutFlag);
  });

  it('contributes nothing without a measurer, matching the em-space width\'s own fallback', () => {
    const result = lineEditMinimumSize(node({ text: 'WWWWWW', expandToTextLength: true }), ctx(false));
    expect(result).toEqual({ x: 8, y: 8 + FONT_HEIGHT });
  });
});

describe('lineEditMinimumSize — right_icon / clear_button_enabled contribution (line_edit.cpp:2459-2472)', () => {
  it('adds a right_icon\'s ORIGINAL_SIZE natural width, and floors height at it when taller than the font', () => {
    const n = { ...node({}), textureSlots: { right_icon: { x: 32, y: 40 } } };
    const result = size(lineEditMinimumSize(n, ctx()));
    expect(result.x).toBeCloseTo(8 + 4 * W_ADVANCE + 32, 6);
    expect(result.y).toBe(8 + 40); // icon height (40) beats FONT_HEIGHT (23)
  });

  it('a shorter icon does not shrink the font-height floor', () => {
    const n = { ...node({}), textureSlots: { right_icon: { x: 32, y: 16 } } };
    const result = size(lineEditMinimumSize(n, ctx()));
    expect(result.y).toBe(8 + FONT_HEIGHT);
  });

  it('clear_button_enabled contributes the vendored 16x16 clear icon even with NO text at all', () => {
    const result = size(lineEditMinimumSize(node({ clearButtonEnabled: true }), ctx()));
    expect(result.x).toBeCloseTo(8 + 4 * W_ADVANCE + 16, 6);
  });

  it('a themed "clear" icon overrides the vendored 16x16 natural size', () => {
    const n = { ...node({ clearButtonEnabled: true }), textureSlots: { clear: { x: 24, y: 24 } } };
    const result = size(lineEditMinimumSize(n, ctx()));
    expect(result.x).toBeCloseTo(8 + 4 * W_ADVANCE + 24, 6);
  });

  it('right_icon and clear_button_enabled together take the MAX of the two widths, not their sum', () => {
    const n = {
      ...node({ clearButtonEnabled: true }),
      textureSlots: { right_icon: { x: 10, y: 10 }, clear: { x: 16, y: 16 } },
    };
    const result = size(lineEditMinimumSize(n, ctx()));
    expect(result.x).toBeCloseTo(8 + 4 * W_ADVANCE + 16, 6);
  });

  it(
    'FIT_TO_LINE_EDIT contributes NOTHING when no tentativeRect exists — LineEdit never ' +
      'registers as size-dependent, so this is every real solve, not merely a first pass',
    () => {
      const n = {
        ...node({ iconExpandMode: 2 }),
        textureSlots: { right_icon: { x: 32, y: 16 } },
      };
      const result = size(lineEditMinimumSize(n, ctx()));
      expect(result.x).toBeCloseTo(8 + 4 * W_ADVANCE, 6);
      expect(result.y).toBe(8 + FONT_HEIGHT);
    }
  );

  it('FIT_TO_LINE_EDIT on the SECOND pass sizes the icon against the tentative resolved rect', () => {
    const n = {
      ...node({ iconExpandMode: 2 }),
      textureSlots: { right_icon: { x: 32, y: 16 } },
    };
    const c = { ...ctx(), tentativeRect: () => ({ x: 0, y: 0, w: 100, h: 30 }) };
    const result = size(lineEditMinimumSize(n, c));
    // iconWidth = 32*30/16 = 60 (<=100, no clamp); iconHeight = 30.
    expect(result.x).toBeCloseTo(8 + 4 * W_ADVANCE + 60, 6);
    expect(result.y).toBe(8 + 30);
  });
});

describe('lineEditRightIconSize — LineEdit::_get_right_icon_size (line_edit.cpp:373-406)', () => {
  it('ORIGINAL_SIZE returns the natural size unchanged, ignoring scale/controlSize/fontHeight', () => {
    expect(lineEditRightIconSize({ x: 32, y: 16 }, EXPAND_MODE_ORIGINAL_SIZE, 23, { x: 999, y: 999 }, 0.1)).toEqual({
      x: 32,
      y: 16,
    });
  });

  it('FIT_TO_TEXT returns a square of the font height, ignoring the natural size', () => {
    expect(lineEditRightIconSize({ x: 32, y: 16 }, EXPAND_MODE_FIT_TO_TEXT, 23, { x: 999, y: 999 }, 1)).toEqual({
      x: 23,
      y: 23,
    });
  });

  it('FIT_TO_LINE_EDIT scales to the control\'s own height, preserving aspect, when it fits the width', () => {
    // icon_width = 32*30/16 = 60 (<= control width 100, no clamp); icon_height = 30.
    expect(
      lineEditRightIconSize({ x: 32, y: 16 }, EXPAND_MODE_FIT_TO_LINE_EDIT, 23, { x: 100, y: 30 }, 1)
    ).toEqual({ x: 60, y: 30 });
  });

  it('FIT_TO_LINE_EDIT clamps to the control\'s own width once the height-driven width overflows it', () => {
    // icon_width = 32*30/16 = 60 > control width 40 -> icon_width=40, icon_height = 16*40/32 = 20.
    expect(
      lineEditRightIconSize({ x: 32, y: 16 }, EXPAND_MODE_FIT_TO_LINE_EDIT, 23, { x: 40, y: 30 }, 1)
    ).toEqual({ x: 40, y: 20 });
  });

  it('FIT_TO_LINE_EDIT applies right_icon_scale to its own result only', () => {
    expect(
      lineEditRightIconSize({ x: 32, y: 16 }, EXPAND_MODE_FIT_TO_LINE_EDIT, 23, { x: 100, y: 30 }, 0.5)
    ).toEqual({ x: 30, y: 15 });
  });

  it(
    'FIT_TO_LINE_EDIT with no control size contributes (0, 0) — Control::get_size() reads ' +
      'Size2() (control.h:218) until _size_changed() runs, and get_minimum_size() never runs ' +
      'after a resize (no update_minimum_size() call in LineEdit::_notification\'s ' +
      'NOTIFICATION_RESIZED, line_edit.cpp:1327-1330) nor is the cached result invalidated by ' +
      'one (Control::_update_minimum_size_cache/minimum_size_valid, control.cpp:1744-1757) — so ' +
      'this icon never actually drives LineEdit\'s own minimum height, only the font does',
    () => {
      expect(lineEditRightIconSize({ x: 32, y: 16 }, EXPAND_MODE_FIT_TO_LINE_EDIT, 23, null, 1)).toEqual({
        x: 0,
        y: 0,
      });
    }
  );

  it('a degenerate (zero-height) natural size never divides by zero', () => {
    expect(
      lineEditRightIconSize({ x: 0, y: 0 }, EXPAND_MODE_FIT_TO_LINE_EDIT, 23, { x: 100, y: 30 }, 1)
    ).toEqual({ x: 0, y: 0 });
  });
});

describe('lineEditCaretRect — the caret_force_displayed static-preview position (line_edit.cpp:1552-1611)', () => {
  const MARGIN = { left: 4, top: 4, right: 4, bottom: 4 };
  const RECT = { x: 200, y: 30 };
  // Shared with layoutLineEditContent's own LEFT test: yArea=trunc(30-4-4)=22,
  // y=trunc(4+(22-23)/2)=trunc(3.5)=3 — identical formula, `fontHeightPx`
  // standing in for `text_height` (the two never diverge in this engine).

  it('when real text is showing, sits at the SAME pen-start x the text itself uses (shaped_text_get_carets at column 0)', () => {
    const rect = lineEditCaretRect({
      rectSize: RECT,
      styleMargin: MARGIN,
      alignment: 1, // CENTER — must be ignored; only isPlaceholder branches on alignment.
      fontHeightPx: 23,
      isPlaceholder: false,
      textPenX: 75, // whatever the caller's own content.textOffset.x resolved to.
      rightIconRawWidthPx: 0,
      ofsMaxPx: 192,
      caretWidthPx: 1,
    });
    expect(rect).toEqual({ x: 75, y: 3, w: 1, h: 23 });
  });

  it('LEFT/FILL fallback (placeholder/empty): sits at the left margin, unaffected by an icon', () => {
    const rect = lineEditCaretRect({
      rectSize: RECT,
      styleMargin: MARGIN,
      alignment: 0,
      fontHeightPx: 23,
      isPlaceholder: true,
      textPenX: 999, // must be ignored in the fallback branch.
      rightIconRawWidthPx: 32,
      ofsMaxPx: 192,
      caretWidthPx: 1,
    });
    expect(rect.x).toBe(4);
    expect(rect.y).toBe(3);
  });

  it('CENTER fallback: centres against the RAW right_icon width only (not the clear button, not text)', () => {
    // total_margin=8; inner=trunc(200-8-32)=160; center=trunc(160/2)=80; x=4+80=84.
    const rect = lineEditCaretRect({
      rectSize: RECT,
      styleMargin: MARGIN,
      alignment: 1,
      fontHeightPx: 23,
      isPlaceholder: true,
      textPenX: 0,
      rightIconRawWidthPx: 32,
      ofsMaxPx: 192,
      caretWidthPx: 1,
    });
    expect(rect.x).toBe(84);
  });

  it('CENTER fallback with no icon: inner=trunc(200-8-0)=192; center=96; x=4+96=100', () => {
    const rect = lineEditCaretRect({
      rectSize: RECT,
      styleMargin: MARGIN,
      alignment: 1,
      fontHeightPx: 23,
      isPlaceholder: true,
      textPenX: 0,
      rightIconRawWidthPx: 0,
      ofsMaxPx: 192,
      caretWidthPx: 1,
    });
    expect(rect.x).toBe(100);
  });

  it('RIGHT fallback: sits exactly at ofs_max', () => {
    const rect = lineEditCaretRect({
      rectSize: RECT,
      styleMargin: MARGIN,
      alignment: 2,
      fontHeightPx: 23,
      isPlaceholder: true,
      textPenX: 0,
      rightIconRawWidthPx: 0,
      ofsMaxPx: 176,
      caretWidthPx: 1,
    });
    expect(rect.x).toBe(176);
  });
});

describe('lineEditTextureSlots — right_icon (own scope) + the themed "clear" icon', () => {
  it('requests right_icon under its own property key when authored', () => {
    const requests = lineEditTextureSlots({
      name: 'L',
      type: 'LineEdit',
      children: [],
      properties: { name: 'L', rightIcon: 'ExtResource("1_icon")' },
    });
    expect(requests).toContainEqual({ key: 'right_icon', ref: 'ExtResource("1_icon")' });
  });

  it('requests the "clear" theme icon only when the theme walk resolved one', () => {
    const node = { name: 'L', type: 'LineEdit', children: [], properties: { name: 'L' } };
    expect(lineEditTextureSlots(node, {})).toEqual([]);
    const themed = { clear: { ref: 'ExtResource("1_clear")', resources: { externalResources: [], internalResources: [] } } };
    expect(lineEditTextureSlots(node, themed)).toContainEqual({
      key: 'clear',
      ref: 'ExtResource("1_clear")',
      scope: themed.clear.resources,
    });
  });

  it('requests neither when nothing is authored/themed', () => {
    const node = { name: 'L', type: 'LineEdit', children: [], properties: { name: 'L' } };
    expect(lineEditTextureSlots(node)).toEqual([]);
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

  it('without an icon, ofsMaxPx is width minus the right margin, and content rect width matches it', () => {
    const result = layoutLineEditContent({
      rectSize: { x: 200, y: 30 },
      styleMargin: MARGIN,
      alignment: 0,
      textWidthPx: 50,
      textHeightPx: 23,
    });
    expect(result.ofsMaxPx).toBe(196);
    expect(result.contentRect.w).toBe(192);
  });
});

describe('layoutLineEditContent — right_icon/clear-button inset (line_edit.cpp:1444-1485)', () => {
  const MARGIN = { left: 4, top: 4, right: 4, bottom: 4 };

  it('LEFT: an icon narrows ofsMaxPx/content width but never moves x_ofs off the left margin', () => {
    const result = layoutLineEditContent({
      rectSize: { x: 200, y: 30 },
      styleMargin: MARGIN,
      alignment: 0,
      textWidthPx: 50,
      textHeightPx: 23,
      hasIcon: true,
      iconWidthPx: 20,
    });
    expect(result.textOffset.x).toBe(4);
    expect(result.ofsMaxPx).toBe(176); // trunc(200-4-20)
    expect(result.contentRect.w).toBe(172);
  });

  it('CENTER: an icon\'s width is subtracted from the centring budget too', () => {
    // total_margin=8; diff=trunc(200-8-50-20)=122; centered=trunc(122/2)=61; x=4+61=65.
    const result = layoutLineEditContent({
      rectSize: { x: 200, y: 30 },
      styleMargin: MARGIN,
      alignment: 1,
      textWidthPx: 50,
      textHeightPx: 23,
      hasIcon: true,
      iconWidthPx: 20,
    });
    expect(result.textOffset.x).toBe(65);
  });

  it('RIGHT: x_ofs shifts left by BOTH the icon width AND the right margin again (line_edit.cpp:1477, ported as written)', () => {
    // base (pre-icon) = max(4, trunc(200-ceil(4+50))) = 146.
    // with icon: max(4, trunc(146-20-4)) = 122.
    const result = layoutLineEditContent({
      rectSize: { x: 200, y: 30 },
      styleMargin: MARGIN,
      alignment: 2,
      textWidthPx: 50,
      textHeightPx: 23,
      hasIcon: true,
      iconWidthPx: 20,
    });
    expect(result.textOffset.x).toBe(122);
  });

  it('RIGHT: floors at the left margin rather than going negative for a wide icon', () => {
    const result = layoutLineEditContent({
      rectSize: { x: 60, y: 30 },
      styleMargin: MARGIN,
      alignment: 2,
      textWidthPx: 10,
      textHeightPx: 23,
      hasIcon: true,
      iconWidthPx: 50,
    });
    expect(result.textOffset.x).toBe(4);
  });

  it('hasIcon:false ignores a stray iconWidthPx entirely — the no-icon formulas apply exactly', () => {
    const withIcon = layoutLineEditContent({
      rectSize: { x: 200, y: 30 },
      styleMargin: MARGIN,
      alignment: 2,
      textWidthPx: 50,
      textHeightPx: 23,
      hasIcon: false,
      iconWidthPx: 999,
    });
    const without = layoutLineEditContent({
      rectSize: { x: 200, y: 30 },
      styleMargin: MARGIN,
      alignment: 2,
      textWidthPx: 50,
      textHeightPx: 23,
    });
    expect(withIcon).toEqual(without);
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

describe('layoutLineEditContent — RTL layout (line_edit.cpp:1397-1421,1455-1483)', () => {
  const MARGIN = { left: 4, top: 4, right: 4, bottom: 4 };
  const BOX = { x: 200, y: 30 };

  it('LEFT/FILL take the RIGHT arm under RTL (:1399-1403)', () => {
    // `MAX(margin_left, int(size.width - ceil(margin_right + text_width)))`:
    // trunc(200 - ceil(4 + 50)) = 146; MAX(4, 146) = 146.
    for (const alignment of [0, 3]) {
      const result = layoutLineEditContent({ rectSize: BOX, styleMargin: MARGIN, alignment, textWidthPx: 50, textHeightPx: 23, rtl: true });
      expect(result.textOffset.x).toBe(146);
    }
  });

  it('RIGHT takes the LEFT arm under RTL (:1415-1419)', () => {
    const result = layoutLineEditContent({ rectSize: BOX, styleMargin: MARGIN, alignment: 2, textWidthPx: 50, textHeightPx: 23, rtl: true });
    expect(result.textOffset.x).toBe(4);
  });

  it('CENTER is unbranched on RTL without an icon (:1406-1414)', () => {
    const ltr = layoutLineEditContent({ rectSize: BOX, styleMargin: MARGIN, alignment: 1, textWidthPx: 50, textHeightPx: 23 });
    const rtl = layoutLineEditContent({ rectSize: BOX, styleMargin: MARGIN, alignment: 1, textWidthPx: 50, textHeightPx: 23, rtl: true });
    expect(rtl.textOffset.x).toBe(ltr.textOffset.x);
  });

  it('leaves ofs_max at the right margin under RTL — the icon is subtracted only when !rtl (:1481-1483)', () => {
    const result = layoutLineEditContent({ rectSize: BOX, styleMargin: MARGIN, alignment: 0, textWidthPx: 50, textHeightPx: 23, hasIcon: true, iconWidthPx: 16, rtl: true });
    expect(result.ofsMaxPx).toBe(196);
  });

  it('floors x_ofs at the left margin PLUS the icon width under RTL (:1473-1474)', () => {
    // Alignment arm first: MAX(4, trunc(200 - ceil(4 + 190))) = MAX(4, 6) = 6;
    // then MAX(margin_left + icon_width, x_ofs) = MAX(20, 6) = 20.
    const result = layoutLineEditContent({ rectSize: BOX, styleMargin: MARGIN, alignment: 0, textWidthPx: 190, textHeightPx: 23, hasIcon: true, iconWidthPx: 16, rtl: true });
    expect(result.textOffset.x).toBe(20);
  });

  it('adds the icon width to CENTER under RTL (:1469-1471)', () => {
    // diff = trunc(200 - 8 - 50 - 16) = 126; centered = 63; x_ofs = 4 + 63 = 67; + 16 = 83.
    const result = layoutLineEditContent({ rectSize: BOX, styleMargin: MARGIN, alignment: 1, textWidthPx: 50, textHeightPx: 23, hasIcon: true, iconWidthPx: 16, rtl: true });
    expect(result.textOffset.x).toBe(83);
  });

  it('moves the clip band to the far side of the icon under RTL, keeping its LTR width', () => {
    // The drawn band is [x_ofs, ofs_max] (:1481-1483,1541): LTR [4, 180], RTL [20, 196].
    const ltr = layoutLineEditContent({ rectSize: BOX, styleMargin: MARGIN, alignment: 0, textWidthPx: 50, textHeightPx: 23, hasIcon: true, iconWidthPx: 16 });
    const rtl = layoutLineEditContent({ rectSize: BOX, styleMargin: MARGIN, alignment: 0, textWidthPx: 50, textHeightPx: 23, hasIcon: true, iconWidthPx: 16, rtl: true });
    expect(ltr.contentRect.x).toBe(4);
    expect(rtl.contentRect.x).toBe(20);
    expect(rtl.contentRect.w).toBe(ltr.contentRect.w);
  });
});

describe('lineEditCaretRect — RTL layout (line_edit.cpp:1560-1584)', () => {
  const MARGIN = { left: 4, top: 4, right: 4, bottom: 4 };
  const BASE = { rectSize: { x: 200, y: 30 }, styleMargin: MARGIN, fontHeightPx: 23, isPlaceholder: true, textPenX: 146, rightIconRawWidthPx: 0, ofsMaxPx: 196, caretWidthPx: 1 };

  it('the placeholder fallback puts LEFT/FILL at ofs_max under RTL (:1562-1568)', () => {
    for (const alignment of [0, 3]) {
      expect(lineEditCaretRect({ ...BASE, alignment, rtl: true }).x).toBe(196);
    }
  });

  it('the placeholder fallback puts RIGHT at x_ofs under RTL (:1578-1584)', () => {
    expect(lineEditCaretRect({ ...BASE, alignment: 2, rtl: true }).x).toBe(146);
  });

  it('CENTER carries no RTL arm (:1569-1577)', () => {
    expect(lineEditCaretRect({ ...BASE, alignment: 1, rtl: true }).x).toBe(lineEditCaretRect({ ...BASE, alignment: 1 }).x);
  });

  it('real text still rides the pen x under RTL — the fallback is gated on using_placeholder (:1555)', () => {
    expect(lineEditCaretRect({ ...BASE, alignment: 0, isPlaceholder: false, rtl: true }).x).toBe(146);
  });
});
