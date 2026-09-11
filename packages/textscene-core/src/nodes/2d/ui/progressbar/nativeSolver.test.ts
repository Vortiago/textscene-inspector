/**
 * `progressBarMinimumSize`/`progressBarPercentRatio` vs Godot 4.6.3
 * (`scene/gui/progress_bar.cpp:37-48,149-166`).
 *
 * Font metrics at size 16 (vendored OpenSans_SemiBold, `unitsPerEm=2048`,
 * `ascent=2189`, `descent=600`): ascentPx = ceil(2189*16/2048) = 18,
 * descentPx = ceil(600*16/2048) = 5, fontHeightPx (no line_spacing, matching
 * `label/nativeSolver.test.ts`'s own worked value) = 23. At size 32:
 * ascentPx = ceil(2189*32/2048) = 35, descentPx = ceil(600*32/2048) = 10,
 * fontHeightPx = 45.
 */
import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import {
  progressBarMinimumSize,
  progressBarPercentRatio,
  progressBarIndeterminateFillRect,
  progressBarFillRect,
} from './nativeSolver';
import type { ProgressBarProperties } from './types';

function node(
  props: Partial<ProgressBarProperties>,
  styleBoxes: Record<string, StyleBoxFlatData> = {}
): SolveNode {
  return {
    ...emptySolveNode(),
    path: 'P',
    node: { name: 'P', type: 'ProgressBar', children: [], properties: { name: 'P', ...props } as ControlProperties },
    styleBoxes,
  };
}

function ctx(): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText,
    combinedMinimumSize: () => ({ x: 0, y: 0 }),
  };
}

function minSize(props: Partial<ProgressBarProperties>, styleBoxes?: Record<string, StyleBoxFlatData>) {
  const result = progressBarMinimumSize(node(props, styleBoxes), ctx());
  return 'size' in result ? result.size : result;
}

describe('progressBarMinimumSize (progress_bar.cpp:37-48)', () => {
  it('defaults to the default-theme background/fill content margin (2px each side, scale 1) maxed with "100%" height', () => {
    // background/fill get_minimum_size() = (4, 4) each (content margin 2+2);
    // show_percentage defaults true, so height floors to 4 + 23 = 27.
    expect(minSize({})).toEqual({ x: 4, y: 27 });
  });

  it('show_percentage = false: floors both axes to 1 rather than adding text height (progress_bar.cpp:44-46)', () => {
    const zeroMargin: StyleBoxFlatData = {
      bgColor: { r: 0, g: 0, b: 0, a: 1 },
      borderColor: { r: 0, g: 0, b: 0, a: 1 },
      borderWidth: { left: 0, top: 0, right: 0, bottom: 0 },
      cornerRadius: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
      expandMargin: { left: 0, top: 0, right: 0, bottom: 0 },
      contentMargin: { left: 0, top: 0, right: 0, bottom: 0 },
      drawCenter: true,
      borderBlend: false,
      antiAliased: true,
      aaSize: 1,
      cornerDetail: 8,
      skew: { x: 0, y: 0 },
      shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
      shadowSize: 0,
      shadowOffset: { x: 0, y: 0 },
    };
    expect(minSize({ showPercentage: false }, { background: zeroMargin, fill: zeroMargin })).toEqual({ x: 1, y: 1 });
  });

  it('maxes an overridden fill stylebox margin against the (default) background margin', () => {
    const wideFill: StyleBoxFlatData = {
      bgColor: { r: 0, g: 0, b: 0, a: 1 },
      borderColor: { r: 0, g: 0, b: 0, a: 1 },
      borderWidth: { left: 0, top: 0, right: 0, bottom: 0 },
      cornerRadius: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
      expandMargin: { left: 0, top: 0, right: 0, bottom: 0 },
      contentMargin: { left: 20, top: 0, right: 20, bottom: 0 },
      drawCenter: true,
      borderBlend: false,
      antiAliased: true,
      aaSize: 1,
      cornerDetail: 8,
      skew: { x: 0, y: 0 },
      shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
      shadowSize: 0,
      shadowOffset: { x: 0, y: 0 },
    };
    const result = minSize({ showPercentage: false }, { fill: wideFill });
    expect(result.x).toBe(40); // fill's 20+20 beats the default background's 2+2
  });

  it('a theme_override_font_sizes/font_size override grows the percent text height it floors against', () => {
    expect(minSize({ themeOverrideFontSizes: { font_size: 32 } })).toEqual({ x: 4, y: 49 }); // 4 + 45
  });

  it('a null ctx.measureText (no text engine wired) leaves the percentage text out of the floor: margin only, no maxf(1) either', () => {
    const result = progressBarMinimumSize(node({}), { theme: nativeTheme(1), measureText: null, combinedMinimumSize: () => ({ x: 0, y: 0 }) });
    const size = 'size' in result ? result.size : result;
    expect(size).toEqual({ x: 4, y: 4 }); // background/fill's own content margin, untouched by text or the show_percentage=false floor
  });
});

