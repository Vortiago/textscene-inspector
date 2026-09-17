/**
 * FoldableContainer's native (WebGL canvas) rect solver —
 * `FoldableContainer::get_minimum_size` (`scene/gui/foldable_container.cpp:36-51`),
 * `_update_title_min_size` (`:441-478`) and the `NOTIFICATION_SORT_CHILDREN`
 * handler (`:329-386`), on top of `scene/theme/default_theme.cpp:1302-1336`'s
 * `"FoldableContainer"` theme entries.
 *
 * Every draw state this class models beyond "not hovering" (`is_hovering`,
 * `has_focus`) is mouse/keyboard-only and never authored in a `.tscn`, so
 * `_get_title_style`/`_get_title_icon` collapse to the two cases `folded`
 * alone selects — the same "static viewer, no hover/pressed/focus"
 * restriction every other native Control painter here applies.
 * `add_title_bar_control`/`remove_title_bar_control` are bound METHODS with
 * no `ADD_PROPERTY` (`foldable_container.cpp:552-553`, confirmed against the
 * full `_bind_methods`), so `title_controls` can never be authored in a
 * `.tscn` either and is not modelled, matching `MenuBar`'s own per-item
 * `menu_cache` gap.
 *
 * `foldableContainerHSeparation`/`foldableContainerArrowSize` below compute
 * `Math::round(2 * scale)` (`default_theme.cpp:1336`) and the arrow icons' own
 * 16x16 authored size scaled the same way `generate_icon(..., scale)`
 * rasterises them, off `ScaledGodotTheme.scale` — the raw, unrounded project
 * `gui/theme/default_theme_scale`.
 *
 * `_draw_flippable_stylebox`'s vertical-flip transform for `POSITION_BOTTOM`
 * (`:523-532`) is not reproduced as a transform: its NET EFFECT is simply
 * "the edge touching the other box is squared", which
 * `titleStyleCornerRadius`/`panelCornerRadius` below compute directly from
 * `title_position` — the same final corners, without a draw-time flip.
 *
 * Pure data + functions, no THREE/React — painting is `Component.tsx`'s job.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import { flatStyleBox as makeFlatStyleBox } from '../../../../r3f/controls/native/styleBoxFlat';
import { controlProps, type SolveNode } from '../../../../r3f/controls/native/solveTree';
import type {
  ChildVisibilityFn,
  ContainerLayoutFn,
  MinimumSizeFn,
  SolveContext,
  TextureSlotRequest,
  TextureSlotsFn,
} from '../../../../r3f/controls/native/solverRegistry';
import { contentMarginSize, type StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { STYLE_FILL } from '../../../../r3f/controls/godotDefaultTheme';
import { resolveTextTheme, type TextThemeKeys } from '../../../../r3f/controls/native/textTheme';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import {
  AutowrapMode,
  shapeText,
  shapedTextSizeWidthPx,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import { fitChildInRect, isSortableControl, SIZE_FILL } from '../shared/fitChildInRect';
import type { ControlColor } from '../control/types';
import type { FoldableContainerProperties } from './types';
import { TITLE_POSITION_BOTTOM, TITLE_POSITION_TOP } from './types';

/** `SceneStringName(font)`/`"font_size"` — FoldableContainer's own theme font keys (`foldable_container.cpp:568-569`). */
export const FOLDABLE_CONTAINER_THEME_FONT_KEY = 'font';

/** `Math::round(2 * scale)` (`default_theme.cpp:1336`). */
export function foldableContainerHSeparation(theme: NativeTheme): number {
  return Math.round(2 * theme.scale);
}

/** The arrow icons' own 16x16 authored size (`scene/theme/icons/arrow_*.svg`), scaled the way `generate_icon(..., scale)` rasterises it — same shape as `ScaledGodotTheme.sliderGrabberSize`. */
export function foldableContainerArrowSize(theme: NativeTheme): Vec2 {
  const size = Math.round(16 * theme.scale);
  return { x: size, y: size };
}

/** `control_font_color` (`default_theme.cpp:101`) — FoldableContainer's own `font_color` default (`:1324`). */
const FOLDABLE_CONTAINER_DEFAULT_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 1 };
/** `control_font_pressed_color = Color(1, 1, 1)` (`:108`) — FoldableContainer's own `collapsed_font_color` default (`:1326`). */
const FOLDABLE_CONTAINER_DEFAULT_COLLAPSED_FONT_COLOR: ControlColor = { r: 1, g: 1, b: 1, a: 1 };

