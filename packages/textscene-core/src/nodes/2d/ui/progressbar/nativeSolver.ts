/**
 * ProgressBar's native (WebGL canvas) rect solver
 * (`scene/gui/progress_bar.cpp:37-48`) and draw geometry, with its
 * default `background` and `fill` StyleBoxes (`scene/theme/default_theme.cpp:438-449`).
 * `Component.tsx` paints with the same builder, so the minimum size and the
 * drawn box always agree.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import {
  controlSolverRegistry,
  type MinimumSizeFn,
  type SolveContext,
} from '../../../../r3f/controls/native/solverRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { Rect2, Vec2 } from '../../../../r3f/controls/native/rect';
import { contentMarginSize, type StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { DEFAULT_FONT_SIZE } from '../../../../r3f/controls/godotDefaultTheme';
import {
  resolveTextTheme,
  type ResolvedTextTheme,
  type TextThemeDefaults,
  type TextThemeKeys,
} from '../../../../r3f/controls/native/textTheme';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { AutowrapMode, shapeText } from '../../../../r3f/controls/native/text/textLayout';
import { resolveRangeValue, type RangeProperties, type RangeValueOrder } from '../shared/range';
import { isEqualApprox } from '../../../../godot/index.js';
import type { ControlColor } from '../control/types';
import type { ProgressBarProperties } from './types';

/**
 * `default_theme.cpp:440-441`: `make_flat_stylebox(color, 2, 2, 2, 2, 6)`, not
 * the `default_margin` = 4 and `default_corner_radius` = 3 of every other flat
 * stylebox in `nativeTheme.ts`.
 */
const PROGRESS_BAR_STYLE_MARGIN = 2;
const PROGRESS_BAR_CORNER_RADIUS = 6;

const ZERO_SIDES = { left: 0, top: 0, right: 0, bottom: 0 };
/** `StyleBoxFlat`'s unset default (`style_box_flat.h:40`): `make_flat_stylebox` never sets the border colour. */
const DEFAULT_BORDER_COLOR: ControlColor = { r: 0.8, g: 0.8, b: 0.8, a: 1 };

/**
 * Recovers `gui/theme/default_theme_scale` from `theme.fontSize`
 * (`Math.round(DEFAULT_FONT_SIZE * scale)`): `NativeTheme` carries its other
 * metrics already rounded, and none of them is 2 or 6. Exact for any scale
 * that is a multiple of 1/16.
 */
function reconstructThemeScale(theme: Pick<NativeTheme, 'fontSize'>): number {
  return theme.fontSize / DEFAULT_FONT_SIZE;
}

/** `make_flat_stylebox` (`default_theme.cpp:57-70`) at ProgressBar's own margin/corner-radius literals. */
function progressBarFlatStyleBox(bgColor: ControlColor, theme: Pick<NativeTheme, 'fontSize'>): StyleBoxFlatData {
  const scale = reconstructThemeScale(theme);
  const margin = Math.round(PROGRESS_BAR_STYLE_MARGIN * scale);
  const cornerRadius = Math.round(PROGRESS_BAR_CORNER_RADIUS * scale);
  // `set_corner_detail(MIN(Math::ceil(1.5 * p_corner_radius), 6) * scale)`
  // (`default_theme.cpp:65`) assigns into an `int` parameter, which truncates
  // toward zero. `MIN(ceil(1.5*6), 6)` is always 6.
  const cornerDetail = Math.trunc(6 * scale);
  return {
    bgColor,
    borderColor: DEFAULT_BORDER_COLOR,
    borderWidth: ZERO_SIDES,
    cornerRadius: { topLeft: cornerRadius, topRight: cornerRadius, bottomRight: cornerRadius, bottomLeft: cornerRadius },
    expandMargin: ZERO_SIDES,
    contentMargin: { left: margin, top: margin, right: margin, bottom: margin },
    drawCenter: true,
    borderBlend: false,
    antiAliased: true,
    aaSize: 1,
    cornerDetail,
    skew: { x: 0, y: 0 },
    shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
    shadowSize: 0,
    shadowOffset: { x: 0, y: 0 },
  };
}

