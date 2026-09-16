/**
 * ProgressBar's native (WebGL canvas) rect solver — `ProgressBar::get_minimum_size`
 * (`scene/gui/progress_bar.cpp:37-48`) plus the default `background`/`fill`
 * StyleBoxes (`scene/theme/default_theme.cpp:438-449`) neither
 * `nativeTheme.ts` nor `shared/` carries, since ProgressBar is the only
 * widget in this codebase whose default flat-stylebox margin/corner-radius
 * literal (2px/6px) differs from `default_margin`/`default_corner_radius`
 * (4px/3px). Registered via `controlSolverRegistry.registerMinimumSize`.
 * `Component.tsx` imports the same builder for painting, so the box a
 * default-themed bar is floored to and the box it draws can never disagree.
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
 * `default_theme.cpp:440-441` —
 * `make_flat_stylebox(color, 2, 2, 2, 2, 6)`, a DIFFERENT margin/corner-radius
 * literal from every other flat stylebox this codebase's `nativeTheme.ts`
 * builds (`default_margin` = 4, `default_corner_radius` = 3).
 */
const PROGRESS_BAR_STYLE_MARGIN = 2;
const PROGRESS_BAR_CORNER_RADIUS = 6;

const ZERO_SIDES = { left: 0, top: 0, right: 0, bottom: 0 };
/** `StyleBoxFlat`'s own unset default (`style_box_flat.h:40`) — `make_flat_stylebox` never touches border colour. */
const DEFAULT_BORDER_COLOR: ControlColor = { r: 0.8, g: 0.8, b: 0.8, a: 1 };

/**
 * Reconstructs the project's `gui/theme/default_theme_scale` from `theme.fontSize`
 * (`Math.round(DEFAULT_FONT_SIZE * scale)`, `godotDefaultTheme.ts`'s
 * `scaledGodotTheme`). `NativeTheme`/`SolveContext` carry every OTHER
 * scale-dependent metric already rounded to Godot's own literals
 * (`default_margin`=4, `default_corner_radius`=3, …), none of which is 2 or 6
 * — `nativeTheme.ts` is out of bounds to extend, so this is the one place in
 * this codebase that needs the raw scale back out of an already-rounded
 * theme, rather than a fresh scale-dependent constant living beside its
 * siblings. Exact for any scale that is a multiple of 1/16 (every practically
 * authored scale — 0.5, 0.75, 1.25, 1.5, 2, …); `round(16s)` only loses
 * precision at a scale finer than that.
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
  // toward zero — not `Math.round`. `MIN(ceil(1.5*6), 6)` is always exactly 6.
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

/** `default_theme.cpp:440` — `background` fills with `style_disabled_color` (`theme.styleFill.disabled`, `nativeTheme.ts`'s own transcription). */
export function progressBarDefaultBackground(theme: NativeTheme): StyleBoxFlatData {
  return progressBarFlatStyleBox(theme.styleFill.disabled, theme);
}

/** `default_theme.cpp:441` — `fill` fills with `style_progress_color` (`theme.styleFill.progress`). */
export function progressBarDefaultFill(theme: NativeTheme): StyleBoxFlatData {
  return progressBarFlatStyleBox(theme.styleFill.progress, theme);
}

/** ProgressBar reads `theme_override_font_sizes/font_size` and `theme_override_colors/font_color` (`default_theme.cpp:283,285`). */
export const PROGRESS_BAR_THEME_KEYS: TextThemeKeys = { sizeKey: 'font_size', colorKey: 'font_color' };

/** `SceneStringName(font)` = `"font"` (`default_theme.cpp:283`: `BIND_THEME_ITEM(Theme::DATA_TYPE_FONT, ProgressBar, font)`). */
export const PROGRESS_BAR_THEME_FONT_KEY = 'font';

/** `control_font_hover_color` = `Color(0.95, 0.95, 0.95)` (`default_theme.cpp:104`) — ProgressBar's own `font_color` default (`:446`). */
export const PROGRESS_BAR_DEFAULT_FONT_COLOR: ControlColor = { r: 0.95, g: 0.95, b: 0.95, a: 1 };

