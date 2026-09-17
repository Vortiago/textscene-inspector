/**
 * TextEdit's native rect solver vs `scene/gui/text_edit.cpp` (Godot 4.6.3).
 * Expected numbers are cited beside each assertion.
 */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import {
  resolveTextEditStyleState,
  pickTextEditStyleBox,
  textEditRowHeightPx,
  textEditWrapWidthPx,
  shapeTextEditLines,
  textEditContentSize,
  textEditMinimumSize,
  layoutTextEditDrawBand,
  textEditCurrentLineXPx,
  textEditRowOriginXPx,
  textEditTabStopsPx,
} from './nativeSolver';
import { OPEN_SANS_FONT_METRICS } from '../../../../r3f/controls/native/text/openSansFontMetrics';
import type { TextEditProperties } from './types';

const THEME = nativeTheme(1);

function ctx(): SolveContext {
  return {
    theme: THEME,
    measureText: null,
    combinedMinimumSize: () => ({ x: 0, y: 0 }),
  };
}

function node(props: Partial<TextEditProperties>): SolveNode {
  return {
    ...solveNode(),
    path: 'T',
    node: { name: 'T', type: 'TextEdit', children: [], properties: { name: 'T', ...props } as TextEditProperties },
  };
}

describe('resolveTextEditStyleState', () => {
  it('defaults to normal (editable defaults true)', () => {
    expect(resolveTextEditStyleState(undefined)).toBe('normal');
  });
  it('reads read_only when editable is explicitly false', () => {
    expect(resolveTextEditStyleState(false)).toBe('read_only');
  });
});

describe('pickTextEditStyleBox', () => {
  it('falls back to LineEdit-reused defaults (default_theme.cpp:453,455 reuse the same Refs)', () => {
    expect(pickTextEditStyleBox({}, THEME.widgets.lineEdit, 'normal')).toBe(THEME.widgets.lineEdit.normal);
    expect(pickTextEditStyleBox({}, THEME.widgets.lineEdit, 'read_only')).toBe(THEME.widgets.lineEdit.readOnly);
  });
  it('prefers a theme_override_styles override over the default', () => {
    const override = { ...THEME.widgets.lineEdit.normal, cornerRadius: { topLeft: 99, topRight: 99, bottomRight: 99, bottomLeft: 99 } };
    expect(pickTextEditStyleBox({ normal: override }, THEME.widgets.lineEdit, 'normal')).toBe(override);
  });
});

describe('textEditRowHeightPx', () => {
  // text_edit.cpp:4103: MAX(text.get_line_height() + theme_cache.line_spacing, 1).
  it('is the font line pitch plus the line_spacing constant', () => {
    const withoutSpacing = textEditRowHeightPx(OPEN_SANS_FONT_METRICS, 16, 0);
    expect(textEditRowHeightPx(OPEN_SANS_FONT_METRICS, 16, 4)).toBe(withoutSpacing + 4);
  });
  it('floors at 1 for a degenerate zero-size font pitch', () => {
    expect(textEditRowHeightPx({ ...OPEN_SANS_FONT_METRICS, ascent: 0, descent: 0 }, 1, 0)).toBe(1);
  });
});

describe('textEditWrapWidthPx', () => {
  // text_edit.cpp:8536-8543.
  it('subtracts style margins, gutters and the bare wrap_offset(10)', () => {
    expect(textEditWrapWidthPx(300, 8, 0, 80, false)).toBe(300 - 8 - 10);
  });
  it('additionally subtracts the minimap width when draw_minimap is true', () => {
    expect(textEditWrapWidthPx(300, 8, 0, 80, true)).toBe(300 - 8 - 80 - 10);
  });
  it('truncates a fractional result toward zero, matching the C++ int assignment', () => {
    expect(textEditWrapWidthPx(300.7, 8, 0, 80, false)).toBe(Math.trunc(300.7 - 8 - 10));
  });
});