/** `default_theme.cpp:440`: `background` fills with `style_disabled_color` (`theme.styleFill.disabled`). */
export function progressBarDefaultBackground(theme: NativeTheme): StyleBoxFlatData {
  return progressBarFlatStyleBox(theme.styleFill.disabled, theme);
}

/** `default_theme.cpp:441`: `fill` fills with `style_progress_color` (`theme.styleFill.progress`). */
export function progressBarDefaultFill(theme: NativeTheme): StyleBoxFlatData {
  return progressBarFlatStyleBox(theme.styleFill.progress, theme);
}

/** ProgressBar reads `theme_override_font_sizes/font_size` and `theme_override_colors/font_color` (`default_theme.cpp:283,285`). */
export const PROGRESS_BAR_THEME_KEYS: TextThemeKeys = { sizeKey: 'font_size', colorKey: 'font_color' };

/** `SceneStringName(font)` = `"font"` (`default_theme.cpp:283`: `BIND_THEME_ITEM(Theme::DATA_TYPE_FONT, ProgressBar, font)`). */
export const PROGRESS_BAR_THEME_FONT_KEY = 'font';

/** ProgressBar's `font_color` default (`:446`) is `control_font_hover_color` = `Color(0.95, 0.95, 0.95)` (`default_theme.cpp:104`). */
export const PROGRESS_BAR_DEFAULT_FONT_COLOR: ControlColor = { r: 0.95, g: 0.95, b: 0.95, a: 1 };

/** `default_theme.cpp:447`: `font_outline_color` default `Color(0, 0, 0)`. */
export const PROGRESS_BAR_DEFAULT_OUTLINE_COLOR: ControlColor = { r: 0, g: 0, b: 0, a: 1 };

/** `default_theme.cpp:449`: `outline_size` theme constant default `0`. */
export const PROGRESS_BAR_DEFAULT_OUTLINE_SIZE = 0;

/** Resolves the percent label's font size/colour (override, else the ancestor Theme chain, else ProgressBar's own `Color(0.95, 0.95, 0.95)`). */
export function progressBarTextTheme(
  n: SolveNode,
  props: ProgressBarProperties,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  const defaults: TextThemeDefaults = { fontSizePx: ctx.theme.fontSize, color: PROGRESS_BAR_DEFAULT_FONT_COLOR };
  return resolveTextTheme(n, props, PROGRESS_BAR_THEME_KEYS, defaults);
}

/** `theme_override_colors/font_outline_color`, else `Color(0, 0, 0)`. */
export function progressBarOutlineColor(colors: SolveNode['colors']): ControlColor {
  return colors.font_outline_color ?? PROGRESS_BAR_DEFAULT_OUTLINE_COLOR;
}

/** `theme_override_constants/outline_size`, else `0`. */
export function progressBarOutlineSize(constants: SolveNode['constants']): number {
  return constants.outline_size ?? PROGRESS_BAR_DEFAULT_OUTLINE_SIZE;
}

/**
 * `ProgressBar::get_minimum_size` (`progress_bar.cpp:37-48`): the max of the
 * two margin sums (`style_box.cpp`), then with `show_percentage`
 * `MAX(minimum_size.height, background.height + "100%".height)`, else
 * `maxf(1)`. With no `ctx.measureText`, the text adds nothing.
 */
