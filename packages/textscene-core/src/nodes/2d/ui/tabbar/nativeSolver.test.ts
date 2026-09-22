import { describe, expect, it } from 'vitest';
import {
  computeTabBarDrawLayout,
  isCloseButtonVisible,
  layoutScrollArrows,
  layoutTabContent,
  pickTabStyleBox,
  resolveTabDrawState,
  tabBarMinimumSize,
  tabBarStyleBoxes,
  tabBarThemeIconSize,
  tabBarFontSizePx,
  tabContentWidth,
  tabDrawX,
  tabWidthStyleMinWidth,
  shapeTabLabel,
} from './nativeSolver';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import type { TabBarProperties } from './types';

describe('resolveTabDrawState', () => {
  it('picks selected for the current tab', () => {
    expect(resolveTabDrawState({ disabled: false }, 1, 1)).toBe('selected');
  });
  it('picks disabled regardless of current (tab_bar.cpp:62 checks disabled FIRST)', () => {
    expect(resolveTabDrawState({ disabled: true }, 1, 1)).toBe('disabled');
  });
  it('picks unselected for every other tab', () => {
    expect(resolveTabDrawState({ disabled: false }, 0, 1)).toBe('unselected');
  });
});

describe('tabBarStyleBoxes', () => {
  // default_theme.cpp:974-985, scale 1.
  it('builds tab_selected: style_normal_color fill, 10/4 margins, a round(2)px white top border', () => {
    const { selected } = tabBarStyleBoxes(1);
    expect(selected.bgColor).toEqual({ r: 0.1, g: 0.1, b: 0.1, a: 0.6 });
    expect(selected.contentMargin).toEqual({ left: 10, top: 4, right: 10, bottom: 4 });
    expect(selected.borderWidth).toEqual({ left: 0, top: 2, right: 0, bottom: 0 });
    expect(selected.borderColor).toEqual({ r: 1, g: 1, b: 1, a: 0.75 });
  });

  it('builds tab_unselected: style_pressed_color fill, a round(1)px popup-border-colour side border', () => {
    const { unselected } = tabBarStyleBoxes(1);
    expect(unselected.bgColor).toEqual({ r: 0, g: 0, b: 0, a: 0.6 });
    expect(unselected.borderWidth).toEqual({ left: 1, top: 0, right: 1, bottom: 0 });
    expect(unselected.borderColor).toEqual({ r: 0.175, g: 0.175, b: 0.175, a: 1 });
  });

  it('duplicates tab_disabled/tab_hovered from tab_unselected, overriding only bg_color (default_theme.cpp:982-985)', () => {
    const { unselected, disabled, hovered } = tabBarStyleBoxes(1);
    expect(disabled.contentMargin).toEqual(unselected.contentMargin);
    expect(disabled.borderWidth).toEqual(unselected.borderWidth);
    expect(disabled.bgColor).toEqual({ r: 0.1, g: 0.1, b: 0.1, a: 0.3 });
    expect(hovered.bgColor).toEqual({ r: 0.1, g: 0.1, b: 0.1, a: 0.3 });
  });

  it('scales every margin/border width independently, rounding each (scale 1.5)', () => {
    const { selected } = tabBarStyleBoxes(1.5);
    // round(10*1.5)=15, round(4*1.5)=6, round(2*1.5)=3.
    expect(selected.contentMargin).toEqual({ left: 15, top: 6, right: 15, bottom: 6 });
    expect(selected.borderWidth.top).toBe(3);
  });
});

