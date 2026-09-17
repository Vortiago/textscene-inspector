/**
 * TabContainer's native (WebGL canvas) rect solver — `TabContainer::
 * get_minimum_size` (`scene/gui/tab_container.cpp:1027-1065`) and its child
 * layout, `TabContainer::_repaint` (`:359-403`) plus `_update_margins`
 * (`:405-460`) and `_get_tab_height`/`_get_tab_rect` (`:35-59`). Registered
 * via `controlSolverRegistry.registerMinimumSize`/`registerContainerLayout`.
 *
 * TabContainer's internal `TabBar` is never a real scene node (`memnew`d at
 * construction, `tab_container.cpp:1280`), so its own minimum-size/layout
 * math is reached by building a SYNTHETIC `SolveNode` — same resources/
 * styleBoxes/textureSlots scope as this TabContainer, `node.type` swapped to
 * `'TabBar'` — and calling `../tabbar/nativeSolver.ts`'s own
 * `tabBarMinimumSize` directly. One tab-layout implementation, not a second
 * transcription that could drift from TabBar's own.
 *
 * A page's tab title is its CHILD's own node name, UNLESS this
 * TabContainer's own `tab_<idx>/title` override says otherwise
 * (`TabContainer::add_child_notify`, `:653`, vs `set_tab_title`, `:883-907`
 * — see `types.ts`'s own doc on why the override is sparse).
 *
 * Every page — current or not — resolves to the SAME content rect: Godot's
 * own `_repaint` (`:377-399`) only applies the tab-height/panel-margin inset
 * inside the `i == current` branch and calls `hide()` on every other page,
 * leaving its rect stale/irrelevant; this previewer has no equivalent of
 * `hide()` on a `ContainerLayoutFn`'s per-child rect (only the AUTHORED
 * `visible` property the walker itself reads), so every page gets the one
 * rect that matters — the invisible ones never draw regardless of what rect
 * they hold. `Container::fit_child_in_rect` is NOT used here: `_repaint`
 * sets `PRESET_FULL_RECT` + explicit pixel offsets directly, never routing
 * through size flags — the universal re-floor `controlRectSolver.ts`'s
 * `dispatchChildren` already applies to every container's returned rect is
 * `Control::set_rect`'s own floor, which this inset needs regardless.
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
import { isPromotedControl, type SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import {
  TAB_ALIGNMENT_CENTER,
  TAB_ALIGNMENT_LEFT,
  TAB_ALIGNMENT_RIGHT,
  reconstructThemeScale,
  tabBarMinimumSize,
} from '../tabbar/nativeSolver';
import type { TabBarProperties, TabBarTabProperties } from '../tabbar/types';
import type { TabContainerProperties, TabContainerTabOverride } from './types';

/** `TabContainer::TabPosition` (`tab_container.h`): 0 TOP, 1 BOTTOM. */
export const TABS_POSITION_TOP = 0;
export const TABS_POSITION_BOTTOM = 1;

/** `default_theme.cpp:1223`: `theme->set_constant("side_margin", "TabContainer", round(8 * scale))`. */
const SIDE_MARGIN_LITERAL = 8;

