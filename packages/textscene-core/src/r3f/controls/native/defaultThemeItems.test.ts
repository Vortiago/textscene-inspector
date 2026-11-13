/** The default `panel` of a Panel or PanelContainer by type chain (`scene/theme/default_theme.cpp:134,1167-1168`). */
import { describe, expect, it } from 'vitest';
import { controlNode, solveNode } from './testing/solveNode';
import type { SolveNode } from './solveTree';
import { panelBoxOf } from './defaultThemeItems';
import { nativeTheme } from './nativeTheme';

const THEME = nativeTheme(1);

function node(type: string, variation?: string): SolveNode {
  return {
    ...solveNode(),
    path: 'N',
    node: controlNode('N', type, { name: 'N', themeTypeVariation: variation }),
  };
}

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