/** `default_theme.cpp:447` — `font_outline_color` default `Color(0, 0, 0)`. */
export const PROGRESS_BAR_DEFAULT_OUTLINE_COLOR: ControlColor = { r: 0, g: 0, b: 0, a: 1 };

/** `default_theme.cpp:449` — `outline_size` theme constant default `0`. */
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
 * `ProgressBar::get_minimum_size` (`progress_bar.cpp:37-48`):
 *
 *     Size2 minimum_size = theme_cache.background_style->get_minimum_size();
 *     minimum_size = minimum_size.max(theme_cache.fill_style->get_minimum_size());
 *     if (show_percentage) {
 *       ... minimum_size.height = MAX(minimum_size.height, background.height + "100%".height);
 *     } else {
 *       minimum_size = minimum_size.maxf(1);
 *     }
 *
 * `get_minimum_size()` for a flat StyleBox is its own content-margin sum
 * (`StyleBox::get_minimum_size`, `style_box.cpp`), which is IDENTICAL for
 * `background`/`fill` at their default literals (both `make_flat_stylebox(...,
 * 2, 2, 2, 2, 6)`) but can diverge once either carries a
 * `theme_override_styles/background`/`fill` of its own.
 *
 * An absent `ctx.measureText` is treated as "the percentage text contributes
 * nothing" (`solverRegistry.ts`'s own contract, `button/nativeSolver.ts`'s
 * `buttonMinimumSize` doc) — the margin floor still applies either way, and
 * `show_percentage`'s `else` branch (the plain `maxf(1)` floor) is unaffected
 * since it reads no text metric at all.
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

// --- The percentage text's own ratio (progress_bar.cpp:149-166) ---
// The FILL bar's own ratio is `float r = get_as_ratio();` (`:112`) —
// `shared/range.ts`'s `rangeRatio` verbatim; `Component.tsx` imports it
// directly, the same way `hslider`'s `resolveSliderRatio` does.

/**
 * The percentage LABEL's own ratio (`progress_bar.cpp:149-166`) — separately
 * computed by Godot rather than reusing `get_as_ratio()`, and NOT quite the
 * same formula: the `exp_edit` branch adds `get_value() >= 0` on top of
 * `min() >= 0`, a guard `Range::get_as_ratio()` itself does not carry
 * (compare `range.cpp:308-325`). `allow_greater`/`allow_lesser` gate the
 * `CLAMP` calls in the source but are never parsed by this codebase
 * (`shared/range.ts`'s own doc), so both collapse to their `false` default
 * and this clamps to plain `[0, 1]` either way. That same `allow_lesser =
 * false` also makes the `value >= 0` guard unreachable-as-false whenever
 * `min >= 0`: `resolveRangeValue` re-clamps `value` to `>= min` on every
 * setter it replays (`range.cpp:191-192`'s `!allow_lesser` gate, mirrored by
 * `calcValue`), so `min >= 0` already implies `value >= 0`. Kept anyway,
 * transcribed as written, since a future `allow_lesser` port would need it.
 */
