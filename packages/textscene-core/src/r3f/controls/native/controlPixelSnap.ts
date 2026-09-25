/**
 * Godot's whole-pixel snap for a Control's drawn transform, from `_update_canvas_item_transform`
 * (`controlPixelSnap.md` quotes it). It lands on the canvas item, never on the rect, so the layout
 * never reads a rounded number. Each CanvasItem snaps its own parent-relative transform, as the
 * nested groups here do. Godot pixels, +Y down: the caller negates Y (`rect.ts`).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { boolSlotValue } from '../../../godot/index.js';
import type { ProjectSettings } from '../../../parser/projectSettingsParser.js';
import type { Vec2 } from './rect';

/** `gui/common/snap_controls_to_pixels`, addressed the way Godot addresses it. */
export const SNAP_CONTROLS_TO_PIXELS_SETTING = 'gui/common/snap_controls_to_pixels';

/**
 * `Control::_update_canvas_item_transform`'s rotation tolerance, verbatim:
 * `Math::abs(Math::sin(data.rotation * 4.0f)) < 0.00001f`. `sin(rotation * 4)` vanishes only at
 * multiples of 45°, so any other angle draws unsnapped.
 */
const SNAP_ROTATION_EPSILON = 0.00001;

/**
 * Whether the project enables the snap. It defaults on
 * (`core/config/project_settings.cpp:1808`), and only the `GLOBAL_GET` read in
 * `main/main.cpp:4577-4578` turns it off.
 */
export function snapControlsToPixelsEnabled(settings: ProjectSettings | null): boolean {
  // `_GLOBAL_DEF` keeps the type the file wrote (`project_settings.cpp:1320-1325`),
  // so the read is `!is_zero()` (`variant_op.cpp:1114-1122`): `=0` disables it as
  // `=false` does. A missing, empty or unconvertible value keeps the default.
  return boolSlotValue(settings?.[SNAP_CONTROLS_TO_PIXELS_SETTING]) !== false;
}

/**
 * A Control's pivot, rotation and scale after a Container's reset:
 * `Container::fit_child_in_rect` ends with `set_rotation(0)` and
 * `set_scale(Vector2(1, 1))`, and the gate and the origin see the effective values.
 */
export interface ControlDrawTransform {
  /** Radians, Godot's `data.rotation`. */
  rotation: number;
  scale: Vec2;
  /** `Control::get_combined_pivot_offset()`: `pivot_offset + pivot_offset_ratio * size`. */
  pivot: Vec2;
}

/**
 * The translation column of `Control::_get_internal_transform()` (`control.cpp:720-725`):
 * the pivot as origin, then `translate_local(-pivot)`, leaves `pivot - basis * pivot`.
 * With zero skew the basis columns are `(cos r, sin r) * scale.x` and
 * `(-sin r, cos r) * scale.y`. Zero for an unrotated, unscaled Control.
 */
export function internalTransformTranslation(transform: ControlDrawTransform): Vec2 {
  const { rotation, scale, pivot } = transform;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const basisX = cos * scale.x * pivot.x - sin * scale.y * pivot.y;
  const basisY = sin * scale.x * pivot.x + cos * scale.y * pivot.y;
  return { x: pivot.x - basisX, y: pivot.y - basisY };
}

/**
 * The outer placement's origin for a solved, parent-relative rect position. The
 * snap applies to the sum with the internal translation, so this returns that
 * snapped sum less the internal part: `floor(position + 0.5)` for an identity basis.
 */
export function snappedControlOrigin(
  position: Vec2,
  transform: ControlDrawTransform,
  snapEnabled: boolean
): Vec2 {
  // `is_inside_tree()` holds for all that renders. A non-finite rotation fails the
  // `<` and does not snap, as in Godot.
  if (!snapEnabled || !(Math.abs(Math.sin(transform.rotation * 4)) < SNAP_ROTATION_EPSILON)) {
    return { x: position.x, y: position.y };
  }

  const internal = internalTransformTranslation(transform);
  return {
    x: Math.floor(position.x + internal.x + 0.5) - internal.x,
    y: Math.floor(position.y + internal.y + 0.5) - internal.y,
  };
}
