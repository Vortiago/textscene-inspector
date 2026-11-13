/**
 * FoldableContainer's native rect solver: `get_minimum_size` (`scene/gui/foldable_container.cpp:36-51`),
 * `_update_title_min_size` (`:441-478`) and `NOTIFICATION_SORT_CHILDREN` (`:329-386`), with the
 * "FoldableContainer" entries of `scene/theme/default_theme.cpp:1302-1336`. No `.tscn` sets hover or
 * focus, so `folded` alone picks the title style and icon.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { isTextWidthClipped } from '../../../../r3f/controls/native/text/textOverrun';
import type { Rect2 } from '../../../../godot/math/rect2';
import { defineShare, type ShareNode } from '../../../../r3f/controls/native/solveHandoff';
import { controlProps, type SolveNode } from '../../../../r3f/controls/native/solveTree';
import type {
  ChildVisibilityFn,
  ContainerLayoutFn,
  MinimumSizeFn,
  SolveContext,
  TextureSlotsFn,
} from '../../../../r3f/controls/native/solverRegistry';
import { themedSlotRequests } from '../../../../r3f/controls/native/solverRegistry';
import { contentMarginSize } from '../../../../r3f/controls/native/styleBoxFlat';
import type { ResolvedStyleBox } from '../../../../r3f/controls/native/parseStyleBox';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { resolveTextTheme, type TextThemeKeys } from '../../../../r3f/controls/native/textTheme';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import {
  shapeText,
  shapedTextSizeWidthPx,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import { fitChildInRect, isSortableControl } from '../shared/fitChildInRect';
import { controlBidiOptions, isDrawnRtl } from '../../../../r3f/controls/native/text/textBidiOptions';
import type { FoldableContainerProperties } from './types';
import { TITLE_POSITION_BOTTOM, TITLE_POSITION_TOP } from './types';
import type { Vector2 } from '../../../../godot/math/vector';
import type { Rgba } from '../../../../godot/math/math';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { SizeFlags } from '../../../../godot/scene/control';

/** `SceneStringName(font)` and `"font_size"`: the theme font keys of FoldableContainer (`foldable_container.cpp:568-569`). */
const FOLDABLE_CONTAINER_THEME_FONT_KEY = 'font';

/** `_get_h_separation` (`foldable_container.h:93`): the theme's `h_separation`, floored at 0. */
export function foldableContainerHSeparation(n: Pick<SolveNode, 'constants'>): number {
  return Math.max(requiredThemeItem(n.constants, 'h_separation'), 0);
}

/** The 16x16 size of the arrow icons (`scene/theme/icons/arrow_*.svg`), scaled as `generate_icon(..., scale)` rasterises them. */
function foldableContainerArrowSize(theme: NativeTheme): Vector2 {
  const size = Math.round(16 * theme.scale);
  return { x: size, y: size };
}

const FOLDABLE_CONTAINER_TITLE_THEME_KEYS: Record<'expanded' | 'folded', TextThemeKeys> = {
  expanded: { sizeKey: 'font_size', colorKey: 'font_color' },
  folded: { sizeKey: 'font_size', colorKey: 'collapsed_font_color' },
};

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
  return themedSlotRequests(Object.values(FOLDABLE_CONTAINER_ARROW_THEME_NAME), themedIcons);
};

/** The arrow's size: themed when `SolveNode.textureSlots` resolved it, else the scaled vendored default. */
function resolveArrowSize(
  n: Pick<SolveNode, 'textureSlots'>,
  arrow: FoldableContainerArrow,
  theme: NativeTheme
): Vector2 {
  return n.textureSlots[FOLDABLE_CONTAINER_ARROW_THEME_NAME[arrow]] ?? foldableContainerArrowSize(theme);
}

export interface FoldableContainerTitleMetrics {
  folded: boolean;
  titlePosition: number;
  titleStyle: ResolvedStyleBox;
  panelStyle: ResolvedStyleBox;
  arrow: FoldableContainerArrow;
  /** The resolved size of the current arrow (`resolveArrowSize`). */
  arrowSize: Vector2;
  fontSizePx: number;
  color: Rgba;
  /** The shaped title text, or `null` for an empty title or before a measurer exists. */
  layout: TextLayoutResult | null;
  /** Whether the title draws right to left, from its set direction (`isDrawnRtl`). */
  isDrawnRtl: boolean;
  /**
   * `title_minimum_size` (`foldable_container.cpp:441-478`): the minimum size of the title bar. It has
   * no `title_controls` term: `add_title_bar_control` is a method with no `ADD_PROPERTY`
   * (`foldable_container.cpp:552-553`), so no `.tscn` can author one.
   */
  size: Vector2;
}

/**
 * `FoldableContainer::_update_title_min_size` (`foldable_container.cpp:441-478`), with the
 * style, icon and font of `_get_title_style`, `_get_title_icon` and `_shape` (`:421-435,481-501`).
 * The title shapes in `title_text_direction`, INHERITED taking the layout direction (`:491-495`).
 * The shaped result is the share {@link foldableContainerTitleShape}. The unshaped one
 * stays a plain call: a memoised unshaped title would outlive the readiness gate.
 */
function foldableContainerTitleMetrics(
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

  const titleStyle = requiredThemeItem(n.styleBoxes, folded ? 'title_collapsed_panel' : 'title_panel');
  const panelStyle = requiredThemeItem(n.styleBoxes, 'panel');
  const arrow = titleArrow(folded, titlePosition, n.rtl);

  const stateKey = folded ? 'folded' : 'expanded';
  const { fontSizePx, color } = resolveTextTheme(n, props, FOLDABLE_CONTAINER_TITLE_THEME_KEYS[stateKey], {
    fontSizePx: ctx.theme.fontSize,
  });

  const title = props.title ?? '';
  const hasTitle = title.length > 0;
  const fontMetrics = resolveNodeFontMetrics(n, FOLDABLE_CONTAINER_THEME_FONT_KEY);
  const bidi = controlBidiOptions({ textDirection: props.titleTextDirection, language: props.language }, n);
  const layout: TextLayoutResult | null =
    hasTitle && shapeTitle
      ? shapeText(title, {
          ...bidi,
          fontSizePx,
          boxWidthPx: 0,
          autowrapMode: AutowrapMode.AUTOWRAP_OFF,
          lineSpacingPx: 0,
          fontMetrics,
        })
      : null;

  const arrowSize = resolveArrowSize(n, arrow, ctx.theme);
  const titleMargin = contentMarginSize(titleStyle);
  let width = titleMargin.x + arrowSize.x;
  let height = titleMargin.y;

  if (hasTitle) {
    width += foldableContainerHSeparation(n);
    const textHeight = layout ? layout.heightPx : 0;
    height += Math.max(textHeight, arrowSize.y);
    // foldable_container.cpp:455: only OVERRUN_NO_TRIMMING adds the text width.
    // A trimming mode sizes the title bar to the arrow alone.
    if (!isTextWidthClipped({ overrunBehavior: props.titleTextOverrunBehavior }) && layout) {
      width += shapedTextSizeWidthPx(layout.widthPx);
    }
  } else {
    height += arrowSize.y;
  }

  return {
    folded,
    titlePosition,
    titleStyle,
    panelStyle,
    arrow,
    arrowSize,
    fontSizePx,
    color,
    layout,
    isDrawnRtl: isDrawnRtl(bidi),
    size: { x: width, y: height },
  };
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
        childProps.sizeFlagsHorizontal ?? SizeFlags.FILL,
        childProps.sizeFlagsVertical ?? SizeFlags.FILL,
        n.rtl
      )
    );
  }
  return out;
};
