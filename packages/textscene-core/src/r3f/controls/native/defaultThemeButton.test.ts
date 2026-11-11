/**
 * The default theme's Button items by type chain (`scene/theme/default_theme.cpp:357-383`): `FlatButton` and
 * `FlatMenuButton` set an empty box and a darker pressed one, `Label` sets an empty `normal` and a white
 * `font_color`, and `Button` sets the rest.
 */
import { describe, expect, it } from 'vitest';
import { CONTROL_FONT_COLOR } from '../../../godot/scene/theme';
import { controlNode, solveNode } from './testing/solveNode';
import { themeResource } from './testing/themeResource';
import type { SolveNode } from './solveTree';
import { buttonBoxesInChain, buttonBoxesOf, defaultFontColorOf } from './defaultThemeButton';
import { nativeTheme } from './nativeTheme';
import { isDrawn } from './styleBoxFlat';

const THEME = nativeTheme(1);
const WHITE = { r: 1, g: 1, b: 1, a: 1 };
const BUTTON_CHAIN = ['Button', 'BaseButton', 'Control'];

function button(variation?: string, themeChain: SolveNode['themeChain'] = []): SolveNode {
  return {
    ...solveNode(),
    path: 'B',
    node: controlNode('B', 'Button', { name: 'B', themeTypeVariation: variation }),
    themeChain,
  };
}

describe('buttonBoxesInChain', () => {
  it("is Button's own boxes for a chain that names no variation", () => {
    expect(buttonBoxesInChain(THEME, BUTTON_CHAIN)).toEqual(THEME.widgets.button);
  });

  describe('for FlatButton (default_theme.cpp:366-375)', () => {
    const boxes = buttonBoxesInChain(THEME, ['FlatButton', ...BUTTON_CHAIN]);

    it("draws nothing in the normal, hover and disabled states and keeps Button's margins", () => {
      for (const state of ['normal', 'hover', 'disabled'] as const) {
        expect(isDrawn(boxes[state])).toBe(false);
        expect(boxes[state].contentMargin).toEqual(THEME.widgets.button.normal.contentMargin);
      }
    });

    it("draws Button's pressed box at 0.85 of its alpha", () => {
      expect(boxes.pressed.bgColor.a).toBeCloseTo(THEME.widgets.button.pressed.bgColor.a * 0.85);
      expect(boxes.pressed.contentMargin).toEqual(THEME.widgets.button.pressed.contentMargin);
    });
  });

  it('gives FlatMenuButton the boxes of FlatButton', () => {
    expect(buttonBoxesInChain(THEME, ['FlatMenuButton', 'MenuButton', ...BUTTON_CHAIN])).toEqual(
      buttonBoxesInChain(THEME, ['FlatButton', ...BUTTON_CHAIN])
    );
  });

  describe('for a Label variation (default_theme.cpp:379)', () => {
    const boxes = buttonBoxesInChain(THEME, ['HeaderSmall', 'Label', ...BUTTON_CHAIN]);

    it('takes the empty normal box of Label, with no margin', () => {
      expect(isDrawn(boxes.normal)).toBe(false);
      expect(boxes.normal.contentMargin).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
    });

    it("keeps Button's boxes for the states Label sets none for", () => {
      expect(boxes.pressed).toBe(THEME.widgets.button.pressed);
      expect(boxes.disabled).toBe(THEME.widgets.button.disabled);
      expect(boxes.hover).toBe(THEME.widgets.button.hover);
    });
  });
});

describe('buttonBoxesOf', () => {
  it('reads the variation a node names', () => {
    expect(isDrawn(buttonBoxesOf(button('FlatButton'), THEME).normal)).toBe(false);
    expect(isDrawn(buttonBoxesOf(button(), THEME).normal)).toBe(true);
  });

  it('reads a variation a scene Theme registers on top of FlatButton', () => {
    const theme = themeResource({ typeVariations: { MyFlat: 'FlatButton' } });
    expect(isDrawn(buttonBoxesOf(button('MyFlat', [theme]), THEME).normal)).toBe(false);
  });

  it('ignores a variation no theme registers', () => {
    expect(buttonBoxesOf(button('NoSuchVariation'), THEME)).toEqual(THEME.widgets.button);
  });

  it('resolves once for each node and theme', () => {
    const node = button('FlatButton');
    expect(buttonBoxesOf(node, THEME)).toBe(buttonBoxesOf(node, THEME));
  });
});

describe('defaultFontColorOf', () => {
  it("is white for a Label variation, which Label's font_color sets before Button's", () => {
    expect(defaultFontColorOf(button('HeaderSmall'), CONTROL_FONT_COLOR)).toEqual(WHITE);
  });

  it('is the fallback for FlatButton and for no variation', () => {
    expect(defaultFontColorOf(button('FlatButton'), CONTROL_FONT_COLOR)).toEqual(CONTROL_FONT_COLOR);
    expect(defaultFontColorOf(button(), CONTROL_FONT_COLOR)).toEqual(CONTROL_FONT_COLOR);
  });
});
