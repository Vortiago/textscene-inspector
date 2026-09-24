/**
 * MenuBar's native rect solver: `MenuBar::get_minimum_size` (`scene/gui/menu_bar.cpp:865-886`) and the
 * per-title shaping of `shape()` (`:520-527`) as {@link menuBarTitleShapes}, which `Component.tsx` reads
 * too. Every title solves in the plain "normal" draw mode: other states need input or the runtime-only
 * `set_menu_disabled`/`set_menu_hidden`, which no property serialises. The native menu bar is out of scope.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import { defineShare, type ShareNode } from '../../../../r3f/controls/native/solveHandoff';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { Vec2 } from '../../../../r3f/controls/native/rect';
import type { FontMetrics } from '../../../../r3f/controls/native/text/fontMetrics';
import { contentMarginSize } from '../../../../r3f/controls/native/styleBoxFlat';
import { pickButtonStyleBox } from '../../../../r3f/controls/native/buttonBase';
import {
  AutowrapMode,
  shapeText,
  shapedTextSizeWidthPx,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import { resolveTextTheme, type TextThemeKeys } from '../../../../r3f/controls/native/textTheme';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { unquoteString } from '../../../../parser/utils';
import { BUTTON_DEFAULT_FONT_COLOR } from '../button/nativeSolver';
import type { MenuBarProperties } from './types';

/** `SceneStringName(font)`, MenuBar's own theme font key (`menu_bar.cpp:748`). */
export const MENU_BAR_THEME_FONT_KEY = 'font';

/** MenuBar's own `font_size` and `font_color` theme keys (`menu_bar.cpp:748,756`), spelled as Button's but declared apart. */
export const MENU_BAR_TEXT_THEME_KEYS: TextThemeKeys = { sizeKey: 'font_size', colorKey: 'font_color' };

export interface MenuBarTitle {
  /** The PopupMenu child's node name, a stable React key. */
  name: string;
  layout: TextLayoutResult;
  /** `text_buf->get_size() + style->get_minimum_size()` (`menu_bar.cpp:433,417`). */
  size: Vec2;
}

type RawChild = SolveNode['node']['children'][number];

/** `MenuBar::_get_popups` (`menu_bar.cpp:585-594`): direct `PopupMenu` children, in scene order. */
function popupChildren(n: ShareNode): readonly RawChild[] {
  return n.node.children.filter((child) => child.type === 'PopupMenu');
}

/**
 * `popups[i]->get_title().is_empty() ? String(popups[i]->get_name()) : popups[i]->get_title()`
 * (`MenuBar::_refresh_menu_names`, `menu_bar.cpp:534`). PopupMenu is a `Window` with no parser here, so
 * `title` comes from `rawProperties`, which both parsers publish (`TscnNode.rawProperties`).
 */
function menuTitleText(child: RawChild): string {
  const rawTitle = child.rawProperties?.title;
  const title = rawTitle !== undefined ? unquoteString(rawTitle) : '';
  return title.length > 0 ? title : child.name;
}

/**
 * Shapes every title once, as `MenuBar::shape()` (`menu_bar.cpp:520-527`): one `TextLine`, no wrap, no
 * `line_spacing`. It matches Button-family shaping but is spelled out, since a title is no Button label.
 */
export function menuBarTitles(
  n: ShareNode,
  fontSizePx: number,
  fontMetrics: FontMetrics,
  marginSize: Vec2
): MenuBarTitle[] {
  return popupChildren(n).map((child) => {
    const layout = shapeText(menuTitleText(child), {
      fontSizePx,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.OFF,
      lineSpacingPx: 0,
      fontMetrics,
    });
    return {
      name: child.name,
      layout,
      size: {
        x: shapedTextSizeWidthPx(layout.widthPx) + marginSize.x,
        y: layout.heightPx + marginSize.y,
      },
    };
  });
}

/**
 * Every title, shaped: the solve-handoff share (`r3f/controls/native/solveHandoff.ts`) of
 * `menuBarMinimumSize` and `Component.tsx`. It reads the raw `n.node.children`, since PopupMenu children
 * are Windows and never enter the solve tree. `_get_menu_item_rect` and `get_minimum_size` measure
 * `theme_cache.normal` (`menu_bar.cpp:412,869`), so this picks the unmirrored box.
 */
export const menuBarTitleShapes = defineShare<MenuBarTitle[]>((n, theme) => {
  const props = n.node.properties as MenuBarProperties;
  const marginSize = contentMarginSize(pickButtonStyleBox(n.styleBoxes, theme.widgets.button, 'normal'));
  const { fontSizePx } = resolveTextTheme(n, props, MENU_BAR_TEXT_THEME_KEYS, {
    fontSizePx: theme.fontSize,
    color: BUTTON_DEFAULT_FONT_COLOR,
  });
  return menuBarTitles(n, fontSizePx, resolveNodeFontMetrics(n, MENU_BAR_THEME_FONT_KEY), marginSize);
});

/**
 * `MenuBar::get_minimum_size` (`menu_bar.cpp:865-886`): the visible titles' widths summed, with
 * `h_separation` between titles only, never trailing, by the tallest title's height.
 */
export const menuBarMinimumSize: MinimumSizeFn = (n, ctx) => {
  const style = pickButtonStyleBox(n.styleBoxes, ctx.theme.widgets.button, 'normal');
  const marginSize = contentMarginSize(style);
  const popups = popupChildren(n);
  if (popups.length === 0) return { x: 0, y: 0 };

  const hSeparation = n.constants.h_separation ?? ctx.theme.separation;

  // `ctx.measureText` is only a readiness gate (`solverRegistry.ts`). Every title is non-empty, falling
  // back to the PopupMenu's name, so each still adds its StyleBox margin with zero text extent.
  if (!ctx.measureText) {
    const width = marginSize.x * popups.length + hSeparation * Math.max(0, popups.length - 1);
    return { x: width, y: marginSize.y };
  }

  const titles = menuBarTitleShapes(n, ctx.theme);

  let width = 0;
  let height = 0;
  for (const title of titles) {
    if (title.size.y > height) height = title.size.y;
    width += title.size.x;
  }
  if (titles.length > 1) width += hSeparation * (titles.length - 1);
  return { x: width, y: height };
};

export interface MenuBarItemPlacement {
  title: MenuBarTitle;
  /** This item's x inside the bar. */
  x: number;
}

/**
 * `MenuBar::_get_menu_item_rect` (`menu_bar.cpp:408-428`) per title: the LTR offset sums the previous
 * widths plus one `h_separation` each. Under `rtl` the item mirrors inside the bar's width, not its
 * minimum (`:424`), so a stretched bar hangs its first item off the trailing edge.
 */
export function layoutMenuBarItems(
  titles: readonly MenuBarTitle[],
  hSeparationPx: number,
  barWidthPx: number,
  rtl: boolean
): MenuBarItemPlacement[] {
  let offset = 0;
  return titles.map((title) => {
    const x = rtl ? barWidthPx - offset - title.size.x : offset;
    offset += title.size.x + hSeparationPx;
    return { title, x };
  });
}
