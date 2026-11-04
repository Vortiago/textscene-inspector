/**
 * The corner of a Line2D stroke where two segments meet, as `LineBuilder::build` works it out
 * (`scene/2d/line_builder.cpp:211-300`): which side the turn opens on, where the inner edges
 * cross, and the joint mode that is possible there. The module only computes positions. The strip
 * of `lineStrip.ts` draws them.
 */

import { CMP_EPSILON, isEqualApprox } from '../../../godot/math/math';
import { storedReal as f } from '../../../godot/math/real';
import {
  vector2Add,
  vector2Dot,
  vector2LengthSquared,
  vector2Scaled,
  vector2Sub,
  type Vector2,
} from '../../../godot/math/vector';
import { LineJointMode } from '../../../godot/scene/line2d.js';
import { DOWN, UP, type Orientation } from './lineStrip';

/** The three points of a corner, with the half-width and the options that decide its joint. */
export interface JointInput {
  /** The point before the corner, the corner and the point after. */
  pos0: Vector2;
  pos1: Vector2;
  pos2: Vector2;
  /** The unit direction out of the corner. */
  forward1: Vector2;
  /** `forward` turned a quarter, for the segment into the corner and for the one out of it. */
  normal0: Vector2;
  normal1: Vector2;
  /** The half-width at the corner, with the width curve's factor already applied. */
  halfWidth: number;
  widthFactor: number;
  /** The squares of `width / 2` and of `sharp_limit`. */
  baseHalfWidthSq: number;
  sharpLimitSq: number;
  jointMode: number;
}

export interface Joint {
  orientation: Orientation;
  /** False when the inner edges of the two segments do not cross: a corner too sharp, or overlapping. */
  isIntersecting: boolean;
  /** The mode the corner draws with: SHARP falls back to BEVEL past `sharp_limit` or with no crossing. */
  jointMode: number;
  /** The pair that ends the segment into the corner. */
  up1: Vector2;
  down1: Vector2;
  /** The pair that starts the segment out of the corner. */
  nextUp0: Vector2;
  nextDown0: Vector2;
}

/** The corner at `pos1`, between the segment from `pos0` and the one to `pos2`. */
export function resolveJoint(input: JointInput): Joint {
  const { pos0, pos1, pos2, normal0, normal1, halfWidth } = input;
  const orientation = vector2Dot(normal0, input.forward1) > 0 ? UP : DOWN;

  let inner0 = vector2Scaled(normal0, halfWidth);
  let inner1 = vector2Scaled(normal1, halfWidth);
  if (orientation === DOWN) {
    inner0 = negated(inner0);
    inner1 = negated(inner1);
  }

  const crossing = segmentIntersection(
    vector2Add(pos0, inner0),
    vector2Add(pos1, inner0),
    vector2Add(pos1, inner1),
    vector2Add(pos2, inner1)
  );
  const cornerIn = crossing ?? vector2Add(pos1, inner0);
  const cornerOut = crossing ? vector2Sub(vector2Scaled(pos1, 2), cornerIn) : vector2Sub(pos1, inner0);
  const [cornerUp, cornerDown] = orientation === UP ? [cornerIn, cornerOut] : [cornerOut, cornerIn];

  if (!crossing) {
    // No crossing: SHARP has no fallback of its own, so it bevels.
    const jointMode = input.jointMode === LineJointMode.SHARP ? LineJointMode.BEVEL : input.jointMode;
    return {
      orientation,
      isIntersecting: false,
      jointMode,
      up1: cornerUp,
      down1: cornerDown,
      nextUp0: vector2Add(pos1, vector2Scaled(normal1, halfWidth)),
      nextDown0: vector2Sub(pos1, vector2Scaled(normal1, halfWidth)),
    };
  }

  const jointMode = exceedsSharpLimit(input, cornerOut) ? LineJointMode.BEVEL : input.jointMode;
  if (jointMode === LineJointMode.SHARP) {
    // The two segments share the edge from the inner crossing to the outer.
    return {
      orientation,
      isIntersecting: true,
      jointMode,
      up1: cornerUp,
      down1: cornerDown,
      nextUp0: cornerUp,
      nextDown0: cornerDown,
    };
  }

  const along0 = vector2Scaled(normal0, halfWidth);
  const along1 = vector2Scaled(normal1, halfWidth);
  return orientation === UP
    ? {
        orientation,
        isIntersecting: true,
        jointMode,
        up1: cornerUp,
        down1: vector2Sub(pos1, along0),
        nextUp0: cornerUp,
        nextDown0: vector2Sub(pos1, along1),
      }
    : {
        orientation,
        isIntersecting: true,
        jointMode,
        up1: vector2Add(pos1, along0),
        down1: cornerDown,
        nextUp0: vector2Add(pos1, along1),
        nextDown0: cornerDown,
      };
}

/** A miter longer than `sharp_limit` half-widths bevels instead (`line_builder.cpp:247-252`). */
function exceedsSharpLimit(input: JointInput, cornerOut: Vector2): boolean {
  if (input.jointMode !== LineJointMode.SHARP) return false;
  const widthFactorSq = f(input.widthFactor * input.widthFactor);
  const miterSq = vector2LengthSquared(vector2Sub(cornerOut, input.pos1));
  return f(miterSq / f(input.baseHalfWidthSq * widthFactorSq)) > input.sharpLimitSq;
}

const negated = ({ x, y }: Vector2): Vector2 => ({ x: -x, y: -y });

/**
 * `Geometry2D::segment_intersects_segment` (`core/math/geometry_2d.h:188-225`): where segment A
 * crosses segment B, or null for segments that miss, run parallel or have a zero-length A.
 */
function segmentIntersection(fromA: Vector2, toA: Vector2, fromB: Vector2, toB: Vector2): Vector2 | null {
  const b = vector2Sub(toA, fromA);
  const lengthSq = vector2Dot(b, b);
  if (lengthSq <= 0) return null;

  const unit = { x: f(b.x / lengthSq), y: f(b.y / lengthSq) };
  const c = inSegmentFrame(vector2Sub(fromB, fromA), unit);
  const d = inSegmentFrame(vector2Sub(toB, fromA), unit);

  // B misses A when both its ends lie on one side of A's line.
  if ((c.y < -CMP_EPSILON && d.y < -CMP_EPSILON) || (c.y > CMP_EPSILON && d.y > CMP_EPSILON)) return null;
  if (isEqualApprox(c.y, d.y)) return null;

  const position = f(d.x + f(f(f(c.x - d.x) * d.y) / f(d.y - c.y)));
  if (position < 0 || position > 1) return null;
  return vector2Add(fromA, vector2Scaled(b, position));
}

/** `point` with A's direction as the X axis and A's length as the unit. */
function inSegmentFrame(point: Vector2, unit: Vector2): Vector2 {
  return {
    x: f(f(point.x * unit.x) + f(point.y * unit.y)),
    y: f(f(point.y * unit.x) - f(point.x * unit.y)),
  };
}
