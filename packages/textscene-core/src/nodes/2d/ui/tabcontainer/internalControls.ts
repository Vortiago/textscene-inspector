/**
 * TabContainer's internal TabBar (`tab_container.cpp:1280-1282`): the theme items the container
 * pushes onto it (`_on_theme_changed`, `:307-346`) and the rect `_update_margins` and `_repaint` give
 * it (`:359-373`, `:405-460`). The TabBar's own solver and painter size and draw it.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import {
  registerInternalControls,
  type InternalControlEntry,
  type InternalControlsFn,
  type InternalLayoutFn,
  type PushedThemeItems,
} from '../../../../r3f/controls/native/internalControls';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import { FALLBACK_THEME_CONSTANT } from '../../../../godot/scene/theme';
import {
  resolveNodeFont,
  resolveNodeFontSizePx,
} from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import {
  TAB_ALIGNMENT_LEFT,
  TAB_BAR_THEME_FONT_KEY,
  TAB_BAR_THEME_FONT_SIZE_KEY,
} from '../tabbar/nativeSolver';
import { tabBarModel } from '../tabbar/tabBarModel';
// The strip is a TabBar child, so its solve needs the TabBar minimum size registered.
import '../tabbar/minimumSize';
import { tabBarLoadedOffset } from '../tabbar/loadedOffset';
import type { TabBarProperties, TabBarTabProperties } from '../tabbar/types';
import { tabContainerCurrentTab } from './childVisibility';
import { resolveTabContainerStrip, type LoadedStrip } from './loadStrip';
import {
  TABS_POSITION_BOTTOM,
  TABS_POSITION_TOP,
  deriveTabContainerTabs,
  tabBarRect,
  tabbarStyleMargins,
  type StyleMargins,
} from './tabLayout';
import type { TabContainerProperties } from './types';

/** The bar's name, so its path is `<container>/@TabBar`. */
const TAB_BAR_NAME = 'TabBar';

/** `BIND_THEME_ITEM_CUSTOM(Theme::DATA_TYPE_FONT, TabContainer, tab_font, "font")` (`tab_container.cpp:1264`). */
const TAB_CONTAINER_FONT_KEY = 'font';
/** `BIND_THEME_ITEM_CUSTOM(Theme::DATA_TYPE_FONT_SIZE, TabContainer, tab_font_size, "font_size")` (`:1265`). */
const TAB_CONTAINER_FONT_SIZE_KEY = 'font_size';

/** The StyleBoxes `_on_theme_changed` pushes (`:314-318`), each under its own name. */
const PUSHED_STYLE_BOXES = ['tab_unselected', 'tab_hovered', 'tab_selected', 'tab_disabled', 'tab_focus'];
/** The icons it pushes (`:320-324`), each under its own name. */
const PUSHED_ICONS = ['increment', 'increment_highlight', 'decrement', 'decrement_highlight', 'drop_mark'];
/** The colours it pushes (`:325-336`), each under its own name. */
const PUSHED_COLORS = [
  'drop_mark_color',
  'font_selected_color',
  'font_hovered_color',
  'font_unselected_color',
  'font_disabled_color',
  'font_outline_color',
  'icon_selected_color',
  'icon_hovered_color',
  'icon_unselected_color',
  'icon_disabled_color',
];

/** Each of `names`, as `items` holds it. */
function pick<V>(items: Readonly<Record<string, V>>, names: readonly string[]): Record<string, V> {
  return Object.fromEntries(names.map((name) => [name, requiredThemeItem(items, name)]));
}

/**
 * Each of `names` that the container's theme chain gives an icon. A name with none pushes the
 * default icon, so it still hides one the bar's own theme lookup finds: `undefined` stands for it.
 */
function pickIcons(icons: SolveNode['icons'], names: readonly string[]): PushedThemeItems['icons'] {
  return Object.fromEntries(names.map((name) => [name, icons[name]]));
}

/**
 * The constants it pushes (`:341-344`). `h_separation` is the container's `icon_separation`. The
 * table sets no `tab_separation` for TabContainer, so it falls back to 0.
 */
function pushedConstants(constants: SolveNode['constants']): SolveNode['constants'] {
  return {
    h_separation: requiredThemeItem(constants, 'icon_separation'),
    tab_separation: constants.tab_separation ?? FALLBACK_THEME_CONSTANT,
    icon_max_width: requiredThemeItem(constants, 'icon_max_width'),
    outline_size: requiredThemeItem(constants, 'outline_size'),
  };
}

