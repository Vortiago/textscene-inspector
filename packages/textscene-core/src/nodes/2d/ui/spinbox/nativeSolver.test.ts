/**
 * SpinBox native solver vs Godot 4.6.3 — `SpinBox::get_minimum_size`
 * (`spin_box.cpp:82-86`), `_compute_sizes` (`:382-411`), `_update_text`
 * (`:88-114`), `_update_buttons_state_for_current_value` (`:635-645`) and
 * `Math::step_decimals`/`String::num` (`core/math/math_funcs.cpp:61-85`,
 * `core/string/ustring.cpp:1405-1481`).
 *
 * At font size 16 (no theme anywhere in the chain, so every default applies):
 * fontHeightPx = ceil(2189*16/2048) + ceil(600*16/2048) = 18 + 5 = 23 (no
 * `line_spacing`, matching LineEdit's own solver). 'W' advance at 16px =
 * 1936*(16/2048) = 15.125 (`openSansMetrics.ts`'s vendored hmtx). LineEdit's
 * default content margin is 4px all sides (`content_margin` = `round(4*scale)`).
 */
import { describe, expect, it } from 'vitest';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext, MinimumSizeResult } from '../../../../r3f/controls/native/solverRegistry';
import type { Vec2 } from '../../../../r3f/controls/native/rect';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import type { SpinBoxProperties } from './types';
import {
  spinBoxButtonsBlockWidth,
  spinBoxFieldButtonsSeparation,
  spinBoxLayout,
  rangeStepDecimals,
  formatGodotNumber,
  spinBoxDisplayText,
  spinBoxFullyDisabled,
  spinBoxUpButtonState,
  spinBoxDownButtonState,
  spinBoxIconColor,
  spinBoxFieldTextTheme,
  spinBoxMinimumSize,
} from './nativeSolver';

const W_ADVANCE = 1936 * (16 / 2048); // 15.125
const FONT_HEIGHT = 23;

function size(result: Vec2 | MinimumSizeResult): Vec2 {
  return 'x' in result ? result : result.size;
}

function node(props: Partial<SpinBoxProperties> = {}): SolveNode {
  return {
    ...solveNode(),
    path: 'S',
    node: { name: 'S', type: 'SpinBox', children: [], properties: { name: 'S', ...props } as SpinBoxProperties },
  };
}

function ctx(withMeasurer = true): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText: withMeasurer ? measureText : null,
    combinedMinimumSize: () => ({ x: 0, y: 0 }),
  };
}

describe('spinBoxButtonsBlockWidth', () => {
  it('is buttons_width(16) + field_and_buttons_separation(2), unscaled (happy path)', () => {
    expect(spinBoxButtonsBlockWidth()).toBe(18);
  });
});

describe('spinBoxFieldButtonsSeparation', () => {
  it('is field_and_buttons_separation(2), unscaled — default_theme.cpp:647 sets it as a bare literal (happy path)', () => {
    expect(spinBoxFieldButtonsSeparation()).toBe(2);
  });
});

describe('spinBoxLayout', () => {
  it('splits the field from the buttons block, LTR (happy path)', () => {
    const layout = spinBoxLayout({ x: 100, y: 30 });
    expect(layout.fieldRect).toEqual({ x: 0, y: 0, w: 82, h: 30 });
    expect(layout.upRect).toEqual({ x: 84, y: 0, w: 16, h: 15 });
    expect(layout.downRect).toEqual({ x: 84, y: 15, w: 16, h: 15 });
    expect(layout.fieldAndButtonsSeparatorRect).toEqual({ x: 82, y: 0, w: 2, h: 30 });
  });

  it('floors the field width at 0 when the rect is narrower than the buttons block (error path)', () => {
    expect(spinBoxLayout({ x: 10, y: 30 }).fieldRect.w).toBe(0);
  });

  it('truncates a fractional rect size toward zero, matching Size2i (edge case)', () => {
    const layout = spinBoxLayout({ x: 100.9, y: 29.9 });
    expect(layout.fieldRect.h).toBe(29);
  });
});

describe('rangeStepDecimals', () => {
  it('reads the fractional digits a step needs (happy path)', () => {
    expect(rangeStepDecimals(0.25)).toBe(1);
    expect(rangeStepDecimals(0.01)).toBe(2);
  });

  it('returns 16 for a step under the 1e-13 floor (error path — an unset/zero step)', () => {
    expect(rangeStepDecimals(0)).toBe(16);
  });

  it('returns 0 for a whole-number step (edge case)', () => {
    expect(rangeStepDecimals(1)).toBe(0);
  });
});

