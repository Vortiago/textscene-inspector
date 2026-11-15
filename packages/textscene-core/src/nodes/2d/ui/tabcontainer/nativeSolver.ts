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
import { controlSolverRegistry, themedSlotRequests } from '../../../../r3f/controls/native/solverRegistry';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import { internalControlsOf } from '../../../../r3f/controls/native/internalControls';
import { defineChannel } from '../../../../r3f/controls/native/solveHandoff';
import { VECTOR2_ZERO, type Vector2 } from '../../../../godot/math/vector';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { Rect2 } from '../../../../godot/math/rect2';
import { TAB_ALIGNMENT_CENTER, TAB_ALIGNMENT_LEFT } from '../tabbar/nativeSolver';
import type { TabContainerProperties } from './types';
import { TABS_POSITION_TOP, tabContentBand, tabHeaderHeight, tabbarStyleMargins } from './tabLayout';
// Registers the TabBar this container builds, which its minimum size and its layout read.
import './internalControls';

/**
 * The textures the internal TabBar reads, keyed as `tabBarTextureSlots` keys them: each page's
 * `tab_<idx>/icon` override, and the scroll icons the container pushes onto it (`:320-323`).
 */
const tabContainerTextureSlots: TextureSlotsFn = (node, themedIcons = {}) => {
  const overrides = (node.properties as TabContainerProperties).tabOverrides ?? {};
  const requests: TextureSlotRequest[] = [];
  for (let i = 0; i < node.children.length; i++) {
    const icon = overrides[i]?.icon;
    if (icon) requests.push({ key: String(i), ref: icon });
  }
  return [...requests, ...themedSlotRequests(PUSHED_SCROLL_ICONS, themedIcons)];
};

/** The scroll icons of the bar whose size it reads from a slot (`tabBarThemeIconSize`). */
const PUSHED_SCROLL_ICONS = ['increment', 'decrement'];

/** The combined minimum of the container's TabBar: zero when it builds none. */
function tabBarMinimumSizeOf(n: SolveNode, ctx: SolveContext): Vector2 {
  const [bar] = internalControlsOf(n, ctx.theme);
  return bar ? ctx.combinedMinimumSize(bar.node) : VECTOR2_ZERO;
}

/** The height `_get_tab_height` gives the header (`:51-58`), sealed for the painter. */
export const tabHeaderHeightChannel = defineChannel<number>('tabHeaderHeight');

/** `TabContainer::get_minimum_size` (`:1027-1065`). */
const tabContainerMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as TabContainerProperties;
  const tabsVisible = props.tabsVisible ?? true;
  const alignment = props.tabAlignment ?? TAB_ALIGNMENT_LEFT;
  const useHiddenTabsForMinSize = props.useHiddenTabsForMinSize ?? false;

  let width = 0;
  let height = 0;

  if (tabsVisible) {
    const barSize = tabBarMinimumSizeOf(n, ctx);
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
  const tabsPosition = props.tabsPosition ?? TABS_POSITION_TOP;

  // `_get_tab_height` answers 0 without a header or pages (`:51-58`), where the container builds no bar.
  const [bar] = internalControlsOf(n, ctx.theme);
  const headerHeight = bar
    ? tabHeaderHeight(ctx.combinedMinimumSize(bar.node).y, tabbarStyleMargins(n.styleBoxes))
    : 0;

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
  return { rects, meta: tabHeaderHeightChannel.seal(headerHeight) };
};

controlSolverRegistry.registerContainerLayout('TabContainer', tabContainerLayout);