export const progressBarMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as ProgressBarProperties;
  const background = n.styleBoxes.background ?? progressBarDefaultBackground(ctx.theme);
  const fill = n.styleBoxes.fill ?? progressBarDefaultFill(ctx.theme);
  const backgroundMargin = contentMarginSize(background);
  const fillMargin = contentMarginSize(fill);
  let width = Math.max(backgroundMargin.x, fillMargin.x);
  let height = Math.max(backgroundMargin.y, fillMargin.y);

  const showPercentage = props.showPercentage ?? true;
  if (showPercentage && ctx.measureText) {
    const { fontSizePx } = progressBarTextTheme(n, props, ctx);
    const fontMetrics = resolveNodeFontMetrics(n, PROGRESS_BAR_THEME_FONT_KEY);
    const layout = shapeText('100%', {
      fontSizePx,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.OFF,
      lineSpacingPx: 0,
      fontMetrics,
    });
    height = Math.max(height, backgroundMargin.y + layout.heightPx);
  } else if (!showPercentage) {
    width = Math.max(width, 1);
    height = Math.max(height, 1);
  }

  return { x: width, y: height };
};

controlSolverRegistry.registerMinimumSize('ProgressBar', progressBarMinimumSize);

/**
 * The percentage label's ratio (`progress_bar.cpp:149-166`). The fill uses
 * `get_as_ratio()` (`:112`, `rangeRatio`), but the label's `exp_edit` branch
 * adds a `get_value() >= 0` guard (compare `range.cpp:308-325`). Unparsed
 * `allow_greater` and `allow_lesser` stay false, so the clamp is `[0, 1]`.
 */
export function progressBarPercentRatio(props: RangeProperties, orderedKeys: RangeValueOrder): number {
  const min = props.minValue ?? 0;
  const max = props.maxValue ?? 100;
  const value = resolveRangeValue(props, orderedKeys);
  if (isEqualApprox(max, min)) return 1;
  // With `allow_lesser` false, `value >= min` (range.cpp:191-192), so
  // `min >= 0` implies `value >= 0`. The guard stays as Godot writes it.
  if (props.expEdit && min >= 0 && value >= 0) {
    const expMin = min === 0 ? 0 : Math.log2(min);
    const expMax = Math.log2(max);
    const expValue = value === 0 ? 0 : Math.log2(value);
    const percentage = (expValue - expMin) / (expMax - expMin);
    return Math.min(Math.max(percentage, 0), 1);
  }
  const percentage = (value - min) / (max - min);
  return Math.min(Math.max(percentage, 0), 1);
}

// ── Draw-time geometry: fill_mode to the fill StyleBox's rect ──

export const FILL_BEGIN_TO_END = 0;
export const FILL_END_TO_BEGIN = 1;
export const FILL_TOP_TO_BOTTOM = 2;
export const FILL_BOTTOM_TO_TOP = 3;

/**
 * `set_fill_mode`'s `ERR_FAIL_INDEX` (`progress_bar.cpp:199-203`) refuses an
 * out-of-range write, so `mode` keeps its default `FILL_BEGIN_TO_END`
 * (`progress_bar.h:88`) and `fill_mode="99"` draws as that.
 */
function normalizeProgressBarFillMode(fillMode: number | undefined): number {
  const mode = fillMode ?? FILL_BEGIN_TO_END;
  return mode >= FILL_BEGIN_TO_END && mode <= FILL_BOTTOM_TO_TOP ? mode : FILL_BEGIN_TO_END;
}

/** `Rect2::intersects(p_rect, p_include_borders=false)`: touching edges do not count. */
function rectIntersects(a: Rect2, b: Rect2): boolean {
  if (a.x >= b.x + b.w) return false;
  if (a.x + a.w <= b.x) return false;
  if (a.y >= b.y + b.h) return false;
  if (a.y + a.h <= b.y) return false;
  return true;
}

/** `Rect2::intersection`: the all-zero `Rect2()` when the two do not overlap. */
function rectIntersection(a: Rect2, b: Rect2): Rect2 {
  if (!rectIntersects(a, b)) return { x: 0, y: 0, w: 0, h: 0 };
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  return { x, y, w: right - x, h: bottom - y };
}

