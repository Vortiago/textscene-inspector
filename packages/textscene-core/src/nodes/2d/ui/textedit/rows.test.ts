/**
 * `solveTextEditRows` versus the order Godot settles the wrap width and the vertical bar in:
 * `_update_wrap_at_column` reads the bar (`text_edit.cpp:8541-8543`), and `_update_scrollbars`
 * reads the wrapped rows (`:8602`). Row counts are read from Godot 4.6.3 at theme scale 1 with the
 * default font: six lines, line 1 `a long line that runs past the`, `wrap_mode = 1`, 84 px high.
 */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { OPEN_SANS_FONT_METRICS } from '../../../../r3f/controls/native/text/openSansFontMetrics';
import { solveTextEditRows } from './rows';

const LONG_LINE = 'a long line that runs past the';

function solve(
  widthPx: number,
  lines: string[],
  overrides: Partial<Parameters<typeof solveTextEditRows>[0]> = {}
) {
  return solveTextEditRows({
    lines,
    isPlaceholder: false,
    size: { x: widthPx, y: 84 },
    margins: { left: 4, top: 4, right: 4, bottom: 4 },
    rowHeightPx: 27,
    gutterBandWidthPx: 0,
    minimapWidthPx: 0,
    drawMinimap: false,
    scrollPastEndOfFile: false,
    fitContentHeight: false,
    rtl: false,
    shape: { fontSizePx: 16, fontMetrics: OPEN_SANS_FONT_METRICS, wrapMode: 1 },
    theme: nativeTheme(1),
    ...overrides,
  });
}

const SIX_LINES = [LONG_LINE, 'two', 'three', 'four', 'five', 'six'];

describe('solveTextEditRows', () => {
  it('wraps line 1 in two rows at 244 px only because the bar shows (:8541-8543)', () => {
    const shown = solve(244, SIX_LINES);
    const alone = solve(244, [LONG_LINE]);
    expect(shown.scrollBars.vertical.visible).toBe(true);
    expect(shown.lineLayouts[0]!.layout.lines).toHaveLength(2);
    expect(alone.scrollBars.vertical.visible).toBe(false);
    expect(alone.lineLayouts[0]!.layout.lines).toHaveLength(1);
  });

  it('keeps line 1 in one row at 256 px, where it fits beside the bar', () => {
    const result = solve(256, SIX_LINES);
    expect(result.lineLayouts[0]!.layout.lines).toHaveLength(1);
    expect(result.scrollBars.vertical.visible).toBe(true);
  });

  it('subtracts the bar from the wrap width it returns', () => {
    expect(solve(256, SIX_LINES).wrapWidthPx).toBe(256 - 8 - 8 - 10);
    expect(solve(256, ['one', 'two']).wrapWidthPx).toBe(256 - 8 - 10);
  });

  it('shapes once at the plain wrap width when wrapping is off', () => {
    const result = solve(244, SIX_LINES, { shape: { fontSizePx: 16, fontMetrics: OPEN_SANS_FONT_METRICS } });
    expect(result.lineLayouts[0]!.layout.lines).toHaveLength(1);
    expect(result.scrollBars.vertical.visible).toBe(true);
  });
});
