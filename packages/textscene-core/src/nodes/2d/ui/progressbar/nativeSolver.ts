/**
 * ProgressBar's native (WebGL canvas) rect solver (`scene/gui/progress_bar.cpp:37-48`) and draw
 * geometry. The `background` and `fill` StyleBoxes come from the theme lookup, which ends at the
 * default theme table, so the minimum size and the drawn box read the same boxes.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { controlSolverRegistry, type MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { Rect2 } from '../../../../godot/math/rect2';
import { contentMarginSize } from '../../../../r3f/controls/native/styleBoxFlat';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import {
  resolveTextTheme,
  type ResolvedTextTheme,
  type TextThemeKeys,
} from '../../../../r3f/controls/native/textTheme';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { shapeText } from '../../../../r3f/controls/native/text/textLayout';
import { resolveRangeValue, type RangeProperties, type RangeValueOrder } from '../shared/range';
import { rect2Intersection } from '../../../../godot/math/rect2.js';
import type { ProgressBarProperties } from './types';
import type { Vector2 } from '../../../../godot/math/vector.js';
import { isEqualApprox } from '../../../../godot/math/math.js';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { formatControlPercent, type Numerals } from '../../../../godot/text/numberFormat';
import { ProgressBarFillMode } from '../../../../godot/scene/gui';

/** ProgressBar reads `theme_override_font_sizes/font_size` and `theme_override_colors/font_color`. */
const PROGRESS_BAR_THEME_KEYS: TextThemeKeys = { sizeKey: 'font_size', colorKey: 'font_color' };

/** `SceneStringName(font)` = `"font"`, which the default theme registers under ProgressBar. */
export const PROGRESS_BAR_THEME_FONT_KEY = 'font';

/** Resolves the percent label's font size and colour: the override, else the ancestor Theme chain, else the default theme table. */
export function progressBarTextTheme(n: SolveNode, props: ProgressBarProperties): ResolvedTextTheme {
  return resolveTextTheme(n, props, PROGRESS_BAR_THEME_KEYS);
}

/**
 * `ProgressBar::get_minimum_size` (`progress_bar.cpp:37-48`): the max of the
 * two margin sums (`style_box.cpp`), then with `show_percentage`
 * `MAX(minimum_size.height, background.height + "100%".height)`, else
 * `maxf(1)`. With no `ctx.measureText`, the text adds nothing.
 */
const progressBarMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as ProgressBarProperties;
  const backgroundMargin = contentMarginSize(requiredThemeItem(n.styleBoxes, 'background'));
  const fillMargin = contentMarginSize(requiredThemeItem(n.styleBoxes, 'fill'));
  let width = Math.max(backgroundMargin.x, fillMargin.x);
  let height = Math.max(backgroundMargin.y, fillMargin.y);

  const showPercentage = props.showPercentage ?? true;
  if (showPercentage && ctx.measureText) {
    const { fontSizePx } = progressBarTextTheme(n, props);
    const fontMetrics = resolveNodeFontMetrics(n, PROGRESS_BAR_THEME_FONT_KEY);
    const layout = shapeText('100%', {
      fontSizePx,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.AUTOWRAP_OFF,
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

/** The label's text: the rounded percentage of `ratio`, with the digits and percent sign of `numerals` (`progress_bar.cpp:168-174`). */
export function progressBarPercentText(ratio: number, numerals: Numerals): string {
  return formatControlPercent(String(Math.round(ratio * 100)), numerals);
}

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

/**
 * `set_fill_mode`'s `ERR_FAIL_INDEX` (`progress_bar.cpp:199-203`) refuses an
 * out-of-range write, so `mode` keeps its default `FILL_BEGIN_TO_END`
 * (`progress_bar.h:88`) and `fill_mode="99"` draws as that.
 */
function normalizeProgressBarFillMode(fillMode: number | undefined): number {
  const mode = fillMode ?? ProgressBarFillMode.BEGIN_TO_END;
  return mode >= ProgressBarFillMode.BEGIN_TO_END && mode <= ProgressBarFillMode.BOTTOM_TO_TOP
    ? mode
    : ProgressBarFillMode.BEGIN_TO_END;
}

/**
 * The static indeterminate bar (`progress_bar.cpp:69-110`). The animation
 * advances per process frame (`:52-57`), and its `0.0` start draws an empty
 * intersection, so this always draws the "centre it" frame (`:73-76`), whatever
 * `editor_preview_indeterminate` says. `null` means a zero-area rect.
 */
export function progressBarIndeterminateFillRect(
  size: Vector2,
  fillMode: number | undefined,
  rtl: boolean
): Rect2 | null {
  const mode = normalizeProgressBarFillMode(fillMode);
  const fillSize = Math.min(size.x, size.y) * 2;
  // `:75`: the "centre it" value, recomputed every draw.
  let ifp = Math.max(size.x, size.y) / 2 + fillSize / 2;
  const full: Rect2 = { x: 0, y: 0, w: size.x, h: size.y };

  switch (mode) {
    case ProgressBarFillMode.BEGIN_TO_END:
    case ProgressBarFillMode.END_TO_BEGIN: {
      // `rtl` swaps the two horizontal modes (`:82`), not the band's position.
      const rightToLeft =
        mode === (rtl ? ProgressBarFillMode.BEGIN_TO_END : ProgressBarFillMode.END_TO_BEGIN);
      if (ifp > size.x + fillSize) ifp = rightToLeft ? -fillSize : 0;
      const x = rightToLeft ? size.x - ifp : ifp - fillSize;
      return clampToZeroArea(rect2Intersection({ x, y: 0, w: fillSize, h: size.y }, full));
    }
    case ProgressBarFillMode.TOP_TO_BOTTOM: {
      if (ifp > size.y + fillSize) ifp = 0;
      return clampToZeroArea(rect2Intersection({ x: 0, y: ifp - fillSize, w: size.x, h: fillSize }, full));
    }
    case ProgressBarFillMode.BOTTOM_TO_TOP: {
      if (ifp > size.y + fillSize) ifp = -fillSize;
      return clampToZeroArea(rect2Intersection({ x: 0, y: size.y - ifp, w: size.x, h: fillSize }, full));
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
  size: Vector2,
  fillMode: number | undefined,
  ratio: number,
  fillMinimumSize: Vector2,
  rtl: boolean
): Rect2 | null {
  const mode = normalizeProgressBarFillMode(fillMode);
  switch (mode) {
    case ProgressBarFillMode.BEGIN_TO_END:
    case ProgressBarFillMode.END_TO_BEGIN: {
      const mp = fillMinimumSize.x;
      const p = Math.round(ratio * (size.x - mp));
      const rightToLeft =
        mode === (rtl ? ProgressBarFillMode.BEGIN_TO_END : ProgressBarFillMode.END_TO_BEGIN);
      if (p <= 0) return null;
      if (rightToLeft) {
        const pRemaining = Math.round((1 - ratio) * (size.x - mp));
        return { x: pRemaining, y: 0, w: p + mp, h: size.y };
      }
      return { x: 0, y: 0, w: p + mp, h: size.y };
    }
    case ProgressBarFillMode.TOP_TO_BOTTOM:
    case ProgressBarFillMode.BOTTOM_TO_TOP: {
      const mp = fillMinimumSize.y;
      const p = Math.round(ratio * (size.y - mp));
      if (p <= 0) return null;
      if (mode === ProgressBarFillMode.TOP_TO_BOTTOM) {
        return { x: 0, y: 0, w: size.x, h: p + mp };
      }
      const pRemaining = Math.round((1 - ratio) * (size.y - mp));
      return { x: 0, y: pRemaining, w: size.x, h: p + mp };
    }
    default:
      return null;
  }
}
