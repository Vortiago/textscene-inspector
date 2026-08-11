/**
 * CapsuleShape3D decode — property bag in, radius/height out.
 *
 * The two properties are linked in Godot: `set_radius` RAISES a too-short
 * height to `radius * 2` (`capsule_shape_3d.cpp:104`), `set_height` LOWERS an
 * oversized radius to `height * 0.5` (`:118`), and either setter rejects a
 * negative argument outright (`ERR_FAIL_COND_MSG`, `:102` / `:116`) leaving the
 * property at its previous value. The loader assigns in class-property order —
 * radius (`:148`) then height (`:149`), which is also the order the saver
 * writes — so when both are authored the height stands and the radius clamps.
 */

import { settableNonNegative } from '../../../parser/valueParsers';
import type { CapsuleShape3DProperties } from './types';

export function decodeCapsuleShape3D(
  properties: Record<string, string>
): CapsuleShape3DProperties {
  const authoredRadius = settableNonNegative(properties.radius, 'CapsuleShape3D radius');
  const authoredHeight = settableNonNegative(properties.height, 'CapsuleShape3D height');

  let radius = 0.5;
  let height = 2;
  if (authoredRadius !== undefined) {
    radius = authoredRadius;
    if (height < radius * 2) height = radius * 2;
  }
  if (authoredHeight !== undefined) {
    height = authoredHeight;
    if (radius > height * 0.5) radius = height * 0.5;
  }
  return { radius, height };
}
