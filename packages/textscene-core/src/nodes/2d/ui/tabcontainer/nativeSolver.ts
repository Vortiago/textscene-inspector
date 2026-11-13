/**
 * TabContainer's native (WebGL canvas) rect solver: `TabContainer::get_minimum_size`
 * (`scene/gui/tab_container.cpp:1027-1065`), `_repaint` (`:359-403`), `_update_margins`
 * (`:405-460`) and `_get_tab_height` (`:51-58`). `_get_tab_rect` (`:35-42`) serves only the
 * tab-menu popup, which is not modelled.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type {
  ContainerLayoutFn,
  MinimumSizeFn,
  SolveContext,
  TextureSlotRequest,
  TextureSlotsFn,
} from '../../../../r3f/controls/native/solverRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { isTopLevelItem } from '../../../../r3f/canvasPaintOrder';
import {
  internalChildThemeItems,
  requiredThemeItem,
  type InternalThemeItems,
} from '../../../../r3f/controls/native/themeItems';
import { FALLBACK_THEME_CONSTANT } from '../../../../godot/scene/theme';
import { isPromotedControl, type SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { Rect2 } from '../../../../godot/math/rect2';
import {
  TAB_ALIGNMENT_CENTER,
  TAB_ALIGNMENT_LEFT,
  TAB_ALIGNMENT_RIGHT,
  TAB_BAR_THEME_FONT_KEY,
  TAB_BAR_THEME_FONT_SIZE_KEY,
  tabBarMinimumSize,
} from '../tabbar/nativeSolver';
import {
  resolveNodeFont,
  resolveNodeFontSizePx,
} from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { parseControlCanvasItem } from '../control/parser';
import type { TabBarProperties, TabBarTabProperties } from '../tabbar/types';
import type { TabContainerProperties, TabContainerTabOverride } from './types';
import { tabContainerCurrentTab } from './childVisibility';

/** `TabContainer::TabPosition` (`tab_container.h`): 0 TOP, 1 BOTTOM. */
export const TABS_POSITION_TOP = 0;
const TABS_POSITION_BOTTOM = 1;

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
        // `add_child_notify` names the tab after the child (`:653`), and `set_tab_title` overrides it (`:883-907`).
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
const tabContainerTextureSlots: TextureSlotsFn = (node) => {
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
 * `h_separation` comes from TabContainer's `icon_separation`, and
 * `icon_max_width` forwards from the table. The table sets no `tab_separation` for
 * TabContainer, so it falls back to 0.
 */
function internalTabBarThemeConstants(constants: SolveNode['constants']): SolveNode['constants'] {
  return {
    h_separation: requiredThemeItem(constants, 'icon_separation'),
    tab_separation: constants.tab_separation ?? FALLBACK_THEME_CONSTANT,
    icon_max_width: requiredThemeItem(constants, 'icon_max_width'),
  };
}

/** The bar icons the container does not push: `_on_theme_changed` sets the others (`tab_container.cpp:306-312`). */
function tabBarOwnIcons(barItems: InternalThemeItems): SolveNode['icons'] {
  return barItems.icons.close ? { close: barItems.icons.close } : {};
}

/**
 * A synthetic `SolveNode` for TabContainer's internal `TabBar`, with the scope of `n`. The bar is no
 * scene node (`memnew`d at `tab_container.cpp:1280`), and type `'TabBar'` reaches `tabBarMinimumSize`.
 * `tabCloseDisplayPolicy` is `SHOW_NEVER` and `maxTabWidth` 0, since TabContainer exposes neither,
 * and its CanvasItem fields hold the Godot defaults.
 */
export function buildInternalTabBarNode(
  n: SolveNode,
  derivedTabs: TabBarTabProperties[],
  props: TabContainerProperties
): SolveNode {
  const barProps: TabBarProperties = {
    name: n.node.name,
    ...parseControlCanvasItem({}, n.node.name),
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
        props.themeOverrideFontSizes?.[TAB_CONTAINER_FONT_SIZE_KEY]
      ),
    },
  };
  const barItems = internalChildThemeItems(n, 'TabBar');
  return {
    ...n,
    node: { ...n.node, type: 'TabBar', properties: barProps, children: [] },
    children: [],
    // The container pushes every other item the bar reads (`tab_container.cpp:306-343`), so a bar
    // theme entry for one never applies. Only the close icon comes from the bar's own lookup.
    icons: { ...tabBarOwnIcons(barItems), ...n.icons },
    // The container pushes only the `tab_*` boxes (`:312-318`): the close button's boxes are the bar's own.
    styleBoxes: {
      ...n.styleBoxes,
      button_highlight: requiredThemeItem(barItems.styleBoxes, 'button_highlight'),
      button_pressed: requiredThemeItem(barItems.styleBoxes, 'button_pressed'),
    },
    constants: internalTabBarThemeConstants(n.constants),
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

interface StyleMargins {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** `theme_cache.tabbar_style->get_margin(...)`, the table's `TabContainer/tabbar_background`. */
export function tabbarStyleMargins(styleBoxes: SolveNode['styleBoxes']): StyleMargins {
  return requiredThemeItem(styleBoxes, 'tabbar_background').contentMargin;
}

/** `TabContainer::_get_tab_height` (`:51-58`): the strip's minimum height plus the tabbar style's top and bottom margin. The caller answers 0 where the header is hidden or there are no tabs. */
export function tabHeaderHeight(barMinHeightPx: number, tabbarMargin: StyleMargins): number {
  return barMinHeightPx + tabbarMargin.top + tabbarMargin.bottom;
}

/**
 * `TabContainer::_update_margins` (`:405-460`) and `_repaint`'s vertical anchoring
 * (`:362-373`), as the rect the internal TabBar holds. Under `is_layout_rtl()` the margins
 * swap (`:412`) and `_size_changed` mirrors the inherited-direction bar (`control.cpp:1785-1787`),
 * so authored margins stay on their sides and `side_margin` moves to the opposite edge. `sideMargin` is
 * the margin in effect: `resolveTabContainerStrip` returns 0 once RIGHT alignment reclaims it (`:450`).
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

/**
 * `TabContainer::_repaint` (`:359-403`): the content band before `panel_style`'s margin inset. Every page
 * gets it: `_repaint` insets only the current page and hides the rest (`:377-399`), as `tabContainerChildVisibility`
 * does. It sets `PRESET_FULL_RECT` and pixel offsets, never `fit_child_in_rect`, so only `Control::set_rect`'s
 * floor (`dispatchChildren` in `controlRectSolver.ts`) applies.
 */
export function tabContentBand(containerRect: Rect2, headerHeight: number, tabsPosition: number): Rect2 {
  const y = tabsPosition === TABS_POSITION_TOP ? headerHeight : 0;
  return { x: 0, y, w: containerRect.w, h: containerRect.h - headerHeight };
}

/** `TabContainer::get_minimum_size` (`:1027-1065`). */
const tabContainerMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as TabContainerProperties;
  const tabsVisible = props.tabsVisible ?? true;
  const alignment = props.tabAlignment ?? TAB_ALIGNMENT_LEFT;
  const useHiddenTabsForMinSize = props.useHiddenTabsForMinSize ?? false;

  let width = 0;
  let height = 0;

  if (tabsVisible) {
    const derivedTabs = deriveTabContainerTabs(n, props.tabOverrides);
    const synthetic = buildInternalTabBarNode(n, derivedTabs, props);
    const barSize = tabBarMinimumSize(synthetic, ctx);
    const tabbarMargin = tabbarStyleMargins(n.styleBoxes);
    width += barSize.x + tabbarMargin.left + tabbarMargin.right;
    height += barSize.y + tabbarMargin.top + tabbarMargin.bottom;

    // `side_margin` widens the minimum only for LEFT or RIGHT alignment. No popup is
    // modelled, so the RIGHT branch's popup exception never applies (`tab_container.cpp:1039-1042`).
    if (alignment !== TAB_ALIGNMENT_CENTER) {
      width += requiredThemeItem(n.constants, 'side_margin');
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

  const panelStyle = requiredThemeItem(n.styleBoxes, 'panel');
  const panelMinWidth = panelStyle.contentMargin.left + panelStyle.contentMargin.right;
  const panelMinHeight = panelStyle.contentMargin.top + panelStyle.contentMargin.bottom;

  width = Math.max(width, largestChildWidth + panelMinWidth);
  height += panelMinHeight;

  return { x: width, y: height };
};

controlSolverRegistry.registerMinimumSize('TabContainer', tabContainerMinimumSize);
controlSolverRegistry.registerTextureSlots('TabContainer', tabContainerTextureSlots);

/** `NOTIFICATION_SORT_CHILDREN`: `_update_margins` and `_repaint`. */
const tabContainerLayout: ContainerLayoutFn = (n, children, contentRect, ctx) => {
  const props = n.node.properties as TabContainerProperties;
  const tabsVisible = props.tabsVisible ?? true;
  const tabsPosition = props.tabsPosition ?? TABS_POSITION_TOP;

  // `_get_tab_height` answers 0 without a header or pages (`:51-58`): `get_tab_count()`
  // counts sortable children, not children.
  const derivedTabs = deriveTabContainerTabs(n, props.tabOverrides);
  let headerHeight = 0;
  if (tabsVisible && derivedTabs.length > 0) {
    const synthetic = buildInternalTabBarNode(n, derivedTabs, props);
    headerHeight = tabHeaderHeight(tabBarHeight(synthetic, ctx), tabbarStyleMargins(n.styleBoxes));
  }

  const band = tabContentBand(contentRect, headerHeight, tabsPosition);
  const panelStyle = requiredThemeItem(n.styleBoxes, 'panel');
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
