/** SpinBox's internal LineEdit: the spec it builds, the items its theme lookup finds and its rect (`spin_box.cpp:724-731`). */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { internalControlsOf } from '../../../../r3f/controls/native/internalControls';
import { createSolveContext, solveControlTree } from '../../../../r3f/controls/native/controlRectSolver';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { controlNode, solveNode, withThemeItems } from '../../../../r3f/controls/native/testing/solveNode';
import type { ThemeResource } from '../../../../resources/styles/theme/types';
import { themeResource } from '../../../../r3f/controls/native/testing/themeResource';
import { NO_PROJECT_FONTS } from '../../../../resources/fonts/font/projectFonts';
import { HorizontalAlignment } from '../../../../godot/math/alignment';
import type { LineEditProperties } from '../lineedit/types';
import type { SpinBoxProperties } from './types';
import { SPIN_BOX_FIELD_VARIATION, spinBoxLayout } from './nativeSolver';
import '../lineedit/index.r3f';

const THEME = nativeTheme(1);
const RED = { r: 1, g: 0, b: 0, a: 1 };
const BLUE = { r: 0, g: 0, b: 1, a: 1 };
/** The widest button icon with no themed one: the vendored 16. */
const VENDORED_ICON_WIDTH = 16;

function spinBox(
  props: Partial<SpinBoxProperties> = {},
  projectTheme: ThemeResource | null = null
): SolveNode {
  return withThemeItems({
    ...solveNode(),
    path: 'Spin',
    node: controlNode('Spin', 'SpinBox', { name: 'Spin', ...props }),
    projectFonts: { ...NO_PROJECT_FONTS, projectTheme },
  });
}

function fieldOf(n: SolveNode): SolveNode {
  return internalControlsOf(n, THEME)[0]!.node;
}

function fieldProps(n: SolveNode): LineEditProperties {
  return fieldOf(n).node.properties as LineEditProperties;
}

describe('the LineEdit a SpinBox builds', () => {
  it('is one LineEdit in front mode at the path <spin box>/@LineEdit', () => {
    const [field, ...rest] = internalControlsOf(spinBox(), THEME);
    expect(rest).toEqual([]);
    expect(field!.mode).toBe('front');
    expect(field!.node.node.type).toBe('LineEdit');
    expect(field!.node.path).toBe('Spin/@LineEdit');
  });

  it('carries the SpinBoxInnerLineEdit variation (spin_box.cpp:728)', () => {
    expect(fieldProps(spinBox()).themeTypeVariation).toBe(SPIN_BOX_FIELD_VARIATION);
  });

  it('shows the text _update_text writes, with prefix and suffix (spin_box.cpp:88-114)', () => {
    expect(fieldProps(spinBox({ prefix: '$', suffix: 'kg', value: 5, step: 1 })).text).toBe('$ 5 kg');
  });

  it.each([
    [undefined, true],
    [false, false],
  ])('takes editable %s from the SpinBox as %s (spin_box.cpp:603)', (editable, isEditable) => {
    expect(fieldProps(spinBox({ editable })).editable).toBe(isEditable);
  });

  it('is left-aligned by default and takes the SpinBox alignment (spin_box.cpp:543, :725)', () => {
    expect(fieldProps(spinBox()).alignment).toBe(HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT);
    expect(fieldProps(spinBox({ alignment: HorizontalAlignment.HORIZONTAL_ALIGNMENT_RIGHT })).alignment).toBe(
      HorizontalAlignment.HORIZONTAL_ALIGNMENT_RIGHT
    );
  });
});

describe('the theme items the LineEdit of a SpinBox finds', () => {
  it('draws the font_color of LineEdit from an ancestor Theme', () => {
    const projectTheme = themeResource({ colors: { LineEdit: { font_color: RED } } });
    expect(fieldOf(spinBox({}, projectTheme)).colors.font_color).toEqual(RED);
  });

  it('prefers the SpinBoxInnerLineEdit variation over LineEdit', () => {
    const projectTheme = themeResource({
      colors: { LineEdit: { font_color: RED }, SpinBoxInnerLineEdit: { font_color: BLUE } },
      typeVariations: { SpinBoxInnerLineEdit: 'LineEdit' },
    });
    expect(fieldOf(spinBox({}, projectTheme)).colors.font_color).toEqual(BLUE);
  });

  it('ignores the colours of another class', () => {
    const projectTheme = themeResource({ colors: { Button: { font_color: RED } } });
    expect(fieldOf(spinBox({}, projectTheme)).colors.font_color).toEqual({
      r: 0.875,
      g: 0.875,
      b: 0.875,
      a: 1,
    });
  });
});

describe('the solve of a SpinBox', () => {
  function solvedFieldRect(rtl: boolean) {
    const n = {
      ...spinBox(),
      node: controlNode('Spin', 'SpinBox', { name: 'Spin', offsetRight: 200, offsetBottom: 40 }),
      rtl,
    };
    const solved = solveControlTree(
      [n],
      { x: 0, y: 0, w: 1152, h: 648 },
      createSolveContext(THEME, measureText)
    );
    return { spin: solved.get('Spin')!.rect, field: solved.get('Spin/@LineEdit')!.rect };
  }

  it.each([false, true])(
    'gives the field, in the SpinBox space, the rect _compute_sizes gives it, rtl %s (spin_box.cpp:382-397)',
    (rtl) => {
      const { spin, field } = solvedFieldRect(rtl);
      const { fieldRect } = spinBoxLayout({ x: spin.w, y: spin.h }, VENDORED_ICON_WIDTH, rtl);
      expect(field).toEqual(fieldRect);
    }
  );
});