const FOLDABLE_CONTAINER_TITLE_THEME_KEYS: Record<'expanded' | 'folded', TextThemeKeys> = {
  expanded: { sizeKey: 'font_size', colorKey: 'font_color' },
  folded: { sizeKey: 'font_size', colorKey: 'collapsed_font_color' },
};

type CornerRadius = StyleBoxFlatData['cornerRadius'];

/**
 * `make_flat_stylebox` (`default_theme.cpp:57-70`), restricted to what
 * `StyleBoxFlatData` models — the SAME shape `nativeTheme.ts`'s own
 * (unexported) `flatStyleBox` builds, mirrored here since that helper is not
 * exported and this slice cannot add an export to a file outside it.
 */
function flatStyleBox(
  bgColor: ControlColor,
  contentMargin: { left: number; top: number; right: number; bottom: number },
  cornerRadius: CornerRadius
): StyleBoxFlatData {
  return makeFlatStyleBox(bgColor, { contentMargin, cornerRadius });
}

/**
 * The title StyleBox's corners: `foldable_container_title`/
 * `_collapsed_panel` both start from a UNIFORM `default_corner_radius`
 * (`default_theme.cpp:1302-1311`); only the UNFOLDED style then squares its
 * corners on the edge touching the content panel (`:1303-1304`) — see module
 * doc for why that squared edge flips with `title_position` here instead of
 * through a draw-time transform.
 */
function titleStyleCornerRadius(radius: number, folded: boolean, titlePosition: number): CornerRadius {
  if (folded) return { topLeft: radius, topRight: radius, bottomRight: radius, bottomLeft: radius };
  return titlePosition === TITLE_POSITION_BOTTOM
    ? { topLeft: 0, topRight: 0, bottomRight: radius, bottomLeft: radius }
    : { topLeft: radius, topRight: radius, bottomRight: 0, bottomLeft: 0 };
}

/** The content panel's corners: squared on the edge touching the title (`default_theme.cpp:1313-1316`), the mirror of `titleStyleCornerRadius`. */
function panelCornerRadius(radius: number, titlePosition: number): CornerRadius {
  return titlePosition === TITLE_POSITION_BOTTOM
    ? { topLeft: radius, topRight: radius, bottomRight: 0, bottomLeft: 0 }
    : { topLeft: 0, topRight: 0, bottomRight: radius, bottomLeft: radius };
}

function defaultTitleStyle(theme: NativeTheme, folded: boolean, titlePosition: number): StyleBoxFlatData {
  const margin = {
    left: theme.contentMargin,
    top: theme.contentMargin,
    right: theme.contentMargin,
    bottom: theme.contentMargin,
  };
  // default_theme.cpp:1302,1311: both title styles fill with style_pressed_color.
  return flatStyleBox(STYLE_FILL.pressed, margin, titleStyleCornerRadius(theme.cornerRadius, folded, titlePosition));
}

function defaultPanelStyle(theme: NativeTheme, titlePosition: number): StyleBoxFlatData {
  const margin = {
    left: theme.contentMargin,
    top: theme.contentMargin,
    right: theme.contentMargin,
    bottom: theme.contentMargin,
  };
  return flatStyleBox(STYLE_FILL.normal, margin, panelCornerRadius(theme.cornerRadius, titlePosition));
}

export type FoldableContainerArrow = 'expanded' | 'expandedMirrored' | 'folded' | 'foldedMirrored';

/**
 * `FoldableContainer::_get_title_icon` (`foldable_container.cpp:428-435`):
 * unfolded, `title_position` alone picks `expanded_arrow`/`_mirrored`; folded,
 * the arrow points along the reading direction, so RTL takes
 * `folded_arrow_mirrored`.
 */
function titleArrow(folded: boolean, titlePosition: number, rtl: boolean): FoldableContainerArrow {
  if (folded) return rtl ? 'foldedMirrored' : 'folded';
  return titlePosition === TITLE_POSITION_BOTTOM ? 'expandedMirrored' : 'expanded';
}

/** `FoldableContainerArrow` → the Theme item name Godot registers it under (`BIND_THEME_ITEM(Theme::DATA_TYPE_ICON, FoldableContainer, <name>)`, `foldable_container.cpp:588-591`). */
export const FOLDABLE_CONTAINER_ARROW_THEME_NAME: Record<FoldableContainerArrow, string> = {
  expanded: 'expanded_arrow',
  expandedMirrored: 'expanded_arrow_mirrored',
  folded: 'folded_arrow',
  foldedMirrored: 'folded_arrow_mirrored',
};

