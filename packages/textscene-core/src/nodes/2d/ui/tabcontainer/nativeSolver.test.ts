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
  tabHeaderBand,
  tabHeaderHeight,
  buildInternalTabBarNode,
} from './nativeSolver';
import type { ThemeResource } from '../../../../resources/styles/theme/types';
import type { TabBarProperties } from '../tabbar/types';
import type { FontResource } from '../../../../resources/fonts/font/types';

/** `tabbar_background` is `make_empty_stylebox(0, 0, 0, 0)` in the default theme (`default_theme.cpp:994`). */
const NO_TABBAR_MARGIN = { left: 0, top: 0, right: 0, bottom: 0 };
/** An asymmetric `theme_override_styles/tabbar_background`, so a left/right swap cannot hide. */
const TABBAR_MARGIN = { left: 10, top: 5, right: 30, bottom: 7 };

function asMap(result: ReadonlyMap<string, Rect2> | ContainerLayoutResult): ReadonlyMap<string, Rect2> {
  return 'rects' in result ? result.rects : result;
}

function page(name: string, props: Partial<ControlProperties> = {}): SolveNode {
  return { ...solveNode(), path: name, node: { name, type: 'Control', children: [], properties: { name, ...props } as ControlProperties } };
}

/** A `theme_override_styles/tabbar_background` carrying `TABBAR_MARGIN`, everything else the default-theme panel's. */
function tabbarBackgroundStyleBoxes(): SolveNode['styleBoxes'] {
  return { tabbar_background: { ...nativeTheme(1).widgets.panel, contentMargin: TABBAR_MARGIN } };
}

