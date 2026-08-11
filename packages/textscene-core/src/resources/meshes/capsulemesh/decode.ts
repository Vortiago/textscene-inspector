/**
 * CapsuleMesh decode — property bag in, radius/height/segment counts out.
 *
 * Radius and height are linked (`primitive_meshes.cpp` ADD_LINKED_PROPERTY
 * :628-629): `set_radius` (:638) RAISES height to `radius * 2` once the radius
 * passes the half height, `set_height` (:655) LOWERS radius to `height * 0.5` in
 * the same situation, and the loader assigns in property order — radius (:623)
 * then height (:624) — so an authored height stands and the radius clamps.
 *
 * Both setters also early-return on an `is_equal_approx` match with the current
 * value, which cannot change the outcome here: the only skippable radius is the
 * default 0.5, whose raise would need a height below 1 that no earlier
 * assignment can have produced, and a skippable height equals whatever the
 * radius step just left, whose clamp is then a no-op by construction.
 *
 * Neither float setter rejects a negative (unlike CapsuleShape3D), so a negative
 * radius is stored as authored.
 */

import { warn } from '../../../logger';
import { parseOptionalFloat } from '../../../parser/valueParsers';
import { countAtLeast, flooredCount } from '../meshCounts';
import type { CapsuleMeshProperties } from './types';

/** An authored value the setter would receive, or undefined when absent/unreadable. */
function authored(raw: string | undefined, context: string): number | undefined {
  const parsed = parseOptionalFloat(raw);
  if (raw !== undefined && parsed === undefined) {
    warn(`${context}: invalid float "${raw}", keeping the Godot default`);
  }
  return parsed;
}

export function decodeCapsuleMesh(properties: Record<string, string>): CapsuleMeshProperties {
  const authoredRadius = authored(properties.radius, 'CapsuleMesh radius');
  const authoredHeight = authored(properties.height, 'CapsuleMesh height');

  let radius = 0.5;
  let height = 2;
  if (authoredRadius !== undefined) {
    radius = authoredRadius;
    if (radius > height * 0.5) height = radius * 2;
  }
  if (authoredHeight !== undefined) {
    height = authoredHeight;
    if (radius > height * 0.5) radius = height * 0.5;
  }

  return {
    radius,
    height,
    radialSegments: flooredCount(properties.radial_segments, 4, 64, 'CapsuleMesh radialSegments'),
    rings: countAtLeast(properties.rings, 0, 8, 'CapsuleMesh rings'),
  };
}