describe('pickTabStyleBox / tabWidthStyleMinWidth', () => {
  it('an override wins over the default for the matching state', () => {
    const defaults = tabBarStyleBoxes(1);
    const override = { ...defaults.selected, contentMargin: { left: 1, top: 1, right: 1, bottom: 1 } };
    const picked = pickTabStyleBox({ tab_selected: override }, defaults, 'selected');
    expect(picked.contentMargin).toEqual({ left: 1, top: 1, right: 1, bottom: 1 });
  });

  it('unselected width measurement takes the WIDER of unselected/hovered (tab_bar.cpp:1764)', () => {
    const defaults = tabBarStyleBoxes(1);
    const widerHovered = { ...defaults.hovered, contentMargin: { left: 50, top: 4, right: 50, bottom: 4 } };
    const width = tabWidthStyleMinWidth({ tab_hovered: widerHovered }, defaults, 'unselected');
    expect(width).toBe(100);
  });

  it('selected/disabled width never consults tab_hovered', () => {
    const defaults = tabBarStyleBoxes(1);
    const widerHovered = { ...defaults.hovered, contentMargin: { left: 999, top: 4, right: 999, bottom: 4 } };
    expect(tabWidthStyleMinWidth({ tab_hovered: widerHovered }, defaults, 'selected')).toBe(20);
  });
});

describe('tabContentWidth', () => {
  it('sums style + icon + text + close, each gated by presence, one h_separation apart', () => {
    const width = tabContentWidth({
      styleMinWidth: 20,
      iconWidth: null,
      hSeparation: 4,
      textWidthPx: 30,
      hasText: true,
      closeVisible: false,
      closeIconWidth: 16,
      closeButtonMarginLeft: 4,
    });
    // 20 (style) + 30 (text) + 4 (separation) = 54, then the trailing
    // separation is removed since something beyond the style min was added.
    expect(width).toBe(50);
  });

  it('returns the bare style minimum when the tab has no icon/text/close', () => {
    const width = tabContentWidth({
      styleMinWidth: 20,
      iconWidth: null,
      hSeparation: 4,
      textWidthPx: 0,
      hasText: false,
      closeVisible: false,
      closeIconWidth: 16,
      closeButtonMarginLeft: 4,
    });
    expect(width).toBe(20);
  });

  it('adds icon + close alongside text, each with its own separation', () => {
    const width = tabContentWidth({
      styleMinWidth: 20,
      iconWidth: 12,
      hSeparation: 4,
      textWidthPx: 30,
      hasText: true,
      closeVisible: true,
      closeIconWidth: 16,
      closeButtonMarginLeft: 4,
    });
    // 20 + (12+4) + (30+4) + (4+16+4) - 4(trailing) = 20+16+34+24-4 = 90.
    expect(width).toBe(90);
  });
});

describe('isCloseButtonVisible', () => {
  it('SHOW_NEVER (0) is never visible', () => expect(isCloseButtonVisible(0, 0, 0)).toBe(false));
  it('SHOW_ACTIVE_ONLY (1) is visible only on the current tab', () => {
    expect(isCloseButtonVisible(1, 2, 2)).toBe(true);
    expect(isCloseButtonVisible(1, 1, 2)).toBe(false);
  });
  it('SHOW_ALWAYS (2) is visible on every tab', () => expect(isCloseButtonVisible(2, 5, -1)).toBe(true));
});

