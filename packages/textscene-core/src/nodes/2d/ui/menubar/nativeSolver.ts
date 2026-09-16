/**
 * MenuBar's native (WebGL canvas) rect solver — `MenuBar::get_minimum_size`
 * (`scene/gui/menu_bar.cpp:865-886`) plus the per-title shaping `shape()`
 * does (`:520-527`), computed once here and handed to the painter as `meta`
 * so drawing never re-shapes the same strings (`Component.tsx`'s own doc has
 * the fallback story).
 *
 * A MenuBar's titles come from its PopupMenu children — a `Window`
 * subclass, never a Control, so a PopupMenu never reaches `SolveNode.children`
 * (`buildSolveTree.ts`'s own doc: a non-Control node is a transparent
 * passthrough whose Control descendants promote up; PopupMenu authors none,
 * so it simply has no representation in the solved forest at all). The raw
 * parsed tree, `SolveNode.node.children`, is the only place it still exists —
 * `subviewportcontainer/nativeSolver.ts` reads the same field for the
 * identical reason (a `SubViewport` child).
 *
 * Every draw STATE `MenuBar::_draw_menu_item` models beyond "normal"
 * (disabled/hover/pressed/focus) comes from mouse/keyboard interaction or the
 * runtime-only `set_menu_disabled`/`set_menu_hidden` API — neither has a
 * serialised property (`linterParser.ts`'s own doc: "there is no `menu_0/...`
 * indexed family"), so a static `.tscn` can never author them and every title
 * solves as Godot's plain "normal" draw mode.
 *
 * RTL layout (`is_layout_rtl()`, mirrored StyleBoxes, right-to-left offsets)
 * and the native/global menu bar (`is_native_menu()`, unreachable without a
 * host OS window manager) are out of scope, matching every other native
 * Control painter in this codebase (`centercontainer/nativeSolver.ts`'s own
 * doc on RTL).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
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

/** `SceneStringName(font)` = `"font"` — MenuBar's own theme font key (`menu_bar.cpp:748`). */
export const MENU_BAR_THEME_FONT_KEY = 'font';

/** MenuBar's own `font_size`/`font_color` theme keys (`menu_bar.cpp:748,756`) — same spelling as Button's, a separate declaration. */
export const MENU_BAR_TEXT_THEME_KEYS: TextThemeKeys = { sizeKey: 'font_size', colorKey: 'font_color' };

export interface MenuBarTitle {
  /** The PopupMenu child's own node name — a stable React key. */
  name: string;
  layout: TextLayoutResult;
  /** `text_buf->get_size() + style->get_minimum_size()` (`menu_bar.cpp:433,417`). */
  size: Vec2;
}

type RawChild = SolveNode['node']['children'][number];

/** `MenuBar::_get_popups` (`menu_bar.cpp:585-594`): direct `PopupMenu` children, in scene order. */
function popupChildren(n: SolveNode): readonly RawChild[] {
  return n.node.children.filter((child) => child.type === 'PopupMenu');
}

/**
 * `popups[i]->get_title().is_empty() ? String(popups[i]->get_name()) :
 * popups[i]->get_title()` (`MenuBar::_refresh_menu_names`, `menu_bar.cpp:534`).
 * `PopupMenu` has no own parser in this codebase (it is a `Window`, out of
 * the Control render path), so `title` is read off `rawProperties` — the one
 * field both parsers publish regardless of which produced the node
 * (`parser/types.ts`'s own doc on `TscnNode.rawProperties`).
 */
function menuTitleText(child: RawChild): string {
  const rawTitle = child.rawProperties?.title;
  const title = rawTitle !== undefined ? unquoteString(rawTitle) : '';
  return title.length > 0 ? title : child.name;
}

/**
 * Shapes every title once. `MenuBar::shape()` (`menu_bar.cpp:520-527`): a
 * single-line `TextLine`, no wrap, no `line_spacing` theme key — the same
 * shaping Button-family labels use, spelled out here rather than imported
 * since a MenuBar title is not a Button-family label.
 */
export function menuBarTitles(
  n: SolveNode,
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
 * `MenuBar::get_minimum_size` (`menu_bar.cpp:865-886`): every visible title's
 * own width summed, `h_separation` BETWEEN titles only (never a trailing
 * one), height the max of every title's own height.
 */
export const menuBarMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as MenuBarProperties;
  const style = pickButtonStyleBox(n.styleBoxes, ctx.theme.widgets.button, 'normal');
  const marginSize = contentMarginSize(style);
  const popups = popupChildren(n);
  if (popups.length === 0) return { size: { x: 0, y: 0 } };

  const hSeparation = n.constants.h_separation ?? ctx.theme.separation;

  // `ctx.measureText` is only a READINESS gate here (`solverRegistry.ts`'s own
  // contract) — every title's text is non-empty by construction (falls back
  // to the PopupMenu's own name), so unlike Button's per-text gate this one
  // applies uniformly: each title still contributes its own StyleBox margin,
  // with zero text extent, rather than the whole minimum size collapsing.
  if (!ctx.measureText) {
    const width = marginSize.x * popups.length + hSeparation * Math.max(0, popups.length - 1);
    return { size: { x: width, y: marginSize.y } };
  }

  const { fontSizePx } = resolveTextTheme(n, props, MENU_BAR_TEXT_THEME_KEYS, {
    fontSizePx: ctx.theme.fontSize,
    color: BUTTON_DEFAULT_FONT_COLOR,
  });
  const fontMetrics = resolveNodeFontMetrics(n, MENU_BAR_THEME_FONT_KEY);
  const titles = menuBarTitles(n, fontSizePx, fontMetrics, marginSize);

  let width = 0;
  let height = 0;
  for (const title of titles) {
    if (title.size.y > height) height = title.size.y;
    width += title.size.x;
  }
  if (titles.length > 1) width += hSeparation * (titles.length - 1);
  return { size: { x: width, y: height }, meta: titles };
};
