/**
 * CapsuleMesh decode. The loader assigns radius (:623), then height (:624), the
 * pair `primitive_meshes.cpp` links (ADD_LINKED_PROPERTY :628-629), so an authored
 * height stands and the radius clamps. Neither float setter rejects a negative
 * (unlike CapsuleShape3D), so a negative radius is stored as authored.
 */

import { warn } from '../../../logger';
import { parseOptionalFloat, settableIntOr } from '../../../parser/valueParsers';
import { flooredCount } from '../meshCounts';
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

  // Both setters return early on an `is_equal_approx` match, which cannot change
  // the outcome: skipping the default radius 0.5 needs a height below 1 that no
  // earlier assignment made, and a skipped height makes its clamp a no-op.
  let radius = 0.5;
  let height = 2;
  if (authoredRadius !== undefined) {
    radius = authoredRadius;
    // `set_radius` (:638) raises height to `radius * 2` past the half height.
    if (radius > height * 0.5) height = radius * 2;
  }
  if (authoredHeight !== undefined) {
    height = authoredHeight;
    // `set_height` (:655) lowers radius to `height * 0.5` in the same case.
    if (radius > height * 0.5) radius = height * 0.5;
  }

  return {
    radius,
    height,
    radialSegments: flooredCount(properties.radial_segments, 4, 64, 'CapsuleMesh radialSegments'),
    // `set_rings` ERR_FAILs below 0 (:684), so a negative count keeps the default.
    rings: settableIntOr(properties.rings, 8, { min: 0 }, 'CapsuleMesh rings'),
  };
}