describe('computeTabBarDrawLayout', () => {
  it('lays out every tab left-to-right, one tab_separation apart, when nothing overflows', () => {
    const layout = computeTabBarDrawLayout(
      [
        { disabled: false, hidden: false, naturalWidth: 30, naturalTextWidth: 10 },
        { disabled: false, hidden: false, naturalWidth: 40, naturalTextWidth: 10 },
        { disabled: false, hidden: false, naturalWidth: 50, naturalTextWidth: 10 },
      ],
      200,
      0,
      false,
      0,
      2,
      16
    );
    expect(layout.items.map((i) => [i.ofs, i.width])).toEqual([
      [0, 30],
      [32, 40],
      [74, 50],
    ]);
    expect(layout.maxDrawnTab).toBe(2);
    expect(layout.missingRight).toBe(false);
    expect(layout.buttonsVisible).toBe(false);
  });

  it('clips trailing tabs that overflow the bar, exposing the scroll arrows', () => {
    const layout = computeTabBarDrawLayout(
      [
        { disabled: false, hidden: false, naturalWidth: 30, naturalTextWidth: 10 },
        { disabled: false, hidden: false, naturalWidth: 40, naturalTextWidth: 10 },
        { disabled: false, hidden: false, naturalWidth: 50, naturalTextWidth: 10 },
      ],
      60,
      0,
      true,
      0,
      2,
      16
    );
    expect(layout.maxDrawnTab).toBe(0);
    expect(layout.items).toHaveLength(1);
    expect(layout.missingRight).toBe(true);
    expect(layout.buttonsVisible).toBe(true);
  });

  it('truncates a tab past max_tab_width: sizeTextless floors the text budget at 1px (tab_bar.cpp:1215-1222)', () => {
    const layout = computeTabBarDrawLayout(
      [{ disabled: false, hidden: false, naturalWidth: 30, naturalTextWidth: 15 }],
      200,
      0,
      false,
      20,
      0,
      16
    );
    expect(layout.items[0]).toMatchObject({ width: 20, textBudgetPx: 5, truncated: true });
  });

  it('omits a hidden tab from the drawn items and its own space entirely', () => {
    const layout = computeTabBarDrawLayout(
      [
        { disabled: false, hidden: true, naturalWidth: 30, naturalTextWidth: 10 },
        { disabled: false, hidden: false, naturalWidth: 40, naturalTextWidth: 10 },
      ],
      200,
      0,
      false,
      0,
      2,
      16
    );
    expect(layout.items).toHaveLength(1);
    expect(layout.items[0]).toMatchObject({ index: 1, ofs: 0 });
  });

  it('right-aligns the drawn run against the bar width when tab_alignment is RIGHT', () => {
    const layout = computeTabBarDrawLayout(
      [{ disabled: false, hidden: false, naturalWidth: 30, naturalTextWidth: 10 }],
      100,
      2,
      false,
      0,
      0,
      16
    );
    expect(layout.items[0]!.ofs).toBe(70);
  });

  it('returns an empty layout for zero tabs', () => {
    const layout = computeTabBarDrawLayout([], 100, 0, false, 0, 0, 16);
    expect(layout).toEqual({ items: [], offset: 0, maxDrawnTab: 0, missingRight: false, buttonsVisible: false });
  });

  it('reserves incrementIconWidth + decrementIconWidth separately when they differ (a themed pair need not stay symmetric)', () => {
    const tabs = [
      { disabled: false, hidden: false, naturalWidth: 40, naturalTextWidth: 10 },
      { disabled: false, hidden: false, naturalWidth: 40, naturalTextWidth: 10 },
      { disabled: false, hidden: false, naturalWidth: 40, naturalTextWidth: 10 },
    ];
    // w reaches 120 at i=2 (> limit=100), clips there: w -= 40 -> 80, maxDrawnTab=1.
    // A small reserved gap (limitMinusButtons=90) already fits under 80: no further shedding.
    const small = computeTabBarDrawLayout(tabs, 100, 0, true, 0, 0, 5, 5);
    expect(small.maxDrawnTab).toBe(1);
    // A large reserved gap (limitMinusButtons=100-30-30=40) does not fit under 80:
    // the while-loop sheds tab 1 too, dropping maxDrawnTab to 0.
    const large = computeTabBarDrawLayout(tabs, 100, 0, true, 0, 0, 30, 30);
    expect(large.maxDrawnTab).toBe(0);
    // The two widths need not match — this is exactly what a themed pair needs.
    const asymmetric = computeTabBarDrawLayout(tabs, 100, 0, true, 0, 0, 55, 5);
    expect(asymmetric.maxDrawnTab).toBe(0);
  });
});

