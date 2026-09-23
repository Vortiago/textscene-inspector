/**
 * TabContainer's native (WebGL canvas) rect solver: `TabContainer::get_minimum_size`
 * (`scene/gui/tab_container.cpp:1027-1065`), `_repaint` (`:359-403`), `_update_margins`
 * (`:405-460`) and `_get_tab_height` (`:51-58`).
 *
 * The internal `TabBar` is no scene node (`memnew`d at `tab_container.cpp:1280`), so a
 * synthetic `SolveNode` with this node's scope and type `'TabBar'` reaches `tabBarMinimumSize`.
 * `_get_tab_rect` (`:35-42`) serves only the tab-menu popup, which is not modelled.
 *
 * A tab title is the child's name unless `tab_<idx>/title` overrides it
 * (`add_child_notify`, `:653`, versus `set_tab_title`, `:883-907`).
 *
 * Every page gets the same content rect: `_repaint` (`:377-399`) insets only the current
 * page and hides the rest, and {@link tabContainerChildVisibility} ports that `hide()`.
 * `_repaint` sets `PRESET_FULL_RECT` and pixel offsets, never `fit_child_in_rect`, so only
 * `Control::set_rect`'s floor (`dispatchChildren` in `controlRectSolver.ts`) applies.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type {
  ChildVisibilityFn,
  ContainerLayoutFn,
  MinimumSizeFn,
  SolveContext,
  TextureSlotRequest,
  TextureSlotsFn,
} from '../../../../r3f/controls/native/solverRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { isTopLevelItem } from '../../../../r3f/canvasPaintOrder';
import { isPromotedControl, type SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import {
  TAB_ALIGNMENT_CENTER,
  TAB_ALIGNMENT_LEFT,
  TAB_ALIGNMENT_RIGHT,
  TAB_BAR_THEME_FONT_KEY,
  TAB_BAR_THEME_FONT_SIZE_KEY,
  reconstructThemeScale,
  tabBarMinimumSize,
} from '../tabbar/nativeSolver';
import {
  resolveNodeFont,
  resolveNodeFontSizePx,
} from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import type { TabBarProperties, TabBarTabProperties } from '../tabbar/types';
import type { TabContainerProperties, TabContainerTabOverride } from './types';

/**
 * `TabContainer::get_current_tab()` for a loaded scene, which is not the `-1` default: the
 * first `add_tab` (through `add_child_notify`, `tab_container.cpp:640-655`) sets `current = 0`
 * unless deselection is enabled (`tab_bar.cpp:1324-1331`). An authored `current_tab` waits in
 * `setup_current_tab` (`tab_container.cpp:743-746`) until `NOTIFICATION_ENTER_TREE` (`:222-225`).
 */
export function tabContainerCurrentTab(props: TabContainerProperties, tabCount: number): number {
  if (tabCount === 0) return -1;
  const authored = props.currentTab;
  // `TabBar::set_current_tab` can refuse it and leave 0 standing (`tab_bar.cpp:795-805`). An index
  // past the last page is queued, and nothing consumes the queue, since `initialized` is still false.
  if (authored === undefined || authored >= tabCount) return 0;
  if (authored >= 0) return authored;
  // -1 fails `ERR_FAIL_COND_MSG(!_can_deselect())` unless `deselect_enabled` is on or every
  // tab is disabled or hidden (`tab_bar.cpp:1862-1873`).
  const overrides = props.tabOverrides;
  const everyTabUnselectable = Array.from(
    { length: tabCount },
    (_unused, i) => overrides?.[i]
  ).every((o) => o?.disabled === true || o?.hidden === true);
  return props.deselectEnabled === true || everyTabUnselectable ? -1 : 0;
}

/**
 * `TabContainer::_repaint`'s visibility half: `show()` on the current page and `hide()` on
 * the rest (`tab_container.cpp:377-399`), as `NOTIFICATION_VISIBILITY_CHANGED` does (`:290-293`).
 * `add_child_notify` hides each page as it is added (`:651`), so an unauthored file shows one.
 */
export const tabContainerChildVisibility: ChildVisibilityFn = (container, _child, index, count) =>
  index === tabContainerCurrentTab(container.properties as TabContainerProperties, count);

/** `TabContainer::TabPosition` (`tab_container.h`): 0 TOP, 1 BOTTOM. */
export const TABS_POSITION_TOP = 0;
export const TABS_POSITION_BOTTOM = 1;

