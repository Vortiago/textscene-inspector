/**
 * `GeometryInstance3D.visibility_range_*`, as the scene cull and the Forward+ renderer apply it:
 * where the camera distance falls in the range, and the alpha a SELF fade gives the instance. The
 * distance is from the camera origin to the centre of the instance's world AABB
 * (`renderer_scene_cull.cpp:1851`).
 */

import { enumNamesByValue } from './enumNames.js';
import { smoothstep } from './math.js';

/** `RS::VisibilityRangeFadeMode` (`rendering_server.h:1501-1505`), as a `.tscn` stores it. */
export enum VisibilityRangeFadeMode {
  DISABLED = 0,
  SELF = 1,
  DEPENDENCIES = 2,
}

/** Each `VisibilityRangeFadeMode` name by its integer, as a validator names it. */
export const VISIBILITY_RANGE_FADE_MODE_NAMES = enumNamesByValue(VisibilityRangeFadeMode);

/** The five `visibility_range_*` properties. A `begin` or `end` of 0 is no limit on that side. */
export interface VisibilityRange {
  begin: number;
  beginMargin: number;
  end: number;
  endMargin: number;
  fadeMode: VisibilityRangeFadeMode;
}

/** Godot's defaults (`visual_instance_3d.h:126-130`): no range, so the instance always draws. */
export const NO_VISIBILITY_RANGE: Readonly<VisibilityRange> = Object.freeze({
  begin: 0,
  beginMargin: 0,
  end: 0,
  endMargin: 0,
  fadeMode: VisibilityRangeFadeMode.DISABLED,
});

/** Whether the range limits anything: `renderer_scene_cull.cpp:1458` range-checks only then. */
export function hasVisibilityRange(range: VisibilityRange): boolean {
  return range.begin > 0 || range.end > 0;
}

/** `_visibility_range_check`'s return value (`renderer_scene_cull.cpp:2759-2797`). */
export enum RangeCheck {
  BEYOND_END = -1,
  IN_RANGE = 0,
  SHORT_OF_BEGIN = 1,
  /** Inside a margin of a SELF or DEPENDENCIES range, where the dependants show. */
  IN_FADE_MARGIN = 2,
}

interface RangeCheckResult {
  check: RangeCheck;
  /**
   * The alpha the instance gives its visibility dependants inside a DEPENDENCIES margin, linear
   * across both edges of the margin. 1 everywhere else.
   */
  childrenFade: number;
}

/**
 * The range at `distance`, for an instance this camera last saw drawn when `wasVisible`. Only a
 * DISABLED range has hysteresis: a drawn instance holds until the outer edge of a margin and a
 * hidden one waits for the inner edge. The other modes cull at the outer edges. The instance
 * draws for this camera afterwards exactly when the check is IN_RANGE or IN_FADE_MARGIN.
 */
export function checkVisibilityRange(
  range: VisibilityRange,
  distance: number,
  wasVisible: boolean
): RangeCheckResult {
  const isFlipped = range.fadeMode === VisibilityRangeFadeMode.DISABLED && !wasVisible;
  const beginOffset = isFlipped ? range.beginMargin : -range.beginMargin;
  const endOffset = isFlipped ? -range.endMargin : range.endMargin;
  if (range.end > 0 && distance > range.end + endOffset) return checked(RangeCheck.BEYOND_END);
  if (range.begin > 0 && distance < range.begin + beginOffset) return checked(RangeCheck.SHORT_OF_BEGIN);
  if (range.fadeMode === VisibilityRangeFadeMode.DISABLED) return checked(RangeCheck.IN_RANGE);

  const fadesDependants = range.fadeMode === VisibilityRangeFadeMode.DEPENDENCIES;
  if (range.end > 0 && distance > range.end - endOffset) {
    const fade = (distance - (range.end - endOffset)) / (2 * range.endMargin);
    return { check: RangeCheck.IN_FADE_MARGIN, childrenFade: fadesDependants ? Math.min(1, fade) : 1 };
  }
  if (range.begin > 0 && distance < range.begin - beginOffset) {
    const fade = 1 - (distance - (range.begin + beginOffset)) / (2 * range.beginMargin);
    return { check: RangeCheck.IN_FADE_MARGIN, childrenFade: fadesDependants ? Math.min(1, fade) : 1 };
  }
  return checked(RangeCheck.IN_RANGE);
}

function checked(check: RangeCheck): RangeCheckResult {
  return { check, childrenFade: 1 };
}

/**
 * The SELF fade over the margins that `set_fade_range` receives (`renderer_scene_cull.cpp:1483-1491`),
 * as `_fill_instance_data` eases it (`render_forward_clustered.cpp:969-977`). The far margin wins.
 */
export function selfFade(range: VisibilityRange, distance: number): number {
  const farBegin = range.end - range.endMargin;
  if (range.end > 0 && distance > farBegin) {
    const farEnd = range.end + range.endMargin;
    return smoothstep(0, 1, 1 - (distance - farBegin) / (farEnd - farBegin));
  }
  const nearEnd = range.begin + range.beginMargin;
  if (range.begin > 0 && distance < nearEnd) {
    const nearBegin = range.begin - range.beginMargin;
    return smoothstep(0, 1, (distance - nearBegin) / (nearEnd - nearBegin));
  }
  return 1;
}
