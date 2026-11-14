/**
 * SpinBox native solver against Godot 4.6.3: `SpinBox::get_minimum_size` (`spin_box.cpp:82-86`),
 * `_compute_sizes` (`:382-411`), `_update_text` (`:88-114`), `_update_buttons_state_for_current_value`
 * (`:635-645`) and `Math::step_decimals`/`String::num` (`core/math/math_funcs.cpp:61-85`,
 * `core/string/ustring.cpp:1405-1481`).
 */
import { describe, expect, it } from 'vitest';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { createSolveContext } from '../../../../r3f/controls/native/controlRectSolver';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import { controlNode, solveNode, withThemeItems } from '../../../../r3f/controls/native/testing/solveNode';
import type { SpinBoxProperties } from './types';
import {
  spinBoxLayout,
  formatGodotNumber,
  spinBoxUpButtonState,
  spinBoxDownButtonState,
  spinBoxIconColor,
  spinBoxMinimumSize,
  spinBoxWidestButtonIconWidth,
} from './nativeSolver';
import { controlProps } from '../control/testing/controlProps';
import type { ThemeResource } from '../../../../resources/styles/theme/types';
import type { TscnInternalResource } from '../../../../parser/types';
import '../lineedit/index.r3f';
import { internalControlsOf } from '../../../../r3f/controls/native/internalControls';
import type { LineEditProperties } from '../lineedit/types';

// At font size 16 with no theme in the chain: 'W' advances 1936*(16/2048) = 15.125
// (`openSansMetrics.ts`'s hmtx), and the line is ceil(2189*16/2048) + ceil(600*16/2048) = 23 with
// no `line_spacing`, as in LineEdit's solver. LineEdit's content margin is `round(4*scale)`, 4px.
const W_ADVANCE = 1936 * (16 / 2048);
const FONT_HEIGHT = 23;

function node(props: Partial<SpinBoxProperties> = {}): SolveNode {
  return {
    ...solveNode(),
    path: 'S',
    node: controlNode('S', 'SpinBox', { name: 'S', ...props }),
  };
}

/** The text `_update_text` writes into the field of a SpinBox with `props`, in `locale` (`spin_box.cpp:88-114`). */
function fieldText(props: Partial<SpinBoxProperties>, locale = ''): string {
  const [field] = internalControlsOf({ ...node(props), locale }, nativeTheme(1));
  return (field!.node.node.properties as LineEditProperties).text ?? '';
}

function ctx(withMeasurer = true): SolveContext {
  return createSolveContext(nativeTheme(1), withMeasurer ? measureText : null);
}

describe('spinBoxWidestButtonIconWidth (spin_box.cpp:411-424, restricted to up/down)', () => {
  it('is the vendored 16 when neither icon is themed', () => {
    expect(spinBoxWidestButtonIconWidth({ textureSlots: {} }, 1)).toBe(16);
  });

  it('is the vendored width at the theme scale: 24 at 1.5', () => {
    expect(spinBoxWidestButtonIconWidth({ textureSlots: {} }, 1.5)).toBe(24);
  });

  it('widens to a themed icon wider than the vendored default', () => {
    expect(spinBoxWidestButtonIconWidth({ textureSlots: { down: { x: 30, y: 8 } } }, 1)).toBe(30);
  });
});

