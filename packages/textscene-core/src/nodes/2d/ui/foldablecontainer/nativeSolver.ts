/**
 * FoldableContainer's native rect solver: `get_minimum_size`
 * (`scene/gui/foldable_container.cpp:36-51`), `_update_title_min_size` (`:441-478`) and
 * `NOTIFICATION_SORT_CHILDREN` (`:329-386`), with the "FoldableContainer" entries of
 * `scene/theme/default_theme.cpp:1302-1336`. Hover and focus never come from a `.tscn`,
 * so `folded` alone picks the title style and icon.
 *
 * `title_controls` is not modelled: `add_title_bar_control` is a method with no
 * `ADD_PROPERTY` (`foldable_container.cpp:552-553`), so no `.tscn` can author it.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import { flatStyleBox as makeFlatStyleBox } from '../../../../r3f/controls/native/styleBoxFlat';
import { defineShare, type ShareNode } from '../../../../r3f/controls/native/solveHandoff';
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

/** `SceneStringName(font)` and `"font_size"`: the theme font keys of FoldableContainer (`foldable_container.cpp:568-569`). */
export const FOLDABLE_CONTAINER_THEME_FONT_KEY = 'font';

/** `Math::round(2 * scale)` (`default_theme.cpp:1336`), from the raw, unrounded `gui/theme/default_theme_scale`. */
export function foldableContainerHSeparation(theme: NativeTheme): number {
  return Math.round(2 * theme.scale);
}

/** The 16x16 size of the arrow icons (`scene/theme/icons/arrow_*.svg`), scaled as `generate_icon(..., scale)` rasterises them. */
export function foldableContainerArrowSize(theme: NativeTheme): Vec2 {
  const size = Math.round(16 * theme.scale);
  return { x: size, y: size };
}

/** `control_font_color` (`default_theme.cpp:101`): the default `font_color` of FoldableContainer (`:1324`). */
const FOLDABLE_CONTAINER_DEFAULT_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 1 };
/** `control_font_pressed_color = Color(1, 1, 1)` (`:108`): the default `collapsed_font_color` (`:1326`). */
const FOLDABLE_CONTAINER_DEFAULT_COLLAPSED_FONT_COLOR: ControlColor = { r: 1, g: 1, b: 1, a: 1 };

const FOLDABLE_CONTAINER_TITLE_THEME_KEYS: Record<'expanded' | 'folded', TextThemeKeys> = {
  expanded: { sizeKey: 'font_size', colorKey: 'font_color' },
  folded: { sizeKey: 'font_size', colorKey: 'collapsed_font_color' },
};

type CornerRadius = StyleBoxFlatData['cornerRadius'];

/**
 * `make_flat_stylebox` (`default_theme.cpp:57-70`), with the fields `StyleBoxFlatData` models.
 */
function flatStyleBox(
  bgColor: ControlColor,
  contentMargin: { left: number; top: number; right: number; bottom: number },
  cornerRadius: CornerRadius
): StyleBoxFlatData {
  return makeFlatStyleBox(bgColor, { contentMargin, cornerRadius });
}

/**
 * The corners of the title StyleBox: both styles start from a uniform `default_corner_radius`
 * (`default_theme.cpp:1302-1311`), and the unfolded one squares the edge that touches the panel
 * (`:1303-1304`). `_draw_flippable_stylebox` flips it for `POSITION_BOTTOM` (`:523-532`), and
 * choosing the corners from `title_position` gives the same result without the flip.
 */
function titleStyleCornerRadius(radius: number, folded: boolean, titlePosition: number): CornerRadius {
  if (folded) return { topLeft: radius, topRight: radius, bottomRight: radius, bottomLeft: radius };
  return titlePosition === TITLE_POSITION_BOTTOM
    ? { topLeft: 0, topRight: 0, bottomRight: radius, bottomLeft: radius }
    : { topLeft: radius, topRight: radius, bottomRight: 0, bottomLeft: 0 };
}

/** The corners of the content panel, squared on the edge that touches the title (`default_theme.cpp:1313-1316`). */
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

/** The Theme item name of each arrow (`BIND_THEME_ITEM(Theme::DATA_TYPE_ICON, FoldableContainer, <name>)`, `foldable_container.cpp:588-591`). */
export const FOLDABLE_CONTAINER_ARROW_THEME_NAME: Record<FoldableContainerArrow, string> = {
  expanded: 'expanded_arrow',
  expandedMirrored: 'expanded_arrow_mirrored',
  folded: 'folded_arrow',
  foldedMirrored: 'folded_arrow_mirrored',
};

/** The arrow slots that have a themed answer, for `controlSolverRegistry.registerTextureSlots`. */
export const foldableContainerTextureSlots: TextureSlotsFn = (_node, themedIcons = {}) => {
  const requests: TextureSlotRequest[] = [];
  for (const name of Object.values(FOLDABLE_CONTAINER_ARROW_THEME_NAME)) {
    const themed = themedIcons[name];
    if (themed) requests.push({ key: name, ref: themed.ref, scope: themed.resources });
  }
  return requests;
};

