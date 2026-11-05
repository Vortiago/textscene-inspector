/**
 * PopupPanel's content layout (`scene/gui/popup.cpp:270-368`): its panel insets for the shadow, and
 * every direct Control child fills the panel's content rect.
 */
import { describe, expect, it } from 'vitest';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import { controlNode, solveNode } from '../../../r3f/controls/native/testing/solveNode';
import { nativeTheme } from '../../../r3f/controls/native/nativeTheme';
import { createSolveContext } from '../../../r3f/controls/native/controlRectSolver';
import { flatStyleBox } from '../../../r3f/controls/native/styleBoxFlat';
import { popupPanelBox, popupPanelContentsMinimumSize, popupPanelLayout } from './contentLayout';

const THEME = nativeTheme(1);
const CTX = createSolveContext(THEME);
const WHITE = { r: 1, g: 1, b: 1, a: 1 };
const MARGIN_4 = { left: 4, top: 4, right: 4, bottom: 4 };

function shadowed(size: number, offset: { x: number; y: number }) {
  return { ...flatStyleBox(WHITE, { contentMargin: MARGIN_4 }), shadowSize: size, shadowOffset: offset };
}

function popupPanel(children: SolveNode[], panel?: ReturnType<typeof shadowed>, rtl = false): SolveNode {
  const node = controlNode('Popup', 'PopupPanel', { name: 'Popup' });
  return { ...solveNode(), path: 'Popup', node, children, rtl, styleBoxes: panel ? { panel } : {} };
}

function shadowInsets(panel: ReturnType<typeof shadowed>, rtl: boolean) {
  return popupPanelBox(popupPanel([], panel, rtl), THEME).insets;
}

function child(name: string): SolveNode {
  return { ...solveNode(), path: `Popup/${name}`, node: controlNode(name, 'Control', { name }) };
}

describe('popupPanelBox insets', () => {
  it('insets nothing for the default theme panel', () => {
    expect(popupPanelBox(popupPanel([]), THEME).insets).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
  });

  it('insets nothing for a panel with no shadow (`popup.cpp:327-330`)', () => {
    expect(shadowInsets(shadowed(0, { x: 5, y: 5 }), false)).toEqual({
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    });
  });

  it('leaves room for the shadow on each side, less its offset (`popup.cpp:339-343`)', () => {
    expect(shadowInsets(shadowed(8, { x: 2, y: 3 }), false)).toEqual({
      left: 6,
      top: 5,
      right: -10,
      bottom: -11,
    });
  });

  it('mirrors the horizontal offset in a right-to-left layout (`popup.cpp:335-337`)', () => {
    const insets = shadowInsets(shadowed(8, { x: 2, y: 3 }), true);
    expect({ left: insets.left, right: insets.right }).toEqual({ left: 10, right: -6 });
  });

  it('never insets past the edge for an offset larger than the shadow', () => {
    const insets = shadowInsets(shadowed(4, { x: 10, y: 0 }), false);
    expect({ left: insets.left, right: insets.right }).toEqual({ left: 0, right: -14 });
  });
});

describe('popupPanelLayout', () => {
  it('fills the default panel’s content rect with each child', () => {
    const a = child('A');
    const rects = popupPanelLayout(
      popupPanel([a]),
      [{ node: a, minSize: { x: 0, y: 0 } }],
      { x: 0, y: 0, w: 300, h: 200 },
      CTX
    ) as ReadonlyMap<string, unknown>;
    expect(rects.get('Popup/A')).toEqual({ x: 4, y: 4, w: 292, h: 192 });
  });

  it('trims the shadow insets from the content rect (`popup.cpp:347-353`)', () => {
    const a = child('A');
    const rects = popupPanelLayout(
      popupPanel([a], shadowed(8, { x: 2, y: 3 })),
      [{ node: a, minSize: { x: 0, y: 0 } }],
      { x: 0, y: 0, w: 300, h: 200 },
      CTX
    ) as ReadonlyMap<string, unknown>;
    // cpos = (4 + 6, 4 + 5); csize = (300 - 8 - 16, 200 - 8 - 16).
    expect(rects.get('Popup/A')).toEqual({ x: 10, y: 9, w: 276, h: 176 });
  });
});

describe('popupPanelContentsMinimumSize', () => {
  const minimums: Record<string, { x: number; y: number }> = {
    'Popup/A': { x: 50, y: 10 },
    'Popup/B': { x: 20, y: 30 },
    'Popup/Free': { x: 500, y: 500 },
  };
  const ctx = { ...CTX, combinedMinimumSize: (n: SolveNode) => minimums[n.path]! };

  it('adds the panel minimum and shadow insets to the largest child minimum (`popup.cpp:270-291`)', () => {
    const panel = popupPanel([child('A'), child('B')], shadowed(8, { x: 2, y: 3 }));
    expect(popupPanelContentsMinimumSize(panel, ctx)).toEqual({ x: 50 + 16 + 8, y: 30 + 16 + 8 });
  });

  it('leaves out a `top_level` child (`popup.cpp:279-281`)', () => {
    const free = { ...child('Free'), node: controlNode('Free', 'Control', { name: 'Free', topLevel: true }) };
    expect(popupPanelContentsMinimumSize(popupPanel([child('A'), free]), ctx)).toEqual({ x: 58, y: 18 });
  });
});
