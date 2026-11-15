/**
 * `SkeletonModification2D::clamp_angle` (`skeleton_modification_2d.cpp:71-103`), the angle limit a
 * LookAt and a CCDIK joint share.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { TAU } from '../../../../godot/math/math.js';
import type { AngleConstraint } from '../../../../resources/skeleton/skeletonmodificationstack2d/types';

/** A negative angle as its positive turn. An angle past a full turn stays as it is. */
function positiveTurn(angle: number): number {
  return angle < 0 ? TAU + angle : angle;
}

function chordSquared(a: number, b: number): number {
  return (Math.cos(a) - Math.cos(b)) ** 2 + (Math.sin(a) - Math.sin(b)) ** 2;
}

/**
 * `angle` moved to the nearer bound where the constraint refuses it: outside the bounds, or inside
 * them for an inverted constraint. An angle on a bound is kept either way.
 */
export function clampAngle(
  angle: number,
  constraint: Pick<AngleConstraint, 'min' | 'max' | 'invert'>
): number {
  const turn = positiveTurn(angle);
  const low = Math.min(positiveTurn(constraint.min), positiveTurn(constraint.max));
  const high = Math.max(positiveTurn(constraint.min), positiveTurn(constraint.max));
  const isRefused = constraint.invert ? turn > low && turn < high : turn < low || turn > high;
  if (!isRefused) return turn;
  return chordSquared(turn, low) <= chordSquared(turn, high) ? low : high;
}
