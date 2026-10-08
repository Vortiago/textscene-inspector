/**
 * `GeometryInstance3D.visibility_range_*`, as the scene cull and the Forward+ renderer apply it:
 * whether the instance draws at a camera distance, and the alpha a SELF fade gives it. The distance
 * is from the camera origin to the centre of the instance's world AABB (`renderer_scene_cull.cpp:1851`).
 */

import { smoothstep } from './math.js';

/** `RS::VisibilityRangeFadeMode` (`rendering_server.h:1501-1505`), as a `.tscn` stores it. */
export enum VisibilityRangeFadeMode {
  DISABLED = 0,
  SELF = 1,
  DEPENDENCIES = 2,
}

/** Each `VisibilityRangeFadeMode` name by its integer, as a validator names it. */
export const VISIBILITY_RANGE_FADE_MODE_NAMES: Readonly<Record<number, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(VisibilityRangeFadeMode)
      .filter(([, value]) => typeof value === 'number')
      .map(([name, value]) => [value, name])
  )
);

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

/** What the range makes of the instance at one camera distance. */
export interface VisibilityAtDistance {
  /** Whether it draws. The next check reads it back, since a DISABLED range keeps its state. */
  visible: boolean;
  /** The SELF fade alpha, before `transparency` multiplies in; 1 outside the margins. */
  fade: number;
}

/** Whether the range limits anything: `renderer_scene_cull.cpp:1458` range-checks only then. */
export function hasVisibilityRange(range: VisibilityRange): boolean {
  return range.begin > 0 || range.end > 0;
}

const DRAWN: Readonly<VisibilityAtDistance> = Object.freeze({ visible: true, fade: 1 });
const CULLED: Readonly<VisibilityAtDistance> = Object.freeze({ visible: false, fade: 1 });

/**
 * The range at `distance`, for an instance that drew last frame when `wasVisible`. Only a
 * DISABLED range has hysteresis: a drawn instance holds until the outer edge of a margin and a
 * hidden one waits for the inner edge (`renderer_scene_cull.cpp:2759-2797`). The other modes
 * always cull at the outer edges, and SELF fades across the margins.
 */
export function visibilityRangeAt(
  range: VisibilityRange,
  distance: number,
  wasVisible: boolean
): VisibilityAtDistance {
  if (!hasVisibilityRange(range)) return DRAWN;

  const holdsState = range.fadeMode === VisibilityRangeFadeMode.DISABLED && !wasVisible;
  const beginOffset = holdsState ? range.beginMargin : -range.beginMargin;
  const endOffset = holdsState ? -range.endMargin : range.endMargin;
  if (range.end > 0 && distance > range.end + endOffset) return CULLED;
  if (range.begin > 0 && distance < range.begin + beginOffset) return CULLED;

  if (range.fadeMode !== VisibilityRangeFadeMode.SELF) return DRAWN;
  return { visible: true, fade: selfFade(range, distance) };
}

/**
 * The SELF fade over the margins that `set_fade_range` receives (`renderer_scene_cull.cpp:1483-1491`),
 * as `_fill_instance_data` eases it (`render_forward_clustered.cpp:969-977`). The far margin wins.
 */
function selfFade(range: VisibilityRange, distance: number): number {
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