describe('spinBoxLayout', () => {
  it('splits the field from the buttons block, LTR (happy path)', () => {
    const layout = spinBoxLayout({ x: 100, y: 30 }, 16);
    expect(layout.fieldRect).toEqual({ x: 0, y: 0, w: 82, h: 30 });
    expect(layout.upRect).toEqual({ x: 84, y: 0, w: 16, h: 15 });
    expect(layout.downRect).toEqual({ x: 84, y: 15, w: 16, h: 15 });
    expect(layout.fieldAndButtonsSeparatorRect).toEqual({ x: 82, y: 0, w: 2, h: 30 });
  });

  it('widens the buttons block to an icon wider than buttons_width (spin_box.cpp:389)', () => {
    expect(spinBoxLayout({ x: 100, y: 30 }, 30).fieldRect.w).toBe(100 - 30 - 2);
  });

  it('floors the field width at 0 when the rect is narrower than the buttons block (error path)', () => {
    expect(spinBoxLayout({ x: 10, y: 30 }, 16).fieldRect.w).toBe(0);
  });

  it('truncates a fractional rect size toward zero for the buttons, matching Size2i (edge case)', () => {
    const layout = spinBoxLayout({ x: 100.9, y: 29.9 }, 16);
    expect(layout.downRect.y + layout.downRect.h).toBe(29);
  });

  it('keeps the field at the fractional size, as its anchors and offsets place it (spin_box.cpp:394-395)', () => {
    const layout = spinBoxLayout({ x: 100.5, y: 29.5 }, 16);
    expect(layout.fieldRect).toEqual({ x: 0, y: 0, w: 82.5, h: 29.5 });
  });

  it('mirrors the fractional field under RTL', () => {
    expect(spinBoxLayout({ x: 100.5, y: 29.5 }, 16, true).fieldRect).toEqual({
      x: 18,
      y: 0,
      w: 82.5,
      h: 29.5,
    });
  });

  it('puts the buttons block on the LEFT under RTL layout (spin_box.cpp:403,409)', () => {
    // `buttons_left = is_layout_rtl() ? 0 : size.width - buttons_width` (:403) and
    // `field_and_buttons_separator_left = is_layout_rtl() ? buttons_width : size.width -
    // buttons_block_width` (:409). Same widths as the LTR case above, mirrored ends.
    const layout = spinBoxLayout({ x: 100, y: 30 }, 16, true);
    expect(layout.upRect).toEqual({ x: 0, y: 0, w: 16, h: 15 });
    expect(layout.downRect).toEqual({ x: 0, y: 15, w: 16, h: 15 });
    expect(layout.fieldAndButtonsSeparatorRect).toEqual({ x: 16, y: 0, w: 2, h: 30 });
  });

  it('mirrors the internal field rect under RTL layout (spin_box.cpp:394-395, control.cpp:1785-1787)', () => {
    // The field is the internal LineEdit's full-rect preset at offsets [0, -block]
    // (:394-395), so its own `_size_changed` mirror moves it to
    // `parent_width - x - w`, the far side of the buttons block.
    const layout = spinBoxLayout({ x: 100, y: 30 }, 16, true);
    expect(layout.fieldRect).toEqual({ x: 18, y: 0, w: 82, h: 30 });
  });

  it('leaves the field rect empty and pinned to the right edge when the rect is narrower than the buttons block under RTL (error path)', () => {
    expect(spinBoxLayout({ x: 10, y: 30 }, 16, true).fieldRect).toEqual({ x: 10, y: 0, w: 0, h: 30 });
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

describe("the field's text", () => {
  it('wraps the formatted value in prefix/suffix, space-separated (happy path)', () => {
    expect(fieldText({ prefix: '$', suffix: 'kg', step: 0.25, value: 5.5 })).toBe('$ 5.5 kg');
  });

  it('omits an absent prefix/suffix entirely, not as an empty wrap (error path)', () => {
    expect(fieldText({ value: 5 })).toBe('5');
  });

  it('prints the digits the step needs (Math::range_step_decimals)', () => {
    expect(fieldText({ step: 0.01, value: 0.25 })).toBe('0.25');
  });

  it('prints every digit for a zero step, under the 1e-13 floor', () => {
    expect(fieldText({ step: 0, value: 0.123 })).toBe('0.123');
  });

  it('falls back to step=1 (Range default) when unset (edge case)', () => {
    expect(fieldText({ value: 5.5 })).toBe('6'); // step_decimals(1) = 0, so String::num rounds with %.0lf
  });
});

describe('spinBoxUpButtonState / spinBoxDownButtonState', () => {
  it('disables both buttons together when not editable (happy path)', () => {
    const props: SpinBoxProperties = controlProps({ name: 'S', editable: false, minValue: 0, maxValue: 10 });
    expect(spinBoxUpButtonState(props, 5)).toBe('disabled');
    expect(spinBoxDownButtonState(props, 5)).toBe('disabled');
  });

  it('disables only the button whose bound the value has reached (error path)', () => {
    const props: SpinBoxProperties = controlProps({ name: 'S', minValue: 0, maxValue: 10 });
    expect(spinBoxUpButtonState(props, 10)).toBe('disabled');
    expect(spinBoxDownButtonState(props, 10)).toBe('normal');
    expect(spinBoxUpButtonState(props, 0)).toBe('normal');
    expect(spinBoxDownButtonState(props, 0)).toBe('disabled');
  });

  it('stays enabled at the bound when allow_greater/allow_lesser lifts it (edge case)', () => {
    const props: SpinBoxProperties = controlProps({
      name: 'S',
      minValue: 0,
      maxValue: 10,
      allowGreater: true,
      allowLesser: true,
    });
    expect(spinBoxUpButtonState(props, 10)).toBe('normal');
    expect(spinBoxDownButtonState(props, 0)).toBe('normal');
  });
});

describe('spinBoxIconColor', () => {
  const defaultColors = withThemeItems(node()).colors;

  it('reads control_font_color and control_font_disabled_color from the default theme', () => {
    expect(spinBoxIconColor(defaultColors, 'up', 'normal')).toEqual({ r: 0.875, g: 0.875, b: 0.875, a: 1 });
    expect(spinBoxIconColor(defaultColors, 'down', 'disabled')).toEqual({
      r: 0.875,
      g: 0.875,
      b: 0.875,
      a: 0.5,
    });
  });

  it('reads a theme_override_colors entry folded into n.colors for its own direction only', () => {
    const colors = { ...defaultColors, up_icon_modulate: { r: 1, g: 0, b: 0, a: 1 } };
    expect(spinBoxIconColor(colors, 'up', 'normal')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    expect(spinBoxIconColor(colors, 'down', 'normal')).toEqual({ r: 0.875, g: 0.875, b: 0.875, a: 1 });
  });

  it('throws on a colour record without the item', () => {
    expect(() => spinBoxIconColor({}, 'up', 'normal')).toThrow(/up_icon_modulate/);
  });
});

describe('spinBoxMinimumSize at a theme scale (spin_box.cpp:382-397)', () => {
  it('widens the buttons block to the scaled arrow: the same minimum as themed 24x12 arrows', () => {
    const at15 = createSolveContext(nativeTheme(1.5), measureText);
    const themed = { ...node(), textureSlots: { up: { x: 24, y: 12 }, down: { x: 24, y: 12 } } };

    expect(spinBoxMinimumSize(node(), at15)).toEqual(spinBoxMinimumSize(themed, at15));
    expect(spinBoxMinimumSize(node(), at15).x).toBeGreaterThan(spinBoxMinimumSize(node(), ctx()).x);
  });
});

describe('spinBoxMinimumSize', () => {
  it("floors LineEdit's own minimum size plus the buttons block width (happy path)", () => {
    const result = spinBoxMinimumSize(node(), ctx());
    expect(result.x).toBeCloseTo(8 + 4 * W_ADVANCE + 18, 5);
    expect(result.y).toBe(8 + FONT_HEIGHT);
  });

  it('contributes zero em-width when no measurer is wired (error path)', () => {
    const result = spinBoxMinimumSize(node(), ctx(false));
    expect(result.x).toBe(8 + 18);
  });

  it('widens the buttons block on a themed "down" icon wider than the vendored 16 (spin_box.cpp:82-86,382-397)', () => {
    const n = { ...node(), textureSlots: { down: { x: 40, y: 8 } } };
    const result = spinBoxMinimumSize(n, ctx(false));
    // blockWidth = max(18, 40+2) = 42, against the untethered 18.
    expect(result.x).toBe(8 + 42);
  });
});

describe("the field's text in a locale (spin_box.cpp:91-93)", () => {
  it('writes the value in the digits of the locale, and keeps the prefix and suffix as they are', () => {
    expect(fieldText({ prefix: '$', suffix: 'kg', step: 0.25, value: 5.5 }, 'ar')).toBe('$ ٥٫٥ kg');
  });

  it('writes ASCII digits while localize_numeral_system is off', () => {
    expect(fieldText({ localizeNumeralSystem: false, value: 5.5 }, 'ar')).toBe('6');
  });
});

describe('the inner LineEdit reads its items through the ancestor Theme chain', () => {
  const box: TscnInternalResource = {
    id: 'box',
    type: 'StyleBoxFlat',
    data: {
      content_margin_left: '10.0',
      content_margin_top: '9.0',
      content_margin_right: '10.0',
      content_margin_bottom: '9.0',
    },
  };

  function under(overrides: Partial<ThemeResource>): SolveNode {
    const themeResource: ThemeResource = {
      defaultFont: null,
      defaultFontSize: undefined,
      fonts: {},
      fontSizes: {},
      typeVariations: {},
      properties: {},
      resources: { externalResources: [], internalResources: [box] },
      ...overrides,
    };
    return { ...node(), themeChain: [themeResource] };
  }

  it('sizes the field from the LineEdit normal stylebox of the Theme', () => {
    const themed = under({ styles: { LineEdit: { normal: 'SubResource("box")' } } });
    const result = spinBoxMinimumSize(themed, ctx(false));
    expect(result.x).toBe(20 + 18);
    expect(result.y).toBe(18 + FONT_HEIGHT);
  });
});