/** `default_theme.cpp:1223`: `theme->set_constant("side_margin", "TabContainer", round(8 * scale))`. */
const SIDE_MARGIN_LITERAL = 8;

/**
 * Every direct child is a tab page: `TabContainer::_get_tab_controls` (`:469-481`) uses
 * `SortableVisibilityMode::IGNORE`, so a page with `visible = false` is still a page, which the
 * walker hides. The cast still drops a Control promoted past a Node2D and a `top_level` one
 * (`container.cpp:144-146`, ahead of every visibility mode).
 */
export function deriveTabContainerTabs(
  n: Pick<SolveNode, 'children'>,
  overrides: Readonly<Record<number, TabContainerTabOverride>> | undefined
): TabBarTabProperties[] {
  return n.children
    .filter((child) => !isPromotedControl(child) && !isTopLevelItem(child.node))
    .map((child, i) => {
      const override = overrides?.[i];
      return {
        title: override?.title ?? child.node.name,
        tooltip: '',
        icon: override?.icon,
        disabled: override?.disabled ?? false,
        hidden: override?.hidden ?? false,
      };
    });
}

/**
 * One `TextureSlotRequest` per page with a `tab_<idx>/icon` override, keyed as
 * `tabBarTextureSlots` keys TabBar's icons, so `buildInternalTabBarNode` reuses `n.textureSlots`.
 */
export const tabContainerTextureSlots: TextureSlotsFn = (node) => {
  const overrides = (node.properties as TabContainerProperties).tabOverrides;
  if (!overrides) return [];
  const requests: TextureSlotRequest[] = [];
  for (let i = 0; i < node.children.length; i++) {
    const icon = overrides[i]?.icon;
    if (icon) requests.push({ key: String(i), ref: icon });
  }
  return requests;
};

/** `BIND_THEME_ITEM_CUSTOM(Theme::DATA_TYPE_FONT, TabContainer, tab_font, "font")` (`tab_container.cpp:1264`): TabContainer's item name for the strip's font. */
const TAB_CONTAINER_FONT_KEY = 'font';
/** `BIND_THEME_ITEM_CUSTOM(Theme::DATA_TYPE_FONT_SIZE, TabContainer, tab_font_size, "font_size")` (`tab_container.cpp:1265`): its size twin. */
const TAB_CONTAINER_FONT_SIZE_KEY = 'font_size';

/**
 * The internal TabBar's theme constants, per `_on_theme_changed` (`tab_container.cpp:341-343`):
 * `h_separation` comes from TabContainer's `icon_separation` (`default_theme.cpp:1225`, also 4).
 * `tab_separation` and `icon_max_width` forward unchanged: both default to 0, and
 * default_theme.cpp sets neither for TabContainer.
 */
function internalTabBarThemeConstants(constants: SolveNode['constants'], theme: NativeTheme): SolveNode['constants'] {
  return {
    h_separation: constants.icon_separation ?? theme.separation,
    tab_separation: constants.tab_separation ?? 0,
    icon_max_width: constants.icon_max_width ?? 0,
  };
}

/**
 * A synthetic `SolveNode` for TabContainer's internal `TabBar`, with the scope of `n`.
 * `tabCloseDisplayPolicy` is `SHOW_NEVER` and `maxTabWidth` 0, since TabContainer exposes neither.
 */
export function buildInternalTabBarNode(
  n: SolveNode,
  derivedTabs: TabBarTabProperties[],
  props: TabContainerProperties,
  theme: NativeTheme
): SolveNode {
  const barProps: TabBarProperties = {
    name: n.node.name,
    tabs: derivedTabs,
    currentTab: tabContainerCurrentTab(props, derivedTabs.length),
    tabAlignment: props.tabAlignment,
    clipTabs: props.clipTabs,
    maxTabWidth: 0,
    tabCloseDisplayPolicy: 0,
    // `tab_bar->add_theme_font_size_override(font_size, theme_cache.tab_font_size)` (`:339`):
    // resolved on the container, then pushed as the bar's override so the bar never re-resolves it.
    themeOverrideFontSizes: {
      [TAB_BAR_THEME_FONT_SIZE_KEY]: resolveNodeFontSizePx(
        n,
        TAB_CONTAINER_FONT_SIZE_KEY,
        props.themeOverrideFontSizes?.[TAB_CONTAINER_FONT_SIZE_KEY],
        theme.fontSize
      ),
    },
  };
  return {
    ...n,
    node: { ...n.node, type: 'TabBar', properties: barProps, children: [] },
    children: [],
    // `constants` remaps TabContainer's keys (`internalTabBarThemeConstants`). `colors` and
    // `styleBoxes`, spread from `n`, use the same key names, so they need no remap.
    constants: internalTabBarThemeConstants(n.constants, theme),
    // `tab_bar->add_theme_font_override(font, theme_cache.tab_font)` (`:338`),
    // the font twin of the size push above.
    fontOverrides: {
      ...n.fontOverrides,
      [TAB_BAR_THEME_FONT_KEY]: resolveNodeFont(n, TAB_CONTAINER_FONT_KEY),
    },
  };
}