describe('tabBarThemeIconSize (BIND_THEME_ITEM_CUSTOM(..., close_icon, "close") et al., tab_bar.cpp:2160-2182)', () => {
  it('is the vendored 16x16 default when nothing themed it', () => {
    expect(tabBarThemeIconSize({ textureSlots: {} }, 'close')).toEqual({ x: 16, y: 16 });
  });

  it('is the themed size when the walker resolved a "close"/"increment"/"decrement" slot', () => {
    expect(tabBarThemeIconSize({ textureSlots: { close: { x: 24, y: 24 } } }, 'close')).toEqual({ x: 24, y: 24 });
    expect(tabBarThemeIconSize({ textureSlots: {} }, 'increment')).toEqual({ x: 16, y: 16 });
  });
});

describe('tabBarMinimumSize — a themed "close" icon widens both axes (tab_bar.cpp:44-122)', () => {
  function ctx(): SolveContext {
    return { theme: nativeTheme(1), measureText: null, combinedMinimumSize: () => ({ x: 0, y: 0 }) };
  }

  function node(overrides: Partial<SolveNode> = {}): SolveNode {
    const props: TabBarProperties = {
      name: 'T',
      tabs: [{ title: '', tooltip: '', disabled: false }],
      tabCloseDisplayPolicy: 2, // ALWAYS
    };
    return {
      ...solveNode(),
      path: 'T',
      node: { name: 'T', type: 'TabBar', children: [], properties: props },
      ...overrides,
    };
  }

  it('floors on the vendored 16x16 close icon when untethered', () => {
    const size = tabBarMinimumSize(node(), ctx());
    // styleMinWidth(0, no styleboxes resolved) + closeButtonMarginLeft(0, no button style resolved) + close(16).
    expect(size.x).toBeGreaterThanOrEqual(16);
    expect(size.y).toBeGreaterThanOrEqual(16);
  });

  it('widens on a themed "close" icon bigger than the vendored default', () => {
    const untetheredSize = tabBarMinimumSize(node(), ctx());
    const themedSize = tabBarMinimumSize(node({ textureSlots: { close: { x: 40, y: 32 } } }), ctx());
    expect(themedSize.x).toBeGreaterThan(untetheredSize.x);
    expect(themedSize.y).toBeGreaterThan(untetheredSize.y);
  });
});

describe('tabBarFontSizePx', () => {
  // `theme_cache.font_size` (`tab_bar.cpp:365`) is a bound theme ITEM
  // (`tab_bar.cpp:2179`), so `Control::get_theme_font_size` answers it: a
  // node-local override wins, but only while it is POSITIVE
  // (`control.cpp:3113-3117`).
  const THEME = nativeTheme(1);
  const bar = (): SolveNode => ({
    ...solveNode(),
    path: 'T',
    node: { name: 'T', type: 'TabBar', children: [], properties: { name: 'T' } as TabBarProperties },
  });

  it('answers the theme default when the node overrides nothing', () => {
    expect(tabBarFontSizePx(bar(), {}, THEME)).toBe(THEME.fontSize);
  });

  it('a positive theme_override_font_sizes/font_size wins', () => {
    expect(tabBarFontSizePx(bar(), { themeOverrideFontSizes: { font_size: 28 } }, THEME)).toBe(28);
  });

  it('an override of 0 falls through (control.cpp:3115 requires > 0)', () => {
    expect(tabBarFontSizePx(bar(), { themeOverrideFontSizes: { font_size: 0 } }, THEME)).toBe(THEME.fontSize);
  });

  it('ignores a DIFFERENT size key', () => {
    expect(tabBarFontSizePx(bar(), { themeOverrideFontSizes: { normal_font_size: 28 } }, THEME)).toBe(THEME.fontSize);
  });
});

