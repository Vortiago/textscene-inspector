/** The draw of a TabBar at its solved size: which tabs draw, in which order, and the scroll arrows. */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { controlNode, solveNode, withThemeItems } from '../../../../r3f/controls/native/testing/solveNode';
import { controlProps } from '../control/testing/controlProps';
import { tabBarLayout } from './tabBarLayout';
import type { TabBarProperties, TabBarTabProperties } from './types';

function tab(title: string, more: Partial<TabBarTabProperties> = {}): TabBarTabProperties {
  return { title, tooltip: '', disabled: false, ...more };
}

function bar(props: Partial<TabBarProperties>): SolveNode {
  const properties: TabBarProperties = controlProps({ name: 'T', ...props });
  return withThemeItems({ ...solveNode(), path: 'T', node: controlNode('T', 'TabBar', properties) });
}

function drawOf(props: Partial<TabBarProperties>, width = 400) {
  return tabBarLayout(bar(props), { x: width, y: 32 }, nativeTheme(1)).at(undefined);
}

const indices = (props: Partial<TabBarProperties>, width?: number) =>
  drawOf(props, width).tabs.map((drawn) => drawn.index);

describe('tabBarLayout', () => {
  it('draws nothing for a bar with no tab', () => {
    expect(drawOf({ tabs: [] })).toEqual({ tabs: [], arrows: null });
  });

  it('draws one tab at the left edge', () => {
    const [only] = drawOf({ tabs: [tab('Map')] }).tabs;
    expect(only?.x).toBe(0);
  });

  it('skips a hidden tab', () => {
    expect(indices({ tabs: [tab('A'), tab('B', { hidden: true }), tab('C')] })).toEqual([2, 0]);
  });

  it('draws a disabled tab in its disabled box', () => {
    const n = bar({ tabs: [tab('A'), tab('B', { disabled: true })] });
    const drawn = tabBarLayout(n, { x: 400, y: 32 }, nativeTheme(1)).at(undefined).tabs[0]!;
    expect(drawn.tab.style).toBe(n.styleBoxes.tab_disabled);
  });

  it('draws the current tab last (tab_bar.cpp:555-561)', () => {
    expect(indices({ currentTab: 1, tabs: [tab('A'), tab('B'), tab('C')] })).toEqual([0, 2, 1]);
  });

  it('shows the scroll arrows once clip_tabs leaves tabs out', () => {
    const many = { clipTabs: true, tabs: ['Alpha', 'Bravo', 'Charlie', 'Delta'].map((t) => tab(t)) };
    const draw = drawOf(many, 90);
    expect(draw.arrows).not.toBeNull();
    expect(draw.tabs.length).toBeLessThan(4);
  });

  it('keeps one draw for each first drawn tab', () => {
    const layout = tabBarLayout(bar({ tabs: [tab('A')] }), { x: 400, y: 32 }, nativeTheme(1));
    expect(layout.at(0)).toBe(layout.at(0));
  });
});
