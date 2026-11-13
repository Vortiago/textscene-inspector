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
import {
  buttonBoxesInChain,
  buttonBoxesOf,
  defaultFontColorOf,
  defaultLabelFontColorOf,
  panelBoxOf,
} from './defaultThemeItems';
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

  describe('for the boxes only one type registers (default_theme.cpp:230-233,285,324)', () => {
    const SIX_ACROSS = { left: 6, top: 4, right: 6, bottom: 4 };

    it.each([
      { type: 'CheckBox', margin: { left: 4, top: 4, right: 4, bottom: 4 } },
      { type: 'CheckButton', margin: SIX_ACROSS },
    ])('gives $type an empty hover_pressed box with its own margins', ({ type, margin }) => {
      const boxes = buttonBoxesInChain(THEME, [type, ...BUTTON_CHAIN]);
      expect(isDrawn(boxes.hover_pressed!)).toBe(false);
      expect(boxes.hover_pressed!.contentMargin).toEqual(margin);
    });

    it('gives OptionButton a <state>_mirrored twin of each state box', () => {
      const boxes = buttonBoxesInChain(THEME, ['OptionButton', ...BUTTON_CHAIN]);
      for (const state of ['normal', 'hover', 'pressed', 'disabled'] as const) {
        expect(boxes[`${state}_mirrored`]).toBe(THEME.widgets.optionButton[state]);
      }
      expect(boxes.hover_pressed).toBeUndefined();
    });

    it('gives Button and MenuButton neither', () => {
      for (const chain of [BUTTON_CHAIN, ['MenuButton', ...BUTTON_CHAIN]]) {
        const boxes = buttonBoxesInChain(THEME, chain);
        expect(boxes.hover_pressed).toBeUndefined();
        expect(boxes.normal_mirrored).toBeUndefined();
      }
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

  it('returns the theme boxes themselves where the chain sets none', () => {
    expect(buttonBoxesOf(button(), THEME)).toBe(THEME.widgets.button);
  });
});

describe('defaultFontColorOf', () => {
  const colors = { normal: CONTROL_FONT_COLOR, pressed: WHITE, disabled: CONTROL_FONT_COLOR };

  it("is white in the normal state for a Label variation, which Label's font_color sets before Button's", () => {
    expect(defaultFontColorOf(button('HeaderSmall'), colors, 'normal')).toEqual(WHITE);
  });

  it("is the class's own colour in every other state of a Label variation", () => {
    expect(defaultFontColorOf(button('HeaderSmall'), colors, 'disabled')).toBe(colors.disabled);
  });

  it("is the class's own colour for FlatButton and for no variation", () => {
    expect(defaultFontColorOf(button('FlatButton'), colors, 'normal')).toBe(colors.normal);
    expect(defaultFontColorOf(button(), colors, 'normal')).toBe(colors.normal);
  });
});

function node(type: string, variation?: string): SolveNode {
  return {
    ...solveNode(),
    path: 'N',
    node: controlNode('N', type, { name: 'N', themeTypeVariation: variation }),
  };
}

describe('defaultLabelFontColorOf', () => {
  it('is Label white for Label and for the header variations', () => {
    expect(defaultLabelFontColorOf(node('Label'))).toEqual(WHITE);
    expect(defaultLabelFontColorOf(node('Label', 'HeaderLarge'))).toEqual(WHITE);
  });

  it('is control_font_color for GraphNodeTitleLabel and TooltipLabel (default_theme.cpp:819,1174)', () => {
    expect(defaultLabelFontColorOf(node('Label', 'GraphNodeTitleLabel'))).toEqual(CONTROL_FONT_COLOR);
    expect(defaultLabelFontColorOf(node('Label', 'TooltipLabel'))).toEqual(CONTROL_FONT_COLOR);
  });

  it('is white for GraphFrameTitleLabel (default_theme.cpp:849)', () => {
    expect(defaultLabelFontColorOf(node('Label', 'GraphFrameTitleLabel'))).toEqual(WHITE);
  });

  it('is undefined for a chain that never reaches Label', () => {
    expect(defaultLabelFontColorOf(node('Button'))).toBeUndefined();
  });
});

describe('panelBoxOf', () => {
  it("is Panel's box without a variation", () => {
    expect(panelBoxOf(node('PanelContainer'), THEME)).toBe(THEME.widgets.panel);
  });

  it("is TooltipPanel's half-transparent black box for that variation (default_theme.cpp:1167-1168)", () => {
    const box = panelBoxOf(node('PanelContainer', 'TooltipPanel'), THEME);
    expect(box).toBe(THEME.widgets.tooltipPanel);
    expect(box.bgColor).toEqual({ r: 0, g: 0, b: 0, a: 0.5 });
    expect(box.contentMargin).toEqual({ left: 8, top: 2, right: 8, bottom: 2 });
  });

  it("lets the node's own panel win over the variation", () => {
    const own = THEME.widgets.popupPanel;
    const styled = { ...node('PanelContainer', 'TooltipPanel'), styleBoxes: { panel: own } };
    expect(panelBoxOf(styled, THEME)).toBe(own);
  });
});