/** Every theme item the container pushes onto its bar, resolved on the container. */
function tabBarPushedItems(container: SolveNode): PushedThemeItems {
  const props = container.node.properties as TabContainerProperties;
  return {
    styleBoxes: pick(container.styleBoxes, PUSHED_STYLE_BOXES),
    icons: pickIcons(container.icons, PUSHED_ICONS),
    colors: pick(container.colors, PUSHED_COLORS),
    constants: pushedConstants(container.constants),
    fontOverrides: { [TAB_BAR_THEME_FONT_KEY]: resolveNodeFont(container, TAB_CONTAINER_FONT_KEY) },
    fontSizes: {
      [TAB_BAR_THEME_FONT_SIZE_KEY]: resolveNodeFontSizePx(
        container,
        TAB_CONTAINER_FONT_SIZE_KEY,
        props.themeOverrideFontSizes?.[TAB_CONTAINER_FONT_SIZE_KEY]
      ),
    },
  };
}

/**
 * The bar's properties: a tab for each page, the container's selection, alignment and clip.
 * `tab_close_display_policy` is never and `max_tab_width` 0, since TabContainer exposes neither.
 */
function tabBarProperties(
  tabs: TabBarTabProperties[],
  props: TabContainerProperties
): Partial<TabBarProperties> {
  return {
    tabs,
    currentTab: tabContainerCurrentTab(props, tabs.length),
    tabAlignment: props.tabAlignment,
    clipTabs: props.clipTabs,
    maxTabWidth: 0,
    tabCloseDisplayPolicy: 0,
    // `set_tabs_position` flips the bar's tab style for the bottom (`:826`).
    tabStyleVFlip: props.tabsPosition === TABS_POSITION_BOTTOM,
  };
}

/**
 * The bar, while it shows a strip. The constructor adds it in front mode (`:1282`). A loaded
 * `all_tabs_in_front` adds it again in the mode its value names (`:868-877`), and the setter returns
 * on the default `false` (`:869-871`), so a loaded bar is always in front mode.
 */
const tabContainerInternalControls: InternalControlsFn = (container) => {
  const props = container.node.properties as TabContainerProperties;
  const tabs = deriveTabContainerTabs(container, props.tabOverrides);
  if (!(props.tabsVisible ?? true) || tabs.length === 0) return [];
  const bar: InternalControlEntry = {
    mode: 'front',
    spec: {
      type: 'TabBar',
      name: TAB_BAR_NAME,
      properties: tabBarProperties(tabs, props),
      // The tab icons, keyed by tab index as the bar keys them (`tabContainerTextureSlots`).
      textureSlots: container.textureSlots,
      pushed: tabBarPushedItems(container),
    },
  };
  return [bar];
};

/** The offset and the `side_margin` the bar's load leaves in a container `containerWidthPx` wide. */
function loadedStrip(
  container: SolveNode,
  bar: SolveNode,
  margins: StyleMargins,
  containerWidthPx: number,
  theme: NativeTheme
): LoadedStrip {
  const { drawInputs, layoutInput } = tabBarModel(bar, theme);
  return resolveTabContainerStrip(drawInputs, layoutInput, {
    containerWidthPx,
    leftMarginPx: container.rtl ? margins.right : margins.left,
    rightMarginPx: container.rtl ? margins.left : margins.right,
    sideMarginPx: requiredThemeItem(container.constants, 'side_margin'),
    rtl: container.rtl,
  });
}

/** The bar's rect, and the offset its load leaves for its painter. */
const tabContainerInternalLayout: InternalLayoutFn = (container, internals, rect, ctx) => {
  const bar = internals[0]?.node;
  if (!bar) return new Map();
  const props = container.node.properties as TabContainerProperties;
  const margins = tabbarStyleMargins(container.styleBoxes);
  const strip = loadedStrip(container, bar, margins, rect.w, ctx.theme);
  const barRect = tabBarRect(
    rect,
    ctx.combinedMinimumSize(bar).y,
    props.tabsPosition ?? TABS_POSITION_TOP,
    props.tabAlignment ?? TAB_ALIGNMENT_LEFT,
    strip.sideMarginPx,
    margins,
    container.rtl
  );
  return {
    rects: new Map([[bar.path, barRect]]),
    meta: new Map([[bar.path, tabBarLoadedOffset.seal(strip.offset)]]),
  };
};

registerInternalControls('TabContainer', tabContainerInternalControls, tabContainerInternalLayout);