/** Which arrow slot(s) have a themed answer — `TextureSlotsFn` for `controlSolverRegistry.registerTextureSlots`. */
export const foldableContainerTextureSlots: TextureSlotsFn = (_node, themedIcons = {}) => {
  const requests: TextureSlotRequest[] = [];
  for (const name of Object.values(FOLDABLE_CONTAINER_ARROW_THEME_NAME)) {
    const themed = themedIcons[name];
    if (themed) requests.push({ key: name, ref: themed.ref, scope: themed.resources });
  }
  return requests;
};

/** This arrow's resolved size — themed if `SolveNode.textureSlots` resolved it, else the vendored (scaled) default. */
function resolveArrowSize(n: Pick<SolveNode, 'textureSlots'>, arrow: FoldableContainerArrow, theme: NativeTheme): Vec2 {
  return n.textureSlots[FOLDABLE_CONTAINER_ARROW_THEME_NAME[arrow]] ?? foldableContainerArrowSize(theme);
}

export interface FoldableContainerTitleMetrics {
  folded: boolean;
  titlePosition: number;
  titleStyle: StyleBoxFlatData;
  panelStyle: StyleBoxFlatData;
  arrow: FoldableContainerArrow;
  /** The current arrow's resolved size — themed if a Theme touched it, else the vendored default (`resolveArrowSize`). */
  arrowSize: Vec2;
  fontSizePx: number;
  color: ControlColor;
  /** The shaped title text, or `null` for an empty title / no measurer yet. */
  layout: TextLayoutResult | null;
  /** `title_minimum_size` (`foldable_container.cpp:441-478`) — the title bar's own minimum size. */
  size: Vec2;
}

/**
 * `FoldableContainer::_update_title_min_size` (`foldable_container.cpp:441-478`),
 * plus the StyleBox/icon/font resolution `_get_title_style`/`_get_title_icon`/
 * `_shape` (`:421-435,481-501`) that feeds it — computed once here and reused
 * by `foldableContainerMinimumSize`, `foldableContainerLayout` and (via
 * `meta`) `Component.tsx`, so all three agree on the SAME title bar.
 */
export function foldableContainerTitleMetrics(
  n: SolveNode,
  props: FoldableContainerProperties,
  ctx: Pick<SolveContext, 'theme'>,
  /**
   * Whether to shape the title's text now. `false` only from the SOLVE step
   * when `ctx.measureText` is a readiness gate that has not fired yet (the
   * same "an absent measurer means text contributes nothing" contract every
   * other `MinimumSizeFn` here honours) — `Component.tsx`'s own fallback
   * always passes `true`, since by paint time the font metrics are available
   * (`buttonMinimumSize`'s own doc explains the same split for Button).
   */
  shapeTitle: boolean
): FoldableContainerTitleMetrics {
  const folded = props.folded === true;
  const titlePosition = props.titlePosition ?? TITLE_POSITION_TOP;
  const overrunBehavior = props.titleTextOverrunBehavior ?? 0; // OVERRUN_NO_TRIMMING

  const titleStyle = folded
    ? (n.styleBoxes.title_collapsed_panel ?? defaultTitleStyle(ctx.theme, true, titlePosition))
    : (n.styleBoxes.title_panel ?? defaultTitleStyle(ctx.theme, false, titlePosition));
  const panelStyle = n.styleBoxes.panel ?? defaultPanelStyle(ctx.theme, titlePosition);
  const arrow = titleArrow(folded, titlePosition, n.rtl);

  const stateKey = folded ? 'folded' : 'expanded';
  const { fontSizePx, color } = resolveTextTheme(n, props, FOLDABLE_CONTAINER_TITLE_THEME_KEYS[stateKey], {
    fontSizePx: ctx.theme.fontSize,
    color: folded ? FOLDABLE_CONTAINER_DEFAULT_COLLAPSED_FONT_COLOR : FOLDABLE_CONTAINER_DEFAULT_FONT_COLOR,
  });

  const title = props.title ?? '';
  const hasTitle = title.length > 0;
  const fontMetrics = resolveNodeFontMetrics(n, FOLDABLE_CONTAINER_THEME_FONT_KEY);
  const layout: TextLayoutResult | null =
    hasTitle && shapeTitle
      ? shapeText(title, { fontSizePx, boxWidthPx: 0, autowrapMode: AutowrapMode.OFF, lineSpacingPx: 0, fontMetrics })
      : null;

  const arrowSize = resolveArrowSize(n, arrow, ctx.theme);
  const titleMargin = contentMarginSize(titleStyle);
  let width = titleMargin.x + arrowSize.x;
  let height = titleMargin.y;

  if (hasTitle) {
    width += foldableContainerHSeparation(ctx.theme);
    const textHeight = layout ? layout.heightPx : 0;
    height += Math.max(textHeight, arrowSize.y);
    // foldable_container.cpp:455: only OVERRUN_NO_TRIMMING (0) adds the text's
    // own width — any trimming mode leaves the title bar sized to the arrow alone.
    if (overrunBehavior === 0 && layout) {
      width += shapedTextSizeWidthPx(layout.widthPx);
    }
  } else {
    height += arrowSize.y;
  }

  return { folded, titlePosition, titleStyle, panelStyle, arrow, arrowSize, fontSizePx, color, layout, size: { x: width, y: height } };
}