describe('formatGodotNumber', () => {
  it('trims trailing zeroes but keeps exactly one digit after the point (happy path)', () => {
    expect(formatGodotNumber(5.5, 1)).toBe('5.5');
    expect(formatGodotNumber(5, 2)).toBe('5.0');
  });

  it('prints no point at all at 0 decimals (error path)', () => {
    expect(formatGodotNumber(5, 0)).toBe('5');
  });

  it('handles a negative value (edge case)', () => {
    expect(formatGodotNumber(-2.5, 1)).toBe('-2.5');
  });
});

describe('spinBoxDisplayText', () => {
  it('wraps the formatted value in prefix/suffix, space-separated (happy path)', () => {
    expect(spinBoxDisplayText({ name: 'S', prefix: '$', suffix: 'kg', step: 0.25 }, 5.5)).toBe('$ 5.5 kg');
  });

  it('omits an absent prefix/suffix entirely, not as an empty wrap (error path)', () => {
    expect(spinBoxDisplayText({ name: 'S' }, 5)).toBe('5');
  });

  it('falls back to step=1 (Range default) when unset (edge case)', () => {
    expect(spinBoxDisplayText({ name: 'S' }, 5.5)).toBe('6'); // step_decimals(1) = 0 -> String::num rounds via %.0lf
  });
});

describe('spinBoxFullyDisabled / spinBoxUpButtonState / spinBoxDownButtonState', () => {
  it('disables both buttons together when not editable (happy path)', () => {
    const props: SpinBoxProperties = { name: 'S', editable: false, minValue: 0, maxValue: 10 };
    expect(spinBoxFullyDisabled(props)).toBe(true);
    expect(spinBoxUpButtonState(props, 5)).toBe('disabled');
    expect(spinBoxDownButtonState(props, 5)).toBe('disabled');
  });

  it('disables only the button whose bound the value has reached (error path)', () => {
    const props: SpinBoxProperties = { name: 'S', minValue: 0, maxValue: 10 };
    expect(spinBoxUpButtonState(props, 10)).toBe('disabled');
    expect(spinBoxDownButtonState(props, 10)).toBe('normal');
    expect(spinBoxUpButtonState(props, 0)).toBe('normal');
    expect(spinBoxDownButtonState(props, 0)).toBe('disabled');
  });

  it('stays enabled at the bound when allow_greater/allow_lesser lifts it (edge case)', () => {
    const props: SpinBoxProperties = { name: 'S', minValue: 0, maxValue: 10, allowGreater: true, allowLesser: true };
    expect(spinBoxUpButtonState(props, 10)).toBe('normal');
    expect(spinBoxDownButtonState(props, 0)).toBe('normal');
  });
});

describe('spinBoxIconColor', () => {
  it('defaults to control_font_color / control_font_disabled_color (happy path)', () => {
    expect(spinBoxIconColor({}, 'up', 'normal')).toEqual({ r: 0.875, g: 0.875, b: 0.875, a: 1 });
    expect(spinBoxIconColor({}, 'down', 'disabled')).toEqual({ r: 0.875, g: 0.875, b: 0.875, a: 0.5 });
  });

  it('a theme_override_colors entry (already folded into n.colors) wins (error path — malformed keys are absent, not applied)', () => {
    const colors = { up_icon_modulate: { r: 1, g: 0, b: 0, a: 1 } };
    expect(spinBoxIconColor(colors, 'up', 'normal')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    expect(spinBoxIconColor(colors, 'down', 'normal')).toEqual({ r: 0.875, g: 0.875, b: 0.875, a: 1 });
  });
});

describe('spinBoxFieldTextTheme', () => {
  it('falls back to the built-in default font size/colour absent any theme (happy path)', () => {
    const result = spinBoxFieldTextTheme(node(), ctx(), true);
    expect(result.fontSizePx).toBe(16);
    expect(result.color).toEqual({ r: 0.875, g: 0.875, b: 0.875, a: 1 });
  });

  it('reads the uneditable colour when not editable (edge case)', () => {
    expect(spinBoxFieldTextTheme(node(), ctx(), false).color).toEqual({ r: 0.875, g: 0.875, b: 0.875, a: 0.5 });
  });
});

describe('spinBoxMinimumSize', () => {
  it('floors LineEdit\'s own minimum size plus the buttons block width (happy path)', () => {
    const result = size(spinBoxMinimumSize(node(), ctx()));
    expect(result.x).toBeCloseTo(8 + 4 * W_ADVANCE + 18, 5);
    expect(result.y).toBe(8 + FONT_HEIGHT);
  });

  it('contributes zero em-width when no measurer is wired (error path)', () => {
    const result = size(spinBoxMinimumSize(node(), ctx(false)));
    expect(result.x).toBe(8 + 18);
  });
});