/**
 * The static indeterminate bar (`progress_bar.cpp:69-110`). The animation
 * advances per process frame (`:52-57`), and its `0.0` start draws an empty
 * intersection, so this always draws the "centre it" frame (`:73-76`), whatever
 * `editor_preview_indeterminate` says. `null` means a zero-area rect.
 */
export function progressBarIndeterminateFillRect(
  size: Vec2,
  fillMode: number | undefined,
  rtl: boolean
): Rect2 | null {
  const mode = normalizeProgressBarFillMode(fillMode);
  const fillSize = Math.min(size.x, size.y) * 2;
  // `:75`: the "centre it" value, recomputed every draw.
  let ifp = Math.max(size.x, size.y) / 2 + fillSize / 2;
  const full: Rect2 = { x: 0, y: 0, w: size.x, h: size.y };

  switch (mode) {
    case FILL_BEGIN_TO_END:
    case FILL_END_TO_BEGIN: {
      // `rtl` swaps the two horizontal modes (`:82`), not the band's position.
      const rightToLeft = mode === (rtl ? FILL_BEGIN_TO_END : FILL_END_TO_BEGIN);
      if (ifp > size.x + fillSize) ifp = rightToLeft ? -fillSize : 0;
      const x = rightToLeft ? size.x - ifp : ifp - fillSize;
      return clampToZeroArea(rectIntersection({ x, y: 0, w: fillSize, h: size.y }, full));
    }
    case FILL_TOP_TO_BOTTOM: {
      if (ifp > size.y + fillSize) ifp = 0;
      return clampToZeroArea(rectIntersection({ x: 0, y: ifp - fillSize, w: size.x, h: fillSize }, full));
    }
    case FILL_BOTTOM_TO_TOP: {
      if (ifp > size.y + fillSize) ifp = -fillSize;
      return clampToZeroArea(rectIntersection({ x: 0, y: size.y - ifp, w: size.x, h: fillSize }, full));
    }
    default:
      return null;
  }
}

function clampToZeroArea(rect: Rect2): Rect2 | null {
  return rect.w > 0 && rect.h > 0 ? rect : null;
}

/**
 * The determinate fill StyleBox's rect (`progress_bar.cpp:112-147`), `null`
 * when `p <= 0`. `fillMinimumSize` is `contentMarginSize(fillStyleBox)`, read
 * on the fill axis. `rtl` swaps the two horizontal modes (`:121`), and the
 * vertical modes ignore it.
 */
export function progressBarFillRect(
  size: Vec2,
  fillMode: number | undefined,
  ratio: number,
  fillMinimumSize: Vec2,
  rtl: boolean
): Rect2 | null {
  const mode = normalizeProgressBarFillMode(fillMode);
  switch (mode) {
    case FILL_BEGIN_TO_END:
    case FILL_END_TO_BEGIN: {
      const mp = fillMinimumSize.x;
      const p = Math.round(ratio * (size.x - mp));
      const rightToLeft = mode === (rtl ? FILL_BEGIN_TO_END : FILL_END_TO_BEGIN);
      if (p <= 0) return null;
      if (rightToLeft) {
        const pRemaining = Math.round((1 - ratio) * (size.x - mp));
        return { x: pRemaining, y: 0, w: p + mp, h: size.y };
      }
      return { x: 0, y: 0, w: p + mp, h: size.y };
    }
    case FILL_TOP_TO_BOTTOM:
    case FILL_BOTTOM_TO_TOP: {
      const mp = fillMinimumSize.y;
      const p = Math.round(ratio * (size.y - mp));
      if (p <= 0) return null;
      if (mode === FILL_TOP_TO_BOTTOM) {
        return { x: 0, y: 0, w: size.x, h: p + mp };
      }
      const pRemaining = Math.round((1 - ratio) * (size.y - mp));
      return { x: 0, y: pRemaining, w: size.x, h: p + mp };
    }
    default:
      return null;
  }
}