function tabBarHeight(synthetic: SolveNode, ctx: Pick<SolveContext, 'theme' | 'measureText'>): number {
  return tabBarMinimumSize(synthetic, ctx as SolveContext).y;
}

export interface StyleMargins {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const NO_STYLE_MARGINS: StyleMargins = { left: 0, top: 0, right: 0, bottom: 0 };

/** `theme_cache.tabbar_style->get_margin(...)`: an authored `theme_override_styles/tabbar_background`, else the default theme's empty box (`default_theme.cpp:994`). */
export function tabbarStyleMargins(styleBoxes: SolveNode['styleBoxes']): StyleMargins {
  return styleBoxes.tabbar_background?.contentMargin ?? NO_STYLE_MARGINS;
}

/** `TabContainer::_get_tab_height` (`:51-58`): the strip's minimum height plus the tabbar style's top and bottom margin. The caller answers 0 where the header is hidden or there are no tabs. */
export function tabHeaderHeight(barMinHeightPx: number, tabbarMargin: StyleMargins): number {
  return barMinHeightPx + tabbarMargin.top + tabbarMargin.bottom;
}

/**
 * `TabContainer::_update_margins` (`:405-460`) and `_repaint`'s vertical anchoring
 * (`:362-373`), as the rect the internal TabBar holds. Under `is_layout_rtl()` the margins
 * swap (`:412`) and `_size_changed` mirrors the inherited-direction bar (`control.cpp:1785-1787`),
 * so authored margins stay on their sides and `side_margin` moves to the opposite edge.
 */
export function tabBarRect(
  containerRect: Rect2,
  barMinHeightPx: number,
  tabsPosition: number,
  alignment: number,
  sideMargin: number,
  tabbarMargin: StyleMargins,
  rtl: boolean
): Rect2 {
  const leftMargin = rtl ? tabbarMargin.right : tabbarMargin.left;
  const rightMargin = rtl ? tabbarMargin.left : tabbarMargin.right;

  let offsetLeft = leftMargin;
  let offsetRight = -rightMargin;
  if (alignment === TAB_ALIGNMENT_LEFT) {
    offsetLeft = leftMargin + sideMargin;
  } else if (alignment === TAB_ALIGNMENT_RIGHT) {
    // No popup is modelled, so the overflow case that reclaims `side_margin` (`get_clip_tabs() &&
    // (offset_buttons_visible || total_tabs_width + side_margin > size.width)`, `:450`) is not
    // reproduced. comparison.md records it.
    offsetRight = -rightMargin - sideMargin;
  }

  const w = containerRect.w + offsetRight - offsetLeft;
  const x = rtl ? containerRect.w - offsetLeft - w : offsetLeft;
  const headerHeight = tabHeaderHeight(barMinHeightPx, tabbarMargin);
  const y = (tabsPosition === TABS_POSITION_BOTTOM ? containerRect.h - headerHeight : 0) + tabbarMargin.top;
  return { x, y, w, h: barMinHeightPx };
}

/** `TabContainer::_notification(DRAW)` (`:257-262`): `tabbar_style` draws across the full container width, not the tab bar's inset rect. */
export function tabHeaderBand(containerRect: Rect2, headerHeight: number, tabsPosition: number): Rect2 {
  const y = tabsPosition === TABS_POSITION_BOTTOM ? containerRect.h - headerHeight : 0;
  return { x: 0, y, w: containerRect.w, h: headerHeight };
}

/** `TabContainer::_repaint` (`:359-403`): the content band before `panel_style`'s margin inset. The module header says why every page gets the same rect. */
export function tabContentBand(containerRect: Rect2, headerHeight: number, tabsPosition: number): Rect2 {
  const y = tabsPosition === TABS_POSITION_TOP ? headerHeight : 0;
  return { x: 0, y, w: containerRect.w, h: containerRect.h - headerHeight };
}

/** `TabContainer::get_minimum_size` (`:1027-1065`). */
export const tabContainerMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as TabContainerProperties;
  const tabsVisible = props.tabsVisible ?? true;
  const alignment = props.tabAlignment ?? TAB_ALIGNMENT_LEFT;
  const useHiddenTabsForMinSize = props.useHiddenTabsForMinSize ?? false;

