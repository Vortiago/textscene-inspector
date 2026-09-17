import { describe, expect, it } from 'vitest';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { ContainerLayoutResult, SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { TAB_ALIGNMENT_CENTER, TAB_ALIGNMENT_LEFT, TAB_ALIGNMENT_RIGHT } from '../tabbar/nativeSolver';
import type { ControlProperties } from '../control/types';
import type { TabContainerProperties } from './types';
import {
  TABS_POSITION_BOTTOM,
  TABS_POSITION_TOP,
  deriveTabContainerTabs,
  tabBarRect,
  tabContainerLayout,
  tabContainerMinimumSize,
  tabContentBand,
} from './nativeSolver';

function asMap(result: ReadonlyMap<string, Rect2> | ContainerLayoutResult): ReadonlyMap<string, Rect2> {
  return 'rects' in result ? result.rects : result;
}

function asVec2(result: ReturnType<typeof tabContainerMinimumSize>): { x: number; y: number } {
  return 'size' in result ? result.size : result;
}

function page(name: string, props: Partial<ControlProperties> = {}): SolveNode {
  return { ...solveNode(), path: name, node: { name, type: 'Control', children: [], properties: { name, ...props } as ControlProperties } };
}

function tabContainer(name: string, props: Partial<TabContainerProperties>, children: SolveNode[]): SolveNode {
  return {
    ...solveNode(),
    path: name,
    node: { name, type: 'TabContainer', children: [], properties: { name, ...props } as TabContainerProperties },
    children,
  };
}

function ctx(): SolveContext {
  const theme = nativeTheme(1);
  return {
    theme,
    measureText: null,
    combinedMinimumSize: (n) => (n.node.properties as ControlProperties).customMinimumSize ?? { x: 0, y: 0 },
  };
}

describe('deriveTabContainerTabs', () => {
  it("uses the child's own node name when no override is present (add_child_notify, tab_container.cpp:653)", () => {
    const tabs = deriveTabContainerTabs({ children: [page('General'), page('Advanced')] }, undefined);
    expect(tabs.map((t) => t.title)).toEqual(['General', 'Advanced']);
    expect(tabs.every((t) => !t.disabled && !t.hidden)).toBe(true);
  });

  it('leaves a top_level child out of the page list entirely', () => {
    // `as_sortable_control` rejects the flag before it looks at visibility
    // (`container.cpp:144-146`), and `_get_tab_controls` (`:469-481`) calls it
    // for every child, so a top_level Control is no page at all.
    const tabs = deriveTabContainerTabs(
      { children: [page('General'), page('Floating', { topLevel: true }), page('Advanced')] },
      undefined
    );
    expect(tabs.map((t) => t.title)).toEqual(['General', 'Advanced']);
  });

  it('a tab_<idx>/title override replaces the child name; other overrides are per-index too', () => {
    const tabs = deriveTabContainerTabs(
      { children: [page('General'), page('Advanced'), page('Locked')] },
      { 1: { title: 'Custom', icon: 'ExtResource("1")' }, 2: { disabled: true, hidden: true } }
    );
    expect(tabs[0]).toMatchObject({ title: 'General', disabled: false, hidden: false });
    expect(tabs[1]).toMatchObject({ title: 'Custom', icon: 'ExtResource("1")' });
    expect(tabs[2]).toMatchObject({ title: 'Locked', disabled: true, hidden: true });
  });

  it('is not a tab when the walker promoted it past a Node2D — `_get_tab_controls` casts `get_child(i)` (tab_container.cpp:469-481)', () => {
    const promoted: SolveNode = {
      ...page('Promoted'),
      path: 'Holder/Promoted',
      skippedAncestors: {
        transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
        visible: true,
        modulate: { r: 1, g: 1, b: 1, a: 1 },
      },
    };
    const tabs = deriveTabContainerTabs({ children: [page('General'), promoted, page('Advanced')] }, undefined);
    expect(tabs.map((t) => t.title)).toEqual(['General', 'Advanced']);
  });

  it('returns an empty list for a childless TabContainer', () => {
    expect(deriveTabContainerTabs({ children: [] }, undefined)).toEqual([]);
  });
});

describe('tabBarRect', () => {
  const RECT: Rect2 = { x: 0, y: 0, w: 200, h: 100 };

  it('LEFT alignment insets the bar by side_margin on the left only', () => {
    expect(tabBarRect(RECT, 24, TABS_POSITION_TOP, TAB_ALIGNMENT_LEFT, 8)).toEqual({ x: 8, y: 0, w: 192, h: 24 });
  });

  it('CENTER alignment spans the full width, no inset', () => {
    expect(tabBarRect(RECT, 24, TABS_POSITION_TOP, TAB_ALIGNMENT_CENTER, 8)).toEqual({ x: 0, y: 0, w: 200, h: 24 });
  });

  it('RIGHT alignment insets the bar by side_margin on the right only', () => {
    expect(tabBarRect(RECT, 24, TABS_POSITION_TOP, TAB_ALIGNMENT_RIGHT, 8)).toEqual({ x: 0, y: 0, w: 192, h: 24 });
  });

  it('BOTTOM position places the strip at the container\'s own bottom edge', () => {
    expect(tabBarRect(RECT, 24, TABS_POSITION_BOTTOM, TAB_ALIGNMENT_LEFT, 8)).toEqual({ x: 8, y: 76, w: 192, h: 24 });
  });
});

describe('tabContentBand', () => {
  const RECT: Rect2 = { x: 0, y: 0, w: 200, h: 100 };

  it('TOP position pushes the content band below the strip', () => {
    expect(tabContentBand(RECT, 24, TABS_POSITION_TOP)).toEqual({ x: 0, y: 24, w: 200, h: 76 });
  });

  it('BOTTOM position keeps the content band at the top, shortened by the strip', () => {
    expect(tabContentBand(RECT, 24, TABS_POSITION_BOTTOM)).toEqual({ x: 0, y: 0, w: 200, h: 76 });
  });
});

describe('tabContainerMinimumSize', () => {
  it('floors the width to the current (visible) page alone when use_hidden_tabs_for_min_size is false', () => {
    const wide = page('Wide', { customMinimumSize: { x: 300, y: 10 } });
    const narrow = page('Narrow', { visible: false, customMinimumSize: { x: 10, y: 10 } });
    const n = tabContainer('T', { tabsVisible: false }, [narrow, wide]);
    const size = asVec2(tabContainerMinimumSize(n, ctx()));
    // tabsVisible: false, so the ENTIRE header contribution is skipped —
    // only the visible page's own minimum (`Wide`'s customMinimumSize) floors it.
    expect(size).toEqual({ x: 300, y: 10 });
  });

  it('use_hidden_tabs_for_min_size widens the floor to the LARGEST page, hidden ones included', () => {
    const wide = page('Wide', { visible: false, customMinimumSize: { x: 300, y: 10 } });
    const narrow = page('Narrow', { customMinimumSize: { x: 10, y: 10 } });
    const n = tabContainer('T', { tabsVisible: false, useHiddenTabsForMinSize: true }, [narrow, wide]);
    const size = asVec2(tabContainerMinimumSize(n, ctx()));
    expect(size.x).toBe(300);
  });

  it('adds the internal tab bar height on top of the tallest page when tabs_visible', () => {
    const p = page('Only', { customMinimumSize: { x: 10, y: 10 } });
    const n = tabContainer('T', { tabsVisible: true }, [p]);
    const size = asVec2(tabContainerMinimumSize(n, ctx()));
    // The bar's own minimum height comes from its tab_selected/unselected
    // style margins (tabbar/nativeSolver.test.ts covers the exact numbers);
    // here only the ORDERING matters: taller than the bare page minimum.
    expect(size.y).toBeGreaterThan(10);
  });

  it('never widens for tab_alignment CENTER (side_margin only applies to LEFT/RIGHT, tab_container.cpp:1039)', () => {
    const p = page('Only');
    const centered = asVec2(tabContainerMinimumSize(tabContainer('T', { tabsVisible: true, tabAlignment: TAB_ALIGNMENT_CENTER }, [p]), ctx()));
    const left = asVec2(tabContainerMinimumSize(tabContainer('T', { tabsVisible: true, tabAlignment: TAB_ALIGNMENT_LEFT }, [p]), ctx()));
    expect(left.x).toBeGreaterThan(centered.x);
  });
});

describe('tabContainerLayout', () => {
  it('gives every page — current AND hidden — the SAME content rect (the walker hides the rest via their own `visible`)', () => {
    const current = page('Current');
    const hidden = page('Hidden', { visible: false });
    const n = tabContainer('T', { tabsVisible: true, tabsPosition: TABS_POSITION_TOP }, [current, hidden]);
    const rects = asMap(tabContainerLayout(n, [{ node: current, minSize: { x: 0, y: 0 } }, { node: hidden, minSize: { x: 0, y: 0 } }], { x: 0, y: 0, w: 200, h: 100 }, ctx()));
    expect(rects.get('Current')).toEqual(rects.get('Hidden'));
    // The content rect starts below wherever the (non-zero) tab strip ends.
    expect(rects.get('Current')!.y).toBeGreaterThan(0);
  });

  it('tabs_visible=false gives the page the WHOLE rect — no header inset at all', () => {
    const p = page('Only');
    const n = tabContainer('T', { tabsVisible: false }, [p]);
    const rects = asMap(tabContainerLayout(n, [{ node: p, minSize: { x: 0, y: 0 } }], { x: 0, y: 0, w: 200, h: 100 }, ctx()));
    expect(rects.get('Only')).toEqual({ x: 0, y: 0, w: 200, h: 100 });
  });

  it('returns an empty map for a childless TabContainer', () => {
    const n = tabContainer('T', {}, []);
    const rects = asMap(tabContainerLayout(n, [], { x: 0, y: 0, w: 200, h: 100 }, ctx()));
    expect(rects.size).toBe(0);
  });
});
