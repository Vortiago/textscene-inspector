/**
 * Godot's whole-pixel snap for a Control's DRAWN transform.
 *
 * `scene/gui/control.cpp`, `Control::_update_canvas_item_transform()`:
 *
 *     Transform2D xform = _get_internal_transform();
 *     xform[2] += get_position();
 *     if (is_inside_tree() && Math::abs(Math::sin(data.rotation * 4.0f)) < 0.00001f
 *             && get_viewport()->is_snap_controls_to_pixels_enabled()) {
 *         xform[2] = (xform[2] + Vector2(0.5, 0.5)).floor();
 *     }
 *
 * Three facts that shape this module:
 *
 * 1. The snap lands on the CANVAS ITEM, never on the rect. `get_rect()` keeps
 *    full precision, and the layout arithmetic above it — anchor resolution,
 *    the minimum-size floor's `GROW_DIRECTION_BOTH` halving
 *    (`control.cpp:1789-1797`) — runs on that unsnapped value. Snapping the
 *    solved rect instead would feed rounded numbers back into the solve.
 * 2. It snaps the translation of the COMPOSITE transform — the internal
 *    pivot/rotation/scale transform's own translation column PLUS the
 *    position — not the position alone. Measured against Godot 4.6.3: a
 *    ColorRect at position (100, 100) with `pivot_offset = (10.25, 10.25)`
 *    and `scale = (2, 2)` draws its top-left at exactly 90, i.e.
 *    `floor(100 + (10.25 - 20.5) + 0.5)`, with no half-pixel blend — not at
 *    the 89.75 a position-only snap would leave.
 * 3. The rotation gate is load-bearing. `sin(rotation * 4)` vanishes only at
 *    multiples of 45°, so a Control at any other angle is drawn UNSNAPPED.
 *
 * The transform is parent-relative, exactly like the rect: Godot snaps each
 * CanvasItem's own transform independently, so a Control under a fractionally
 * placed parent still draws at a fractional absolute position. Nested groups
 * reproduce that without any accumulation here.
 *
 * Pure data + functions, no React, no THREE. Godot pixels, +Y down — the
 * caller negates Y once, after this module is done (`rect.ts`'s convention).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { ProjectSettings } from '../../../parser/projectSettingsParser.js';
import type { Vec2 } from './rect';

/** `gui/common/snap_controls_to_pixels`, addressed the way Godot addresses it. */
export const SNAP_CONTROLS_TO_PIXELS_SETTING = 'gui/common/snap_controls_to_pixels';

/**
 * `Control::_update_canvas_item_transform`'s rotation tolerance, verbatim:
 * `Math::abs(Math::sin(data.rotation * 4.0f)) < 0.00001f`.
 */
const SNAP_ROTATION_EPSILON = 0.00001;

/**
 * Whether the project enables the snap.
 *
 * `core/config/project_settings.cpp:1808`:
 *
 *     GLOBAL_DEF_BASIC("gui/common/snap_controls_to_pixels", true);
 *
 * so the default is ON, and `main/main.cpp`'s
 * `sml->get_root()->set_snap_controls_to_pixels(GLOBAL_GET(…))` is the only
 * thing that ever turns it off. Godot writes the bool unquoted, so the sole
 * disabling form is the literal `false`; a missing key, an empty value or
 * anything else keeps Godot's default rather than inventing a third state.
 */
export function snapControlsToPixelsEnabled(settings: ProjectSettings | null): boolean {
  return settings?.[SNAP_CONTROLS_TO_PIXELS_SETTING]?.trim() !== 'false';
}

/**
 * A Control's own pivot/rotation/scale, AFTER a Container's reset — a
 * container child's transform is not its authored one
 * (`Container::fit_child_in_rect` ends with `set_rotation(0)` /
 * `set_scale(Vector2(1, 1))`), and both the gate and the composite origin
 * must see the effective values.
 */
export interface ControlDrawTransform {
  /** Radians, Godot's `data.rotation`. */
  rotation: number;
  scale: Vec2;
  /** `Control::get_combined_pivot_offset()` — `pivot_offset + pivot_offset_ratio * size`. */
  pivot: Vec2;
}

/**
 * The translation column of `Control::_get_internal_transform()`
 * (`control.cpp:720-725`):
 *
 *     Transform2D xform(data.rotation, data.scale, 0.0f, get_combined_pivot_offset());
 *     xform.translate_local(-get_combined_pivot_offset());
 *
 * `Transform2D(rotation, scale, skew, origin)` puts `origin` in the third
 * column, and `translate_local(v)` adds `basis * v`, leaving
 * `pivot - basis * pivot`. With a zero skew the basis columns are
 * `(cos r, sin r) * scale.x` and `(-sin r, cos r) * scale.y`.
 *
 * Zero whenever the basis is the identity — the overwhelmingly common case of
 * an unrotated, unscaled Control, where the composite origin is just the
 * position.
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
 * The origin to draw a Control's own transform at, given its solved
 * (parent-relative, full-precision) rect position.
 *
 * Returns the origin of the OUTER placement, i.e. what remains once the
 * internal pivot/rotation/scale transform will have contributed its own
 * translation downstream: the snap applies to their SUM, so the difference
 * the snap introduced is what this hands back. With an identity basis that
 * sum is the position itself and this is a plain
 * `floor(position + 0.5)`.
 *
 * `is_inside_tree()` — the gate's first term — holds for everything that
 * reaches a renderer at all, so only the rotation gate and the project
 * setting are tested here. A non-finite rotation fails the `< epsilon`
 * comparison and therefore does not snap, which is the same answer Godot's
 * float comparison gives.
 */
export function snappedControlOrigin(
  position: Vec2,
  transform: ControlDrawTransform,
  snapEnabled: boolean
): Vec2 {
  if (!snapEnabled || !(Math.abs(Math.sin(transform.rotation * 4)) < SNAP_ROTATION_EPSILON)) {
    return { x: position.x, y: position.y };
  }

  const internal = internalTransformTranslation(transform);
  return {
    x: Math.floor(position.x + internal.x + 0.5) - internal.x,
    y: Math.floor(position.y + internal.y + 0.5) - internal.y,
  };
}