describe('shapeTextEditLines', () => {
  it('shapes each buffer line independently, one row per line when unwrapped', () => {
    const result = shapeTextEditLines(['a', 'bb'], 16, 0, undefined, 0, OPEN_SANS_FONT_METRICS);
    expect(result).toHaveLength(2);
    expect(result[0]!.startRow).toBe(0);
    expect(result[0]!.layout.lines).toHaveLength(1);
    expect(result[1]!.startRow).toBe(1);
  });
  it('preserveControl threads through to each line\'s own shapeText call (Text::set_draw_control_chars, text_edit.cpp:292)', () => {
    const dropped = shapeTextEditLines(['AB'], 16, 0, undefined, 0, OPEN_SANS_FONT_METRICS);
    const boxed = shapeTextEditLines(['AB'], 16, 0, undefined, 0, OPEN_SANS_FONT_METRICS, [], true);
    expect(dropped[0]!.layout.lines[0]!.glyphs[1]!.controlCodepoint).toBeUndefined();
    expect(boxed[0]!.layout.lines[0]!.glyphs[1]!.controlCodepoint).toBe(0x0001);
  });
  it('still occupies one row for an empty buffer line (a blank line is not zero rows)', () => {
    const result = shapeTextEditLines(['a', '', 'b'], 16, 0, undefined, 0, OPEN_SANS_FONT_METRICS);
    expect(result.map((l) => l.startRow)).toEqual([0, 1, 2]);
    expect(result[1]!.layout.lines[0]!.glyphs).toHaveLength(0);
  });
  it('wraps a long line into multiple rows only when wrap_mode is BOUNDARY(1)', () => {
    const longLine = 'a repeated word wrap word wrap word wrap word wrap';
    const unwrapped = shapeTextEditLines([longLine], 16, 0, 3, 60, OPEN_SANS_FONT_METRICS);
    const wrapped = shapeTextEditLines([longLine], 16, 1, 3, 60, OPEN_SANS_FONT_METRICS);
    expect(unwrapped[0]!.layout.lines.length).toBe(1);
    expect(wrapped[0]!.layout.lines.length).toBeGreaterThan(1);
  });
});

describe('textEditContentSize', () => {
  it('sums every row into height and takes the widest row into width, plus the bare +10 pad', () => {
    const lineLayouts = shapeTextEditLines(['a', 'bb'], 16, 0, undefined, 0, OPEN_SANS_FONT_METRICS);
    const rowHeightPx = textEditRowHeightPx(OPEN_SANS_FONT_METRICS, 16, 4);
    const size = textEditContentSize(lineLayouts, rowHeightPx, 0, 80, false);
    expect(size.y).toBe(2 * rowHeightPx);
    expect(size.x).toBeGreaterThan(10);
  });
  it('adds gutteredWidthPx and, when draw_minimap, minimapWidthPx into the width', () => {
    const lineLayouts = shapeTextEditLines(['a'], 16, 0, undefined, 0, OPEN_SANS_FONT_METRICS);
    const rowHeightPx = 20;
    const withoutExtras = textEditContentSize(lineLayouts, rowHeightPx, 0, 80, false).x;
    expect(textEditContentSize(lineLayouts, rowHeightPx, 5, 80, false).x).toBe(withoutExtras + 5);
    expect(textEditContentSize(lineLayouts, rowHeightPx, 0, 80, true).x).toBe(withoutExtras + 80);
  });
  it('floors height at one row for an entirely empty buffer', () => {
    const lineLayouts = shapeTextEditLines([''], 16, 0, undefined, 0, OPEN_SANS_FONT_METRICS);
    expect(textEditContentSize(lineLayouts, 20, 0, 80, false).y).toBe(20);
  });
});