function tabContainer(
  name: string,
  props: Partial<TabContainerProperties>,
  children: SolveNode[],
  styleBoxes?: SolveNode['styleBoxes']
): SolveNode {
  return {
    ...solveNode(),
    ...(styleBoxes ? { styleBoxes } : {}),
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
        modulate: { r: 1, g: 1, b: 1, a: 1 },
        z: [],
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
    expect(tabBarRect(RECT, 24, TABS_POSITION_TOP, TAB_ALIGNMENT_LEFT, 8, NO_TABBAR_MARGIN, false)).toEqual({ x: 8, y: 0, w: 192, h: 24 });
  });

  it('CENTER alignment spans the full width, no inset', () => {
    expect(tabBarRect(RECT, 24, TABS_POSITION_TOP, TAB_ALIGNMENT_CENTER, 8, NO_TABBAR_MARGIN, false)).toEqual({ x: 0, y: 0, w: 200, h: 24 });
  });

  it('RIGHT alignment insets the bar by side_margin on the right only', () => {
    expect(tabBarRect(RECT, 24, TABS_POSITION_TOP, TAB_ALIGNMENT_RIGHT, 8, NO_TABBAR_MARGIN, false)).toEqual({ x: 0, y: 0, w: 192, h: 24 });
  });

  it('BOTTOM position places the strip at the container\'s own bottom edge', () => {
    expect(tabBarRect(RECT, 24, TABS_POSITION_BOTTOM, TAB_ALIGNMENT_LEFT, 8, NO_TABBAR_MARGIN, false)).toEqual({ x: 8, y: 76, w: 192, h: 24 });
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
    const size = tabContainerMinimumSize(n, ctx());
    // tabsVisible: false skips the whole header, so only the visible page's
    // minimum (`Wide`'s customMinimumSize) floors it.
    expect(size).toEqual({ x: 300, y: 10 });
  });

  it('use_hidden_tabs_for_min_size widens the floor to the LARGEST page, hidden ones included', () => {
    const wide = page('Wide', { visible: false, customMinimumSize: { x: 300, y: 10 } });
    const narrow = page('Narrow', { customMinimumSize: { x: 10, y: 10 } });
    const n = tabContainer('T', { tabsVisible: false, useHiddenTabsForMinSize: true }, [narrow, wide]);
    const size = tabContainerMinimumSize(n, ctx());
    expect(size.x).toBe(300);
  });

  it('adds the internal tab bar height on top of the tallest page when tabs_visible', () => {
    const p = page('Only', { customMinimumSize: { x: 10, y: 10 } });
    const n = tabContainer('T', { tabsVisible: true }, [p]);
    const size = tabContainerMinimumSize(n, ctx());
    // The bar's own minimum height comes from its tab_selected/unselected
    // style margins (tabbar/nativeSolver.test.ts covers the numbers). Here only
    // the ordering matters: taller than the bare page minimum.
    expect(size.y).toBeGreaterThan(10);
  });

  it('never widens for tab_alignment CENTER (side_margin only applies to LEFT/RIGHT, tab_container.cpp:1039)', () => {
    const p = page('Only');
    const centered = tabContainerMinimumSize(tabContainer('T', { tabsVisible: true, tabAlignment: TAB_ALIGNMENT_CENTER }, [p]), ctx());
    const left = tabContainerMinimumSize(tabContainer('T', { tabsVisible: true, tabAlignment: TAB_ALIGNMENT_LEFT }, [p]), ctx());
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

describe('tabHeaderHeight', () => {
  it("adds the tabbar style's own top and bottom margin to the bar's minimum height (tab_container.cpp:51-58)", () => {
    expect(tabHeaderHeight(24, TABBAR_MARGIN)).toBe(36);
    expect(tabHeaderHeight(24, NO_TABBAR_MARGIN)).toBe(24);
  });
});

describe('tabHeaderBand', () => {
  const RECT: Rect2 = { x: 0, y: 0, w: 200, h: 100 };

  it('spans the whole container width, never the tab bar rect (tab_container.cpp:262)', () => {
    expect(tabHeaderBand(RECT, 36, TABS_POSITION_TOP)).toEqual({ x: 0, y: 0, w: 200, h: 36 });
  });

  it('sits against the bottom edge for POSITION_BOTTOM (tab_container.cpp:258)', () => {
    expect(tabHeaderBand(RECT, 36, TABS_POSITION_BOTTOM)).toEqual({ x: 0, y: 64, w: 200, h: 36 });
  });
});

describe('tabBarRect with an authored tabbar_background margin', () => {
  const RECT: Rect2 = { x: 0, y: 0, w: 400, h: 200 };

  it('insets the bar by that style\u2019s own margins, side_margin on top of the LEFT one (tab_container.cpp:409-429, 372-373)', () => {
    // offset_left = 10 + 8, offset_right = -30 -> x 18, w 400 - 30 - 18 = 352.
    expect(tabBarRect(RECT, 24, TABS_POSITION_TOP, TAB_ALIGNMENT_LEFT, 8, TABBAR_MARGIN, false)).toEqual({
      x: 18,
      y: 5,
      w: 352,
      h: 24,
    });
  });

  it('swaps the left and right margins, then mirrors the whole bar (tab_container.cpp:412, control.cpp:1785-1787)', () => {
    // Swapped: offset_left = 30 + 8 = 38, offset_right = -10 -> unmirrored x 38,
    // w 352; mirrored x = 400 - 38 - 352 = 10. The authored left margin stays on
    // the left; side_margin is what moves to the trailing edge.
    expect(tabBarRect(RECT, 24, TABS_POSITION_TOP, TAB_ALIGNMENT_LEFT, 8, TABBAR_MARGIN, true)).toEqual({
      x: 10,
      y: 5,
      w: 352,
      h: 24,
    });
  });

  it('leaves a CENTER-aligned bar in the same place either way (the swap and the mirror cancel)', () => {
    const ltr = tabBarRect(RECT, 24, TABS_POSITION_TOP, TAB_ALIGNMENT_CENTER, 8, TABBAR_MARGIN, false);
    expect(ltr).toEqual({ x: 10, y: 5, w: 360, h: 24 });
    expect(tabBarRect(RECT, 24, TABS_POSITION_TOP, TAB_ALIGNMENT_CENTER, 8, TABBAR_MARGIN, true)).toEqual(ltr);
  });

  it('moves a RIGHT-aligned bar\u2019s side_margin to the leading edge under RTL (tab_container.cpp:438-453)', () => {
    expect(tabBarRect(RECT, 24, TABS_POSITION_TOP, TAB_ALIGNMENT_RIGHT, 8, TABBAR_MARGIN, false)).toEqual({
      x: 10,
      y: 5,
      w: 352,
      h: 24,
    });
    expect(tabBarRect(RECT, 24, TABS_POSITION_TOP, TAB_ALIGNMENT_RIGHT, 8, TABBAR_MARGIN, true)).toEqual({
      x: 18,
      y: 5,
      w: 352,
      h: 24,
    });
  });

  it('keeps the side_margin flip for the default zero-margin style (default_theme.cpp:994)', () => {
    const ltr = tabBarRect(RECT, 24, TABS_POSITION_TOP, TAB_ALIGNMENT_LEFT, 8, NO_TABBAR_MARGIN, false);
    const rtl = tabBarRect(RECT, 24, TABS_POSITION_TOP, TAB_ALIGNMENT_LEFT, 8, NO_TABBAR_MARGIN, true);
    expect(ltr).toEqual({ x: 8, y: 0, w: 392, h: 24 });
    expect(rtl).toEqual({ x: 0, y: 0, w: 392, h: 24 });
  });

  it('offsets a BOTTOM-positioned bar by the header height, then back down by the top margin (tab_container.cpp:369-370)', () => {
    expect(tabBarRect(RECT, 24, TABS_POSITION_BOTTOM, TAB_ALIGNMENT_LEFT, 8, TABBAR_MARGIN, false)).toEqual({
      x: 18,
      y: 200 - 36 + 5,
      w: 352,
      h: 24,
    });
  });
});

describe('the tabbar style margins reach the minimum size and the page band', () => {
  it("adds all four of the tabbar style's margins to the minimum size (tab_container.cpp:1032-1033)", () => {
    const p = page('Only', { customMinimumSize: { x: 10, y: 10 } });
    const bare = tabContainerMinimumSize(tabContainer('T', { tabsVisible: true }, [p]), ctx());
    const margined = 
      tabContainerMinimumSize(tabContainer('T', { tabsVisible: true }, [p], tabbarBackgroundStyleBoxes()), ctx())
    ;
    expect(margined.x - bare.x).toBe(TABBAR_MARGIN.left + TABBAR_MARGIN.right);
    expect(margined.y - bare.y).toBe(TABBAR_MARGIN.top + TABBAR_MARGIN.bottom);
  });

  it('pushes the page band down by the same top and bottom margin (_get_tab_height, tab_container.cpp:383)', () => {
    const p = page('Only');
    const child = [{ node: p, minSize: { x: 0, y: 0 } }];
    const rect: Rect2 = { x: 0, y: 0, w: 200, h: 200 };
    const bare = asMap(tabContainerLayout(tabContainer('T', { tabsVisible: true }, [p]), child, rect, ctx())).get('Only')!;
    const margined = asMap(
      tabContainerLayout(tabContainer('T', { tabsVisible: true }, [p], tabbarBackgroundStyleBoxes()), child, rect, ctx())
    ).get('Only')!;
    expect(margined.y - bare.y).toBe(TABBAR_MARGIN.top + TABBAR_MARGIN.bottom);
    expect(bare.h - margined.h).toBe(TABBAR_MARGIN.top + TABBAR_MARGIN.bottom);
  });

  it('leaves a header-less TabContainer untouched by them', () => {
    const p = page('Only');
    const child = [{ node: p, minSize: { x: 0, y: 0 } }];
    const rect: Rect2 = { x: 0, y: 0, w: 200, h: 200 };
    const rects = asMap(
      tabContainerLayout(tabContainer('T', { tabsVisible: false }, [p], tabbarBackgroundStyleBoxes()), child, rect, ctx())
    );
    expect(rects.get('Only')).toEqual(rect);
  });
});

describe('the page band under RTL', () => {
  /** A `theme_override_styles/panel` whose left and right content margins differ. */
  function panelStyleBoxes(): SolveNode['styleBoxes'] {
    return { panel: { ...nativeTheme(1).widgets.panel, contentMargin: { left: 6, top: 3, right: 26, bottom: 3 } } };
  }

  function pageRect(rtl: boolean): Rect2 {
    const p = page('Only');
    const n = { ...tabContainer('T', { tabsVisible: false }, [p], panelStyleBoxes()), rtl };
    const rects = asMap(tabContainerLayout(n, [{ node: p, minSize: { x: 0, y: 0 } }], { x: 0, y: 0, w: 300, h: 120 }, ctx()));
    return rects.get('Only')!;
  }

  it("insets the page by the panel style's own left margin under LTR (tab_container.cpp:390-391)", () => {
    expect(pageRect(false)).toEqual({ x: 6, y: 3, w: 300 - 6 - 26, h: 120 - 6 });
  });

  it('mirrors that inset under RTL, so the RIGHT margin lands on the left (control.cpp:1785-1787)', () => {
    // `_repaint` sets the page's offsets directly and never routes through
    // `fit_child_in_rect`, so `_size_changed`'s mirror is the last word:
    // x = 300 - 6 - 268 = 26.
    expect(pageRect(true)).toEqual({ x: 26, y: 3, w: 300 - 6 - 26, h: 120 - 6 });
  });

  it('leaves a symmetric panel margin in the same place either way', () => {
    const p = page('Only');
    const symmetric: SolveNode['styleBoxes'] = {
      panel: { ...nativeTheme(1).widgets.panel, contentMargin: { left: 8, top: 3, right: 8, bottom: 3 } },
    };
    const child = [{ node: p, minSize: { x: 0, y: 0 } }];
    const rect: Rect2 = { x: 0, y: 0, w: 300, h: 120 };
    const ltr = asMap(tabContainerLayout(tabContainer('T', { tabsVisible: false }, [p], symmetric), child, rect, ctx()));
    const rtl = asMap(
      tabContainerLayout({ ...tabContainer('T', { tabsVisible: false }, [p], symmetric), rtl: true }, child, rect, ctx())
    );
    expect(rtl.get('Only')).toEqual(ltr.get('Only'));
  });

  it('counts PAGES, not children, when deciding whether a header exists at all (tab_container.cpp:52)', () => {
    // `_get_tab_controls` drops a `top_level` child (`container.cpp:144-146`),
    // so a container holding only one has no tabs and therefore no header.
    const p = page('Floating', { topLevel: true } as never);
    const n = tabContainer('T', { tabsVisible: true }, [p], tabbarBackgroundStyleBoxes());
    const rects = asMap(tabContainerLayout(n, [{ node: p, minSize: { x: 0, y: 0 } }], { x: 0, y: 0, w: 200, h: 100 }, ctx()));
    expect(rects.get('Floating')!.y).toBe(0);
  });
});

describe('buildInternalTabBarNode — the theme items TabContainer pushes onto its bar', () => {
  // `_on_theme_changed` resolves `tab_font`/`tab_font_size` on the container (bound as "font"
  // and "font_size", `tab_container.cpp:1264-1265`) and pushes both onto the internal bar as
  // overrides (`tab_container.cpp:338-339`), so the bar never runs its `TabBar` type chain.
  const THEME = nativeTheme(1);

  function themeResource(overrides: Partial<ThemeResource>): ThemeResource {
    return {
      defaultFont: null,
      defaultFontSize: undefined,
      fonts: {},
      fontSizes: {},
      styles: {},
      colors: {},
      constants: {},
      typeVariations: {},
      properties: {},
      resources: { externalResources: [], internalResources: [] },
      ...overrides,
    };
  }

  function container(props: Partial<TabContainerProperties>, projectTheme: ThemeResource | null = null): SolveNode {
    return {
      ...solveNode(),
      path: 'Tabs',
      node: { name: 'Tabs', type: 'TabContainer', children: [], properties: { name: 'Tabs', ...props } as TabContainerProperties },
      projectTheme,
    };
  }

  function barFontSize(n: SolveNode): number | undefined {
    const bar = buildInternalTabBarNode(n, [], n.node.properties as TabContainerProperties, THEME);
    return (bar.node.properties as TabBarProperties).themeOverrideFontSizes?.font_size;
  }

  it("pushes the container's own theme_override_font_sizes/font_size", () => {
    expect(barFontSize(container({ themeOverrideFontSizes: { font_size: 28 } }))).toBe(28);
  });

  it("pushes a theme entry addressed to TabContainer, which the bar's own type chain would never find", () => {
    const projectTheme = themeResource({ fontSizes: { TabContainer: { font_size: 22 }, TabBar: { font_size: 9 } } });
    expect(barFontSize(container({}, projectTheme))).toBe(22);
  });

  it('falls back to the built-in default size when nothing resolves', () => {
    expect(barFontSize(container({}))).toBe(THEME.fontSize);
  });

  it("pushes the FONT the same way, off a TabContainer-addressed theme entry (tab_container.cpp:338)", () => {
    const containerFont: FontResource = { kind: 'system', fontNames: ['Container Face'], properties: {} };
    const barFont: FontResource = { kind: 'system', fontNames: ['Bar Face'], properties: {} };
    const projectTheme = themeResource({ fonts: { TabContainer: { font: containerFont }, TabBar: { font: barFont } } });
    const n = container({}, projectTheme);
    const bar = buildInternalTabBarNode(n, [], n.node.properties as TabContainerProperties, THEME);
    expect(bar.fontOverrides.font).toBe(containerFont);
  });
});