  let width = 0;
  let height = 0;

  if (tabsVisible) {
    const derivedTabs = deriveTabContainerTabs(n, props.tabOverrides);
    const synthetic = buildInternalTabBarNode(n, derivedTabs, props, ctx.theme);
    const barSize = tabBarMinimumSize(synthetic, ctx);
    const tabbarMargin = tabbarStyleMargins(n.styleBoxes);
    width += barSize.x + tabbarMargin.left + tabbarMargin.right;
    height += barSize.y + tabbarMargin.top + tabbarMargin.bottom;

    // `side_margin` widens the minimum only for LEFT or RIGHT alignment. No popup is
    // modelled, so the RIGHT branch's popup exception never applies (`tab_container.cpp:1039-1042`).
    if (alignment !== TAB_ALIGNMENT_CENTER) {
      width += Math.round(SIDE_MARGIN_LITERAL * reconstructThemeScale(ctx.theme));
    }
  }

  let largestChildWidth = 0;
  let largestChildHeight = 0;
  for (const child of n.children) {
    const visible = (child.node.properties as { visible?: boolean }).visible !== false;
    if (!visible && !useHiddenTabsForMinSize) continue;
    const cms = ctx.combinedMinimumSize(child);
    largestChildWidth = Math.max(largestChildWidth, cms.x);
    largestChildHeight = Math.max(largestChildHeight, cms.y);
  }
  height += largestChildHeight;

  const panelStyle = n.styleBoxes.panel ?? ctx.theme.widgets.panel;
  const panelMinWidth = panelStyle.contentMargin.left + panelStyle.contentMargin.right;
  const panelMinHeight = panelStyle.contentMargin.top + panelStyle.contentMargin.bottom;

  width = Math.max(width, largestChildWidth + panelMinWidth);
  height += panelMinHeight;

  return { x: width, y: height };
};

controlSolverRegistry.registerMinimumSize('TabContainer', tabContainerMinimumSize);
controlSolverRegistry.registerChildVisibility('TabContainer', tabContainerChildVisibility);
controlSolverRegistry.registerTextureSlots('TabContainer', tabContainerTextureSlots);

/** `NOTIFICATION_SORT_CHILDREN`: `_update_margins` and `_repaint`. */
export const tabContainerLayout: ContainerLayoutFn = (n, children, contentRect, ctx) => {
  const props = n.node.properties as TabContainerProperties;
  const tabsVisible = props.tabsVisible ?? true;
  const tabsPosition = props.tabsPosition ?? TABS_POSITION_TOP;

  // `_get_tab_height` answers 0 without a header or pages (`:51-58`): `get_tab_count()`
  // counts sortable children, not children.
  const derivedTabs = deriveTabContainerTabs(n, props.tabOverrides);
  let headerHeight = 0;
  if (tabsVisible && derivedTabs.length > 0) {
    const synthetic = buildInternalTabBarNode(n, derivedTabs, props, ctx.theme);
    headerHeight = tabHeaderHeight(tabBarHeight(synthetic, ctx), tabbarStyleMargins(n.styleBoxes));
  }

  const band = tabContentBand(contentRect, headerHeight, tabsPosition);
  const panelStyle = n.styleBoxes.panel ?? ctx.theme.widgets.panel;
  const pageRect: Rect2 = {
    // `_repaint` sets the page's offsets directly (`:389-392`), so
    // `_size_changed`'s RTL mirror (`control.cpp:1785-1787`) lands the
    // panel's right margin on the left. The panel box itself never mirrors.
    x: band.x + (n.rtl ? panelStyle.contentMargin.right : panelStyle.contentMargin.left),
    y: band.y + panelStyle.contentMargin.top,
    w: band.w - panelStyle.contentMargin.left - panelStyle.contentMargin.right,
    h: band.h - panelStyle.contentMargin.top - panelStyle.contentMargin.bottom,
  };

  const rects = new Map<string, Rect2>();
  for (const { node: child } of children) rects.set(child.path, pageRect);
  return rects;
};

controlSolverRegistry.registerContainerLayout('TabContainer', tabContainerLayout);