describe('tabBarMinimumSize — the tab buffer is shaped at theme_cache.font_size', () => {
  // `TabBar::_shape` shapes every tab at `theme_cache.font_size`
  // (tab_bar.cpp:365), which is a theme ITEM (tab_bar.cpp:2179), so a
  // node-local `theme_override_font_sizes/font_size` wins over every theme in
  // the chain (control.cpp:3113-3117). `ms.height` floors on that same buffer
  // (tab_bar.cpp:82) and `ms.width` on its advance (tab_bar.cpp:80).
  function ctx(): SolveContext {
    return {
      theme: nativeTheme(1),
      measureText: () => ({ x: 0, y: 0 }),
      combinedMinimumSize: () => ({ x: 0, y: 0 }),
    };
  }

  function node(props: Partial<TabBarProperties> = {}): SolveNode {
    const properties: TabBarProperties = {
      name: 'T',
      tabs: [{ title: 'Map', tooltip: '', disabled: false }],
      ...props,
    };
    return { ...solveNode(), path: 'T', node: { name: 'T', type: 'TabBar', children: [], properties } };
  }

  function sizeOf(n: SolveNode) {
    return tabBarMinimumSize(n, ctx());
  }

  it('an override above the theme default raises and widens the bar', () => {
    const overridden = sizeOf(node({ themeOverrideFontSizes: { font_size: 32 } }));
    const plain = sizeOf(node());
    expect(overridden.y).toBeGreaterThan(plain.y);
    expect(overridden.x).toBeGreaterThan(plain.x);
  });

  it('an override below the theme default lowers and narrows it', () => {
    const overridden = sizeOf(node({ themeOverrideFontSizes: { font_size: 8 } }));
    const plain = sizeOf(node());
    expect(overridden.y).toBeLessThan(plain.y);
    expect(overridden.x).toBeLessThan(plain.x);
  });

  it('an override of 0 falls through to the theme default (control.cpp:3115)', () => {
    expect(sizeOf(node({ themeOverrideFontSizes: { font_size: 0 } }))).toEqual(sizeOf(node()));
  });

  // `_draw_tab` centres the buffer as `get_margin(SIDE_TOP) + ((sb_rect.size.y
  // - sb_ms.y) - text_buf->get_size().y) / 2` (tab_bar.cpp:677) against the
  // rect `get_minimum_size` floored at `text_buf->get_size().y + y_margin`
  // (tab_bar.cpp:82). ONE buffer feeds both, so that term cannot go negative —
  // it only can where the height and the glyphs came from two different sizes.
  it('the bar the solver sizes contains the buffer the painter shapes, at any font size', () => {
    const style = pickTabStyleBox({}, tabBarStyleBoxes(1), 'unselected');
    for (const fontSize of [8, 16, 28, 32]) {
      const n = node({ themeOverrideFontSizes: { font_size: fontSize } });
      const props = n.node.properties as TabBarProperties;
      const layout = shapeTabLabel('Map', tabBarFontSizePx(n, props, nativeTheme(1)), undefined);
      const content = layoutTabContent({
        barHeightPx: sizeOf(n).y,
        style,
        tabWidthPx: 400,
        iconSize: null,
        hasText: true,
        textNaturalHeightPx: layout.heightPx,
        textAdvanceWidthPx: layout.widthPx,
        hSeparation: 4,
        closeVisible: false,
        closeIconSize: { x: 16, y: 16 },
        buttonHlMargin: { left: 0, top: 0, right: 0, bottom: 0 },
        rtl: false,
      });
      expect(content.text?.offset.y).toBe(style.contentMargin.top);
    }
  });
});

describe('tabDrawX', () => {
  it('draws a tab at its own ofs_cache under LTR (tab_bar.cpp:552,1931)', () => {
    expect(tabDrawX(40, 100, 300, false)).toBe(40);
  });

  it('mirrors the tab inside the bar under RTL: size.width - ofs_cache - size_cache (tab_bar.cpp:552,1929)', () => {
    expect(tabDrawX(40, 100, 300, true)).toBe(160);
  });

  it('puts the FIRST tab against the right edge under RTL', () => {
    expect(tabDrawX(0, 120, 300, true)).toBe(180);
  });
});