export function progressBarPercentRatio(props: RangeProperties, orderedKeys: RangeValueOrder): number {
  const min = props.minValue ?? 0;
  const max = props.maxValue ?? 100;
  const value = resolveRangeValue(props, orderedKeys);
  if (isEqualApprox(max, min)) return 1;
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

// --- Draw-time geometry: fill_mode -> the fill StyleBox's own rect --------

export const FILL_BEGIN_TO_END = 0;
export const FILL_END_TO_BEGIN = 1;
export const FILL_TOP_TO_BOTTOM = 2;
export const FILL_BOTTOM_TO_TOP = 3;

/**
 * `set_fill_mode` (`progress_bar.cpp:199-203`) `ERR_FAIL_INDEX` REFUSES an
 * out-of-range write, so the stored `mode` keeps its class default
 * (`FILL_BEGIN_TO_END`, `progress_bar.h:88`) rather than becoming an invalid
 * enum value — an authored `fill_mode="99"` therefore draws
 * `FILL_BEGIN_TO_END`, not nothing.
 */
function normalizeProgressBarFillMode(fillMode: number | undefined): number {
  const mode = fillMode ?? FILL_BEGIN_TO_END;
  return mode >= FILL_BEGIN_TO_END && mode <= FILL_BOTTOM_TO_TOP ? mode : FILL_BEGIN_TO_END;
}

/** `Rect2::intersects(p_rect, p_include_borders=false)` — edges touching only does not count. */
function rectIntersects(a: Rect2, b: Rect2): boolean {
  if (a.x >= b.x + b.w) return false;
  if (a.x + a.w <= b.x) return false;
  if (a.y >= b.y + b.h) return false;
  if (a.y + a.h <= b.y) return false;
  return true;
}

/** `Rect2::intersection` — the empty `Rect2()` (all-zero) when the two do not overlap. */
function rectIntersection(a: Rect2, b: Rect2): Rect2 {
  if (!rectIntersects(a, b)) return { x: 0, y: 0, w: 0, h: 0 };
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  return { x, y, w: right - x, h: bottom - y };
}

/**
 * The static indeterminate bar (`progress_bar.cpp:69-110`): Godot's
 * `_indeterminate_fill_progress` advances every process frame
 * (`NOTIFICATION_INTERNAL_PROCESS`, `:52-57`), which a static previewer never
 * runs. The ONE frame Godot itself special-cases is the "centre it" branch
 * (`:73-76`, `is_part_of_edited_scene() && !editor_preview_indeterminate`) —
 * every OTHER frame, including `_indeterminate_fill_progress`'s own `0.0`
 * initial value, draws an EMPTY `intersection` (the fill rect starts exactly
 * at the control's own edge and extends outward). This previewer therefore
 * always draws the centred bar, whatever `editor_preview_indeterminate`
 * says: it is the one frame of the animation that is not simply "nothing".
 *
 * An out-of-range `fill_mode` never reaches `mode` (`normalizeProgressBarFillMode`
 * — the setter refuses the write), so it draws as `FILL_BEGIN_TO_END`. `null`
 * only for a zero-area result — a `draw_style_box` at a zero-size rect draws
 * nothing observable.
 */
export function progressBarIndeterminateFillRect(size: Vec2, fillMode: number | undefined): Rect2 | null {
  const mode = normalizeProgressBarFillMode(fillMode);
  const fillSize = Math.min(size.x, size.y) * 2;
  // `:75` — the "centre it" value, recomputed fresh every draw in this
  // previewer (there is no persisted `_indeterminate_fill_progress` to
  // animate away from).
  let ifp = Math.max(size.x, size.y) / 2 + fillSize / 2;
  const full: Rect2 = { x: 0, y: 0, w: size.x, h: size.y };

  switch (mode) {
    case FILL_BEGIN_TO_END:
    case FILL_END_TO_BEGIN: {
      // `is_layout_rtl()` is always false in this previewer (LTR-only).
      const rightToLeft = mode === FILL_END_TO_BEGIN;
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
 * The determinate fill StyleBox's own rect (`progress_bar.cpp:112-147`),
 * `null` when nothing should draw (`p <= 0`). An out-of-range `fill_mode`
 * normalizes to `FILL_BEGIN_TO_END` (`normalizeProgressBarFillMode`), it never
 * reaches `mode` as-is. `fillMinimumSize` is
 * `theme_cache.fill_style->get_minimum_size()` on the FILL axis only —
 * `contentMarginSize(fillStyleBox)`'s `.x`/`.y`.
 */
export function progressBarFillRect(
  size: Vec2,
  fillMode: number | undefined,
  ratio: number,
  fillMinimumSize: Vec2
): Rect2 | null {
  const mode = normalizeProgressBarFillMode(fillMode);
  switch (mode) {
    case FILL_BEGIN_TO_END:
    case FILL_END_TO_BEGIN: {
      const mp = fillMinimumSize.x;
      const p = Math.round(ratio * (size.x - mp));
      // `is_layout_rtl()` is always false in this previewer (LTR-only).
      const rightToLeft = mode === FILL_END_TO_BEGIN;
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