/** The arrow's size: themed when `SolveNode.textureSlots` resolved it, else the scaled vendored default. */
function resolveArrowSize(n: Pick<SolveNode, 'textureSlots'>, arrow: FoldableContainerArrow, theme: NativeTheme): Vec2 {
  return n.textureSlots[FOLDABLE_CONTAINER_ARROW_THEME_NAME[arrow]] ?? foldableContainerArrowSize(theme);
}

export interface FoldableContainerTitleMetrics {
  folded: boolean;
  titlePosition: number;
  titleStyle: StyleBoxFlatData;
  panelStyle: StyleBoxFlatData;
  arrow: FoldableContainerArrow;
  /** The resolved size of the current arrow (`resolveArrowSize`). */
  arrowSize: Vec2;
  fontSizePx: number;
  color: ControlColor;
  /** The shaped title text, or `null` for an empty title or before a measurer exists. */
  layout: TextLayoutResult | null;
  /** `title_minimum_size` (`foldable_container.cpp:441-478`): the minimum size of the title bar. */
  size: Vec2;
}

/**
 * `FoldableContainer::_update_title_min_size` (`foldable_container.cpp:441-478`), with the
 * style, icon and font of `_get_title_style`, `_get_title_icon` and `_shape` (`:421-435,481-501`).
 * The shaped result is the share {@link foldableContainerTitleShape}. The unshaped one
 * stays a plain call: a memoised unshaped title would outlive the readiness gate.
 */
export function foldableContainerTitleMetrics(
  n: ShareNode,
  props: FoldableContainerProperties,
  ctx: Pick<SolveContext, 'theme'>,
  /**
   * Whether to shape the title now. `false` only from the solve before `ctx.measureText`
   * exists: an absent measurer means text contributes nothing.
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
    // foldable_container.cpp:455: only OVERRUN_NO_TRIMMING (0) adds the text width.
    // A trimming mode sizes the title bar to the arrow alone.
    if (overrunBehavior === 0 && layout) {
      width += shapedTextSizeWidthPx(layout.widthPx);
    }
  } else {
    height += arrowSize.y;
  }

  return { folded, titlePosition, titleStyle, panelStyle, arrow, arrowSize, fontSizePx, color, layout, size: { x: width, y: height } };
}

/**
 * {@link foldableContainerTitleMetrics}, shaped and memoised as the solve handoff share
 * (`r3f/controls/native/solveHandoff.ts`). Both solver entry points and `Component.tsx`
 * call it, so all three agree on one title bar.
 */
export const foldableContainerTitleShape = defineShare<FoldableContainerTitleMetrics>((n, theme) =>
  foldableContainerTitleMetrics(n, n.node.properties as FoldableContainerProperties, { theme }, true)
);

/**
 * `c->set_visible(!folded)` in `NOTIFICATION_SORT_CHILDREN` (`foldable_container.cpp:376-386`)
 * writes `visible` on each sortable child, so it overrides the authored flag both ways.
 * Every child gets the same value, so the per-child arguments of {@link ChildVisibilityFn} go unread.
 */
export const foldableContainerChildVisibility: ChildVisibilityFn = (node) =>
  (node.properties as FoldableContainerProperties).folded !== true;

/**
 * The title bar as the solve sees it: the share once `ctx.measureText` exists,
 * and the unshaped variant before.
 */
function foldableContainerTitle(n: SolveNode, ctx: SolveContext): FoldableContainerTitleMetrics {
  if (ctx.measureText) return foldableContainerTitleShape(n, ctx.theme);
  return foldableContainerTitleMetrics(n, n.node.properties as FoldableContainerProperties, ctx, false);
}

/**
 * `FoldableContainer::get_minimum_size` (`foldable_container.cpp:36-51`): folded, the title
 * bar's minimum. Unfolded, the per-axis max of the child minimums plus the panel margins,
 * floored at the title width.
 */
export const foldableContainerMinimumSize: MinimumSizeFn = (n, ctx) => {
  const title = foldableContainerTitle(n, ctx);

  if (title.folded) return title.size;

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

  return { x: Math.max(width, title.size.x), y: height + title.size.y };
};

/**
 * The content half of `NOTIFICATION_SORT_CHILDREN` (`foldable_container.cpp:329-386`).
 * Folded, Godot skips `fit_child_in_rect`, so the map is empty. The hidden children
 * ({@link foldableContainerChildVisibility}) make an absent rect unobservable.
 */
export const foldableContainerLayout: ContainerLayoutFn = (n, children, rect, ctx) => {
  const title = foldableContainerTitle(n, ctx);
  const out = new Map<string, Rect2>();
  if (title.folded) return out;

  const { left, top, right, bottom } = title.panelStyle.contentMargin;
  const contentRect: Rect2 = {
    // `inner_rect.position.x = rtl ? margin(SIDE_RIGHT) : margin(SIDE_LEFT)`
    // (`foldable_container.cpp:365-367`). The width subtracts both.
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