describe('layoutTabContent under RTL', () => {
  const style = {
    ...tabBarStyleBoxes(1).selected,
    contentMargin: { left: 20, top: 4, right: 6, bottom: 4 },
  };
  const base = {
    barHeightPx: 40,
    style,
    tabWidthPx: 200,
    iconSize: { x: 16, y: 16 },
    hasText: true,
    textNaturalHeightPx: 18,
    textAdvanceWidthPx: 50,
    hSeparation: 4,
    closeVisible: true,
    closeIconSize: { x: 12, y: 12 },
    buttonHlMargin: { left: 3, top: 2, right: 3, bottom: 2 },
  };

  it('flows icon, text and close right to left from the tab width minus the style LEFT margin (tab_bar.cpp:660,668,676,721)', () => {
    const out = layoutTabContent({ ...base, rtl: true });
    // p_x = size_cache - margin(SIDE_LEFT) = 200 - 20 = 180 — Godot measures the
    // LEFT margin from the right edge here, never the right margin.
    expect(out.icon?.rect.x).toBe(180 - 16);
    // p_x = 180 - 16 - 4 = 160; text at p_x - size_text.
    expect(out.text?.offset.x).toBe(160 - 50);
    // p_x = 160 - 50 - 4 = 106; close rect at p_x - cb width (3 + 12 + 3 = 18).
    expect(out.close?.rect.x).toBe(106 - 18);
    expect(out.close?.iconOffset.x).toBe(106 - 18 + 3);
  });

  it('leaves the LTR flow untouched', () => {
    const out = layoutTabContent({ ...base, rtl: false });
    expect(out.icon?.rect.x).toBe(20);
    expect(out.text?.offset.x).toBe(40);
    expect(out.close?.rect.x).toBe(94);
  });

  it('centres every element vertically the same way in both directions (tab_bar.cpp:668,677,722)', () => {
    const ltr = layoutTabContent({ ...base, rtl: false });
    const rtl = layoutTabContent({ ...base, rtl: true });
    expect(rtl.icon?.rect.y).toBe(ltr.icon?.rect.y);
    expect(rtl.text?.offset.y).toBe(ltr.text?.offset.y);
    expect(rtl.close?.rect.y).toBe(ltr.close?.rect.y);
  });
});

describe('layoutScrollArrows', () => {
  const base = {
    barWidthPx: 300,
    barHeightPx: 33,
    incrementIconSize: { x: 16, y: 16 },
    decrementIconSize: { x: 10, y: 10 },
    missingRight: true,
  };

  it('puts both arrows against the RIGHT edge under LTR, decrement first (tab_bar.cpp:581,587)', () => {
    const out = layoutScrollArrows({ ...base, rtl: false });
    expect(out.decrement.x).toBe(300 - 16 - 10);
    expect(out.increment.x).toBe(300 - 16 - 10 + 10);
  });

  it('puts both arrows against the LEFT edge under RTL, decrement first, increment offset by the INCREMENT width (tab_bar.cpp:569,575)', () => {
    const out = layoutScrollArrows({ ...base, rtl: true });
    expect(out.decrement.x).toBe(0);
    expect(out.increment.x).toBe(16);
  });

  it('swaps which arrow missing_right lights up (tab_bar.cpp:569,575 vs :581,587)', () => {
    const ltr = layoutScrollArrows({ ...base, rtl: false });
    expect(ltr.decrement.dim).toBe(true);
    expect(ltr.increment.dim).toBe(false);
    const rtl = layoutScrollArrows({ ...base, rtl: true });
    expect(rtl.decrement.dim).toBe(false);
    expect(rtl.increment.dim).toBe(true);
  });

  it('dims both arrows once nothing is clipped off the end', () => {
    for (const rtl of [false, true]) {
      const out = layoutScrollArrows({ ...base, missingRight: false, rtl });
      expect(out.decrement.dim).toBe(true);
      expect(out.increment.dim).toBe(true);
    }
  });

  it('measures vofs off the INCREMENT icon and truncates it to an int (tab_bar.cpp:565)', () => {
    const out = layoutScrollArrows({ ...base, rtl: false });
    // int vofs = (33 - 16) / 2 = 8, not 8.5 and not (33 - 10) / 2.
    expect(out.decrement.y).toBe(8);
    expect(out.increment.y).toBe(8);
  });
});