describe('progressBarPercentRatio (progress_bar.cpp:149-166)', () => {
  it('is the plain [min, max] fraction', () => {
    expect(progressBarPercentRatio({ value: 50, minValue: 0, maxValue: 100 }, undefined)).toBeCloseTo(0.5, 9);
  });

  it('returns 1 for a degenerate [min, max] range rather than dividing by zero', () => {
    expect(progressBarPercentRatio({ value: 5, minValue: 10, maxValue: 10 }, undefined)).toBe(1);
  });

  it('exp_edit with value >= 0 and min >= 0 takes the log2 branch', () => {
    // log2(10) / log2(100) = log2(10) / (2*log2(10)) = 0.5 exactly.
    expect(
      progressBarPercentRatio({ value: 10, minValue: 1, maxValue: 100, expEdit: true }, undefined)
    ).toBeCloseTo(0.5, 9);
  });

  it('exp_edit with a NEGATIVE min_value falls back to the plain fraction (progress_bar.cpp:155\'s min() >= 0 gate)', () => {
    expect(
      progressBarPercentRatio({ value: 50, minValue: -10, maxValue: 100, expEdit: true }, undefined)
    ).toBeCloseTo(60 / 110, 9);
  });
});

describe('progressBarIndeterminateFillRect (progress_bar.cpp:69-110, always the "centre it" frame)', () => {
  it('FILL_TOP_TO_BOTTOM at (100, 32): fill_size=64, ifp=82, rect (0,18,100,14)', () => {
    expect(progressBarIndeterminateFillRect({ x: 100, y: 32 }, 2)).toEqual({ x: 0, y: 18, w: 100, h: 14 });
  });

  it('FILL_BOTTOM_TO_TOP at (100, 32): the mirror image, rect (0,0,100,14)', () => {
    expect(progressBarIndeterminateFillRect({ x: 100, y: 32 }, 3)).toEqual({ x: 0, y: 0, w: 100, h: 14 });
  });

  it('FILL_BEGIN_TO_END vs FILL_END_TO_BEGIN at (32, 100) diverge in x (32 is the MINOR axis here)', () => {
    expect(progressBarIndeterminateFillRect({ x: 32, y: 100 }, 0)).toEqual({ x: 18, y: 0, w: 14, h: 100 });
    expect(progressBarIndeterminateFillRect({ x: 32, y: 100 }, 1)).toEqual({ x: 0, y: 0, w: 14, h: 100 });
  });

  it('an out-of-range fill_mode draws as FILL_BEGIN_TO_END (set_fill_mode\'s ERR_FAIL_INDEX refuses the write, progress_bar.cpp:199-203)', () => {
    expect(progressBarIndeterminateFillRect({ x: 100, y: 32 }, 4)).toEqual({ x: 18, y: 0, w: 64, h: 32 });
  });
});

describe('progressBarFillRect (progress_bar.cpp:112-147)', () => {
  it('FILL_BEGIN_TO_END grows from the left', () => {
    expect(progressBarFillRect({ x: 100, y: 20 }, 0, 0.5, { x: 4, y: 4 })).toEqual({ x: 0, y: 0, w: 52, h: 20 });
  });

  it('FILL_END_TO_BEGIN grows from the right (mirrors FILL_BEGIN_TO_END\'s width, opposite x)', () => {
    expect(progressBarFillRect({ x: 100, y: 20 }, 1, 0.5, { x: 4, y: 4 })).toEqual({ x: 48, y: 0, w: 52, h: 20 });
  });

  it('a zero ratio draws nothing (p <= 0)', () => {
    expect(progressBarFillRect({ x: 100, y: 20 }, 0, 0, { x: 4, y: 4 })).toBeNull();
  });

  it('FILL_TOP_TO_BOTTOM grows downward', () => {
    expect(progressBarFillRect({ x: 20, y: 100 }, 2, 0.3, { x: 4, y: 6 })).toEqual({ x: 0, y: 0, w: 20, h: 34 });
  });

  it('FILL_BOTTOM_TO_TOP grows upward', () => {
    expect(progressBarFillRect({ x: 20, y: 100 }, 3, 0.3, { x: 4, y: 6 })).toEqual({ x: 0, y: 66, w: 20, h: 34 });
  });

  it('an out-of-range fill_mode draws as FILL_BEGIN_TO_END (set_fill_mode\'s ERR_FAIL_INDEX refuses the write, progress_bar.cpp:199-203)', () => {
    expect(progressBarFillRect({ x: 100, y: 20 }, 4, 0.5, { x: 4, y: 4 })).toEqual({ x: 0, y: 0, w: 52, h: 20 });
  });
});