describe('textEditMinimumSize', () => {
  it('is exactly the active stylebox minimum size when neither fit_content flag is set', () => {
    const n = node({ text: 'hello world this is a long line' });
    const size = textEditMinimumSize(n, ctx());
    const v = 'size' in size ? size.size : size;
    const styleMin = THEME.widgets.lineEdit.normal.contentMargin;
    expect(v).toEqual({ x: styleMin.left + styleMin.right, y: styleMin.top + styleMin.bottom });
  });
  it('grows with fit_content_height on the first pass (no tentativeRect) using the unwrapped height', () => {
    const n = node({ text: 'a\nb\nc', fitContentHeight: true });
    const size = textEditMinimumSize(n, ctx());
    const v = 'size' in size ? size.size : size;
    const styleMin = THEME.widgets.lineEdit.normal.contentMargin;
    expect(v.y).toBeGreaterThan(styleMin.top + styleMin.bottom);
  });
  it('floors the read_only stylebox, not the normal one, when editable is false', () => {
    const n = node({ editable: false });
    const size = textEditMinimumSize(n, ctx());
    const v = 'size' in size ? size.size : size;
    const styleMin = THEME.widgets.lineEdit.readOnly.contentMargin;
    expect(v).toEqual({ x: styleMin.left + styleMin.right, y: styleMin.top + styleMin.bottom });
  });
});

describe('layoutTextEditDrawBand', () => {
  // text_edit.cpp:938,941-944.
  it('begins after the left content margin plus the gutter band, ends before the right margin', () => {
    const box = THEME.widgets.lineEdit.normal;
    const band = layoutTextEditDrawBand(300, box, 22, 80, false, 24);
    expect(band.xMarginBeginPx).toBe(Math.ceil(box.contentMargin.left) + 22);
    expect(band.xMarginEndPx).toBe(300 - Math.floor(box.contentMargin.right));
  });
  it('narrows the right edge further when draw_minimap is true', () => {
    const box = THEME.widgets.lineEdit.normal;
    const withoutMinimap = layoutTextEditDrawBand(300, box, 0, 80, false, 24).xMarginEndPx;
    const withMinimap = layoutTextEditDrawBand(300, box, 0, 80, true, 24).xMarginEndPx;
    expect(withMinimap).toBe(withoutMinimap - 80);
  });
});

describe('textEditTabStopsPx (text_edit.cpp:349-351)', () => {
  // Space glyph advance at size 16 (openSansMetrics.ts's own 532 design
  // units, unitsPerEm 2048): 532*16/2048 = 4.15625px.
  it('one repeating stop, tab_size widths of the space glyph', () => {
    expect(textEditTabStopsPx(4, OPEN_SANS_FONT_METRICS, 16)).toEqual([16.625]);
  });
  it('undefined tab_size falls back to the class default of 4 (text_edit.h:197)', () => {
    expect(textEditTabStopsPx(undefined, OPEN_SANS_FONT_METRICS, 16)).toEqual([16.625]);
  });
  it('tab_size <= 0 disables tab alignment entirely (no stops)', () => {
    expect(textEditTabStopsPx(0, OPEN_SANS_FONT_METRICS, 16)).toEqual([]);
  });
  it('floors the derived stop at 1px', () => {
    expect(textEditTabStopsPx(1, OPEN_SANS_FONT_METRICS, 1)).toEqual([1]);
  });
});

describe('textEditRowOriginXPx (text_edit.cpp:1490-1494)', () => {
  it('is the band start under LTR, whatever the row measures', () => {
    expect(textEditRowOriginXPx(26, 300, 120, false)).toBe(26);
  });

  it('mirrors the band start about the control under RTL, by the ROW\'s own width', () => {
    // `char_margin = size.width - char_margin - TS->shaped_text_get_size(rid).x
    // - wrap_indent` (:1490-1491), with `wrap_indent` 0 (indent_wrapped_lines
    // is not modelled). 300 - 26 - 120 = 154.
    expect(textEditRowOriginXPx(26, 300, 120, true)).toBe(154);
  });

  it('measures the row at its CEILED shaped size, as shaped_text_get_size does (edge case)', () => {
    expect(textEditRowOriginXPx(26, 300, 119.25, true)).toBe(154);
  });
});

describe('textEditCurrentLineXPx (text_edit.cpp:1404-1409)', () => {
  it('starts at the control origin under LTR', () => {
    expect(textEditCurrentLineXPx(280, 300, false)).toBe(0);
  });

  it('ends at the control edge under RTL, keeping the band width', () => {
    // `Rect2(size.width - xmargin_end, ofs_y, xmargin_end, row_height)` (:1406).
    expect(textEditCurrentLineXPx(280, 300, true)).toBe(20);
  });
});
