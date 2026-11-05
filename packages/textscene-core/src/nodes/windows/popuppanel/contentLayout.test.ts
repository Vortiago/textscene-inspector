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
import { popupPanelContentsMinimumSize, popupPanelLayout, popupPanelShadowInsets } from './contentLayout';

const CTX = createSolveContext(nativeTheme(1));
const WHITE = { r: 1, g: 1, b: 1, a: 1 };
const MARGIN_4 = { left: 4, top: 4, right: 4, bottom: 4 };

function shadowed(size: number, offset: { x: number; y: number }) {
  return { ...flatStyleBox(WHITE, { contentMargin: MARGIN_4 }), shadowSize: size, shadowOffset: offset };
}

function popupPanel(children: SolveNode[], panel?: ReturnType<typeof shadowed>, rtl = false): SolveNode {
  const node = controlNode('Popup', 'PopupPanel', { name: 'Popup' });
  return { ...solveNode(), path: 'Popup', node, children, rtl, styleBoxes: panel ? { panel } : {} };
}

function child(name: string): SolveNode {
  return { ...solveNode(), path: `Popup/${name}`, node: controlNode(name, 'Control', { name }) };
}

describe('popupPanelShadowInsets', () => {
  it('insets nothing for a panel with no shadow (`popup.cpp:327-330`)', () => {
    expect(popupPanelShadowInsets(shadowed(0, { x: 5, y: 5 }), false)).toEqual({
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
    });
  });

  it('leaves room for the shadow on each side, less its offset (`popup.cpp:339-343`)', () => {
    expect(popupPanelShadowInsets(shadowed(8, { x: 2, y: 3 }), false)).toEqual({
      left: 6,
      top: 5,
      right: -10,
      bottom: -11,
    });
  });

  it('mirrors the horizontal offset in a right-to-left layout (`popup.cpp:335-337`)', () => {
    const insets = popupPanelShadowInsets(shadowed(8, { x: 2, y: 3 }), true);
    expect({ left: insets.left, right: insets.right }).toEqual({ left: 10, right: -6 });
  });

  it('never insets past the edge for an offset larger than the shadow', () => {
    const insets = popupPanelShadowInsets(shadowed(4, { x: 10, y: 0 }), false);
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
  it('adds the panel minimum and shadow insets to the largest child minimum (`popup.cpp:270-291`)', () => {
    const panel = popupPanel([], shadowed(8, { x: 2, y: 3 }));
    const minimum = popupPanelContentsMinimumSize(
      panel,
      [
        { x: 50, y: 10 },
        { x: 20, y: 30 },
      ],
      CTX.theme
    );
    expect(minimum).toEqual({ x: 50 + 16 + 8, y: 30 + 16 + 8 });
  });
});