/**
 * `NOTIFICATION_SORT_CHILDREN`'s `c->set_visible(!folded)`
 * (`foldable_container.cpp:376-386`) — a runtime WRITE to each direct sortable
 * Control child's own `visible`, so it overrides the authored flag in both
 * directions: folded hides a child that authored nothing, and unfolding shows
 * one that authored `visible = false`.
 *
 * Godot's loop writes the same value to every child here, so the per-child
 * arguments {@link ChildVisibilityFn} carries for TabContainer's sake go
 * unread.
 */
export const foldableContainerChildVisibility: ChildVisibilityFn = (node) =>
  (node.properties as FoldableContainerProperties).folded !== true;

/**
 * `FoldableContainer::get_minimum_size` (`foldable_container.cpp:36-51`):
 * folded, the title bar's own minimum size IS the container's; unfolded, the
 * per-axis max of every visible child's combined minimum size, plus the
 * panel style's margins, floored against the title bar's own width.
 */
export const foldableContainerMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as FoldableContainerProperties;
  const title = foldableContainerTitleMetrics(n, props, ctx, Boolean(ctx.measureText));

  if (title.folded) {
    return { size: title.size, meta: title };
  }

  let width = 0;
  let height = 0;
  for (const child of n.children) {
    if (!isSortableControl(child)) continue;
    const childMin = ctx.combinedMinimumSize(child);
    if (childMin.x > width) width = childMin.x;
    if (childMin.y > height) height = childMin.y;
  }
  const panelMargin = contentMarginSize(title.panelStyle);
  width += panelMargin.x;
  height += panelMargin.y;

  return {
    size: { x: Math.max(width, title.size.x), y: height + title.size.y },
    meta: title,
  };
};

/**
 * `FoldableContainer::_notification`'s `NOTIFICATION_SORT_CHILDREN`
 * (`foldable_container.cpp:329-386`), the content-fitting half only —
 * `title_controls` is never serialised (see module doc). Folded, Godot skips
 * `fit_child_in_rect` entirely, so this returns an EMPTY map; the children do
 * not draw because {@link foldableContainerChildVisibility} has already
 * cleared their `visible`, which is what makes an absent rect unobservable.
 */
export const foldableContainerLayout: ContainerLayoutFn = (n, children, rect, ctx) => {
  const props = n.node.properties as FoldableContainerProperties;
  const title = foldableContainerTitleMetrics(n, props, ctx, Boolean(ctx.measureText));
  const out = new Map<string, Rect2>();
  if (title.folded) return out;

  const { left, top, right, bottom } = title.panelStyle.contentMargin;
  const contentRect: Rect2 = {
    // `inner_rect.position.x = rtl ? margin(SIDE_RIGHT) : margin(SIDE_LEFT)`
    // (`foldable_container.cpp:365-367`); the WIDTH subtracts both either way.
    x: n.rtl ? right : left,
    y: top + (title.titlePosition === TITLE_POSITION_TOP ? title.size.y : 0),
    w: rect.w - left - right,
    h: rect.h - top - bottom - title.size.y,
  };

  for (const { node: child, minSize } of children) {
    if (!isSortableControl(child)) continue;
    const childProps = controlProps(child);
    out.set(
      child.path,
      fitChildInRect(
        contentRect,
        minSize,
        childProps.sizeFlagsHorizontal ?? SIZE_FILL,
        childProps.sizeFlagsVertical ?? SIZE_FILL,
        n.rtl
      )
    );
  }
  return out;
};