/** Every direct child is a tab page — `TabContainer::_get_tab_controls` (`:469-481`) uses `SortableVisibilityMode::IGNORE`, so a page whose own `visible` is `false` (every non-current page in an editor-saved `.tscn`) is still a page, just one the WALKER later hides. The cast still applies, so neither a Control the walker promoted past a Node2D nor a `top_level` one (`container.cpp:144-146`, ahead of every visibility mode) is a page at all. */
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
 * One `TextureSlotRequest` per page whose `tab_<idx>/icon` override is
 * non-empty, keyed the SAME way `tabBarTextureSlots` keys a standalone
 * TabBar's own icons — `buildInternalTabBarNode` below reuses `n.
 * textureSlots` directly rather than re-resolving a second time.
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

/**
 * The internal TabBar's own theme constants — `_on_theme_changed`
 * (`tab_container.cpp:341-343`): `h_separation` comes from TabContainer's
 * OWN `icon_separation` (a DIFFERENT theme key, `default_theme.cpp:1225`,
 * same literal `4` as TabBar's own `h_separation`); `tab_separation`/
 * `icon_max_width` forward verbatim (both default 0, neither set in
 * `default_theme.cpp`'s "TabContainer" section either).
 */
function internalTabBarThemeConstants(constants: SolveNode['constants'], theme: NativeTheme): SolveNode['constants'] {
  return {
    h_separation: constants.icon_separation ?? theme.separation,
    tab_separation: constants.tab_separation ?? 0,
    icon_max_width: constants.icon_max_width ?? 0,
  };
}

/**
 * A synthetic `SolveNode` standing in for TabContainer's internal (never a
 * real scene node) `TabBar` — same resources/styleBoxes/textureSlots scope
 * as `n` itself, `tabCloseDisplayPolicy` fixed at `SHOW_NEVER` (TabContainer
 * exposes no such property on its own tab bar) and `maxTabWidth` fixed at 0
 * (same reason).
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
    currentTab: props.currentTab,
    tabAlignment: props.tabAlignment,
    clipTabs: props.clipTabs,
    maxTabWidth: 0,
    tabCloseDisplayPolicy: 0,
    // Font SIZE still resolves the OLD way — a local override read straight
    // off `node.properties` (`resolveNodeFontSizePx`'s own contract, never
    // folded into a `SolveNode` bag the way colour/constant/stylebox are).
    themeOverrideFontSizes: props.themeOverrideFontSizes,
  };
  return {
    ...n,
    node: { ...n.node, type: 'TabBar', properties: barProps, children: [] },
    children: [],
    // The synthetic TabBar's own resolved bags — `constants` REMAPS the outer
    // TabContainer's keys (`internalTabBarThemeConstants`'s own doc), never a
    // verbatim copy; `colors`/`styleBoxes` (already on `n` via the spread
    // above) read under the SAME key names either way, so no remap needed.
    constants: internalTabBarThemeConstants(n.constants, theme),
  };
}

function tabBarHeight(synthetic: SolveNode, ctx: Pick<SolveContext, 'theme' | 'measureText'>): number {
  const result = tabBarMinimumSize(synthetic, ctx as SolveContext);
  return 'size' in result ? result.size.y : result.y;
}

/**
 * `TabContainer::_get_tab_rect`/`_update_margins` (`:35-43,405-460`), popup
 * always absent (no `Popup` node concept modelled), so the RIGHT-alignment
 * branch never needs to reclaim `side_margin` for an overflowing bar — that
 * one case (`get_clip_tabs() && (offset_buttons_visible || total_tabs_width
 * + side_margin > size.width)`, `:450`) is NOT reproduced; documented in
 * `comparison.md`.
 */
export function tabBarRect(containerRect: Rect2, headerHeight: number, tabsPosition: number, alignment: number, sideMargin: number): Rect2 {
  const y = tabsPosition === TABS_POSITION_BOTTOM ? containerRect.h - headerHeight : 0;
  let x = 0;
  let w = containerRect.w;
  if (alignment === TAB_ALIGNMENT_LEFT) {
    x = sideMargin;
    w = containerRect.w - sideMargin;
  } else if (alignment === TAB_ALIGNMENT_RIGHT) {
    w = containerRect.w - sideMargin;
  }
  return { x, y, w, h: headerHeight };
}

/** `TabContainer::_repaint` (`:359-403`), the content band BEFORE `panel_style`'s own margin inset — this module's own header on why every page gets the SAME rect. */
export function tabContentBand(containerRect: Rect2, headerHeight: number, tabsPosition: number): Rect2 {
  const y = tabsPosition === TABS_POSITION_TOP ? headerHeight : 0;
  return { x: 0, y, w: containerRect.w, h: containerRect.h - headerHeight };
}

// --- get_minimum_size -----------------------------------------------------------

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
    const barResult = tabBarMinimumSize(synthetic, ctx);
    const barSize = 'size' in barResult ? barResult.size : barResult;
    width += barSize.x;
    height += barSize.y;

    // `side_margin` only widens the minimum for LEFT/RIGHT alignment — the
    // popup-present exception on the RIGHT branch is moot, popup is never
    // modelled (`tab_container.cpp:1039-1042`).
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
controlSolverRegistry.registerTextureSlots('TabContainer', tabContainerTextureSlots);

// --- NOTIFICATION_SORT_CHILDREN --------------------------------------------------

export const tabContainerLayout: ContainerLayoutFn = (n, children, contentRect, ctx) => {
  const props = n.node.properties as TabContainerProperties;
  const tabsVisible = props.tabsVisible ?? true;
  const tabsPosition = props.tabsPosition ?? TABS_POSITION_TOP;

  let headerHeight = 0;
  if (tabsVisible) {
    const derivedTabs = deriveTabContainerTabs(n, props.tabOverrides);
    const synthetic = buildInternalTabBarNode(n, derivedTabs, props, ctx.theme);
    headerHeight = tabBarHeight(synthetic, ctx);
  }

  const band = tabContentBand(contentRect, headerHeight, tabsPosition);
  const panelStyle = n.styleBoxes.panel ?? ctx.theme.widgets.panel;
  const pageRect: Rect2 = {
    x: band.x + panelStyle.contentMargin.left,
    y: band.y + panelStyle.contentMargin.top,
    w: band.w - panelStyle.contentMargin.left - panelStyle.contentMargin.right,
    h: band.h - panelStyle.contentMargin.top - panelStyle.contentMargin.bottom,
  };

  const rects = new Map<string, Rect2>();
  for (const { node: child } of children) rects.set(child.path, pageRect);
  return rects;
};

controlSolverRegistry.registerContainerLayout('TabContainer', tabContainerLayout);
