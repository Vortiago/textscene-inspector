/**
 * The line parts of Godot's Joint3D gizmo (`joint_3d_gizmo_plugin.cpp`), THREE-free: each builder
 * takes world transforms and returns flat segment ends `[x0,y0,z0, x1,y1,z1, …]` in the joint's
 * local frame, in float32 as Godot rounds.
 */

import { basisXform } from '../../../../godot/math/basisFloat.js';
import {
  basisColumn,
  basisFromColumns,
  basisInvert,
  basisMultiply,
  type BasisComponents,
} from '../../../../godot/math/basis.js';
import { degToRadf, radToDegf } from '../../../../godot/math/math.js';
import { storedReal as f } from '../../../../godot/math/real.js';
import { basisOfTransform3D, type Transform3D } from '../../../../godot/math/transform3d.js';
import {
  normalizedVector3,
  vector3Cross,
  vector3Scaled,
  type Vector3,
} from '../../../../godot/math/vector.js';

/** `CreatePinJointGizmo`'s `cs` (`:462-464`). */
const PIN_ARM_LENGTH = 0.25;

/** `BODY_A_RADIUS` and `BODY_B_RADIUS` (`:42-43`). */
const BODY_RADIUS = { bodyA: 0.25, bodyB: 0.27 };

/** The half-size of the square at each end of a linear travel (`cs` in the slider and 6DOF builders). */
const SQUARE_HALF_SIZE = 0.25;

/** What a joint passes where its angular limit is off: lower above upper, which `draw_circle` turns into the full circle (`:178-181`). */
export const FULL_CIRCLE_LIMITS = Object.freeze({ lower: 0, upper: -1 });

/** `draw_circle`'s `points`: arcs around the axis. */
const CIRCLE_ARCS = 32;

/** The largest twist the cone draws, in degrees (`draw_cone`, `ts = MIN(ts, 720)`). */
const MAX_TWIST_DEGREES = 720;

const SWING_STEP_DEGREES = 10;
const TWIST_STEP_DEGREES = 5;
const SWING_AXIS_STEP_DEGREES = 90;

export type BodyPart = keyof typeof BODY_RADIUS;

function asVector([x, y, z]: readonly [number, number, number]): Vector3 {
  return { x, y, z };
}

type Direction = readonly [number, number, number];

/** The world-space columns `x`, `y` and `z` expressed in the joint's own frame, as every look function ends (`:63-66`). */
function inJointFrame(joint: Transform3D, x: Direction, y: Direction, z: Direction): BasisComponents {
  const base = basisFromColumns(asVector(x), asVector(y), asVector(z));
  return basisMultiply(basisInvert(basisOfTransform3D(joint)), base);
}

function towardBody(joint: Transform3D, body: Transform3D): Direction {
  return normalizedVector3(
    f(body.origin.x - joint.origin.x),
    f(body.origin.y - joint.origin.y),
    f(body.origin.z - joint.origin.z)
  );
}

/**
 * `JointGizmosDrawer::look_body` (`:45-67`): the basis whose X axis points from the joint to the
 * body, crossed with the world up, in the joint's own frame. A body straight above or below the
 * joint, or at its origin, gives a zero Z axis, and the zero stays through the cross products.
 */
function lookBody(joint: Transform3D, body: Transform3D): BasisComponents {
  const x = towardBody(joint, body);
  const z = normalizedVector3(...vector3Cross(x, [0, 1, 0]));
  const y = normalizedVector3(...vector3Cross(z, x));
  return inJointFrame(joint, x, y, z);
}

/**
 * `JointGizmosDrawer::look_body_toward_x` (`:83-112`): the body direction decides the Y and Z axes
 * around the joint's own X axis, which stays X.
 */
function lookBodyTowardX(joint: Transform3D, body: Transform3D): BasisComponents {
  const front = basisColumn(basisOfTransform3D(joint), 0);
  const y = normalizedVector3(...vector3Cross(front, towardBody(joint, body)));
  const z = normalizedVector3(...vector3Cross(y, front));
  return inJointFrame(joint, normalizedVector3(...front), y, z);
}

/**
 * `JointGizmosDrawer::look_body_toward_y` (`:114-143`): the body direction decides the X and Z axes
 * around the joint's own Y axis, which stays Y.
 */
function lookBodyTowardY(joint: Transform3D, body: Transform3D): BasisComponents {
  const up = basisColumn(basisOfTransform3D(joint), 1);
  const z = normalizedVector3(...vector3Cross(towardBody(joint, body), up));
  const x = normalizedVector3(...vector3Cross(up, z));
  return inJointFrame(joint, x, normalizedVector3(...up), z);
}

/**
 * `JointGizmosDrawer::look_body_toward_z` (`:145-174`): the body direction decides the X and Y axes
 * around the joint's own Z axis, which stays Z.
 */
function lookBodyTowardZ(joint: Transform3D, body: Transform3D): BasisComponents {
  const z = normalizedVector3(...basisColumn(basisOfTransform3D(joint), 2));
  const y = normalizedVector3(...vector3Cross(z, towardBody(joint, body)));
  const x = normalizedVector3(...vector3Cross(y, z));
  return inJointFrame(joint, x, y, z);
}

/** The four edges of the square of half-size {@link SQUARE_HALF_SIZE} that `corner` places in 3D. */
function pushSquare(out: number[], corner: (y: number, z: number) => Vector3): void {
  const size = SQUARE_HALF_SIZE;
  const corners = [corner(-size, -size), corner(-size, size), corner(size, size), corner(size, -size)];
  corners.forEach((from, i) => pushSegment(out, from, corners[(i + 1) % corners.length]!));
}

/** The two ends of a segment from `from` to `to`. */
function pushSegment(out: number[], from: Vector3, to: Vector3): void {
  out.push(from.x, from.y, from.z, to.x, to.y, to.z);
}

/**
 * The point at `degrees` on a circle of `radius` in float32: `Vector2(sin, cos) * radius * scale`, with
 * the `scale` product only where the twist spiral grows.
 */
function ringPoint(degrees: number, radius: number, scale?: number): { x: number; y: number } {
  const angle = degToRadf(degrees);
  const x = f(f(Math.sin(angle)) * radius);
  const y = f(f(Math.cos(angle)) * radius);
  return scale === undefined ? { x, y } : { x: f(x * scale), y: f(y * scale) };
}

/**
 * `JointGizmosDrawer::draw_cone` (`:238-279`) before its basis: the swing circle with spokes every 90
 * degrees, the X axis, then the twist spiral, capped at 720 degrees. It depends on the two spans only,
 * so a cone-twist joint builds it once for both bodies.
 */
export function coneTwistLocalSegments(swing: number, twist: number): Float32Array {
  const out: number[] = [];
  const width = f(Math.sin(swing));
  const depth = f(Math.cos(swing));
  const origin: Vector3 = { x: 0, y: 0, z: 0 };

  for (let degrees = 0; degrees < 360; degrees += SWING_STEP_DEGREES) {
    const a = ringPoint(degrees, width);
    const b = ringPoint(degrees + SWING_STEP_DEGREES, width);
    const rimA: Vector3 = { x: depth, y: a.x, z: a.y };
    pushSegment(out, rimA, { x: depth, y: b.x, z: b.y });
    if (degrees % SWING_AXIS_STEP_DEGREES === 0) pushSegment(out, rimA, origin);
  }
  pushSegment(out, origin, { x: 1, y: 0, z: 0 });

  const twistDegrees = Math.min(radToDegf(twist), MAX_TWIST_DEGREES);
  for (let degrees = 0; degrees < Math.trunc(twistDegrees); degrees += TWIST_STEP_DEGREES) {
    const growth = f(degrees / MAX_TWIST_DEGREES);
    const nextGrowth = f((degrees + TWIST_STEP_DEGREES) / MAX_TWIST_DEGREES);
    const a = ringPoint(degrees, width, growth);
    const b = ringPoint(degrees + TWIST_STEP_DEGREES, width, nextGrowth);
    pushSegment(out, { x: growth, y: a.x, z: a.y }, { x: nextGrowth, y: b.x, z: b.y });
  }
  return Float32Array.from(out);
}
/** `CreatePinJointGizmo` (`:462-471`): three segments through the joint along X, Y and Z. */
export function pinJointSegments(): Float32Array {
  const c = PIN_ARM_LENGTH;
  return Float32Array.of(c, 0, 0, -c, 0, 0, 0, c, 0, 0, -c, 0, 0, 0, c, 0, 0, -c);
}

/**
 * `CreateConeTwistJointGizmo` (`:562-580`) for one body: the `local` cone of
 * {@link coneTwistLocalSegments} turned to look from the joint at `body`.
 */
export function coneTwistBodySegments(
  joint: Transform3D,
  body: Transform3D,
  local: Float32Array
): Float32Array {
  const base = lookBody(joint, body);
  const out = new Float32Array(local.length);
  for (let i = 0; i < local.length; i += 3) {
    const { x, y, z } = basisXform(base, { x: local[i]!, y: local[i + 1]!, z: local[i + 2]! });
    out[i] = x;
    out[i + 1] = y;
    out[i + 2] = z;
  }
  return out;
}

/** The ring point of `draw_circle` around Z at `angle`: `(cos, sin, 0)` (`:221-222`). */
function ringAroundZ(angle: number): Vector3 {
  return { x: f(Math.cos(angle)), y: f(Math.sin(angle)), z: 0 };
}

/** The ring point of `draw_circle` around X at `angle`: `(0, sin, cos)`, with sin negated unless `p_inverse` is set (`:193-198`). */
function ringAroundX(angle: number, inverse: boolean): Vector3 {
  return { x: 0, y: f(f(Math.sin(angle)) * (inverse ? 1 : -1)), z: f(Math.cos(angle)) };
}

/** The ring point of `draw_circle` around Y at `angle`: `(cos, 0, sin)`, with sin negated where `p_inverse` is set (`:204-210`). */
function ringAroundY(angle: number, inverse: boolean): Vector3 {
  return { x: f(Math.cos(angle)), y: 0, z: f(f(Math.sin(angle)) * (inverse ? -1 : 1)) };
}

/**
 * `JointGizmosDrawer::draw_circle` (`:176-236`) with the identity offset: equal limits draw one
 * segment along the base's X axis. Otherwise a lower limit above the upper one becomes the full
 * circle, and 32 arcs follow `ringAt`, each end joined to the origin, with a mark on Y.
 */
function circleSegments(
  radius: number,
  base: BasisComponents,
  lowerLimit: number,
  upperLimit: number,
  ringAt: (angle: number) => Vector3
): Float32Array {
  const out: number[] = [];
  let lower = f(lowerLimit);
  let upper = f(upperLimit);
  const origin: Vector3 = { x: 0, y: 0, z: 0 };
  if (lower === upper) {
    pushSegment(out, origin, basisXform(base, { x: 0.5, y: 0, z: 0 }));
    return Float32Array.from(out);
  }
  if (lower > upper) {
    lower = f(-Math.PI);
    upper = f(Math.PI);
  }

  const span = f(upper - lower);
  const points = Array.from({ length: CIRCLE_ARCS + 1 }, (_, index) => {
    const angle = f(lower + f(f(index * span) / CIRCLE_ARCS));
    return vector3Scaled(basisXform(base, ringAt(angle)), radius);
  });
  for (let i = 0; i < CIRCLE_ARCS; i++) {
    const from = points[i]!;
    const to = points[i + 1]!;
    if (i === CIRCLE_ARCS - 1) pushSegment(out, to, origin);
    if (i === 0) pushSegment(out, from, origin);
    pushSegment(out, from, to);
  }
  pushSegment(out, { x: 0, y: f(radius * 1.5), z: 0 }, origin);
  return Float32Array.from(out);
}

/** `CreateHingeJointGizmo` (`:473-476`): the hinge axis, one segment along Z from 0.5 to -0.5. */
export function hingeJointSegments(): Float32Array {
  return Float32Array.of(0, 0, 0.5, 0, 0, -0.5);
}

/**
 * `CreateHingeJointGizmo` (`:478-499`) for one body: the circle around Z between the angular
 * limits, turned to look from the joint toward the body. A caller with the limit off passes lower 0
 * and upper -1, which draws the full circle.
 */
export function hingeBodySegments(
  joint: Transform3D,
  body: Transform3D,
  part: BodyPart,
  lowerLimit: number,
  upperLimit: number
): Float32Array {
  const base = lookBodyTowardZ(joint, body);
  return circleSegments(f(BODY_RADIUS[part]), base, lowerLimit, upperLimit, ringAroundZ);
}

/**
 * `CreateSliderJointGizmo` (`:503-551`) for the joint colour: the Z segment, then the X travel
 * between the negated linear limits with a square at each end, or the short X segment where the
 * negated lower limit is below the upper one.
 */
export function sliderJointSegments(lowerLimit: number, upperLimit: number): Float32Array {
  const out: number[] = [];
  const lower = f(-lowerLimit);
  const upper = f(-upperLimit);
  pushSegment(out, { x: 0, y: 0, z: 0.5 }, { x: 0, y: 0, z: -0.5 });
  if (lower < upper) {
    pushSegment(out, { x: 0.5, y: 0, z: 0 }, { x: -0.5, y: 0, z: 0 });
    return Float32Array.from(out);
  }
  pushSegment(out, { x: upper, y: 0, z: 0 }, { x: lower, y: 0, z: 0 });
  for (const x of [upper, lower]) pushSquare(out, (y, z) => ({ x, y, z }));
  return Float32Array.from(out);
}

/**
 * `CreateSliderJointGizmo` (`:535-559`) for one body: the circle around X between the angular
 * limits, turned to look from the joint toward the body. Body B draws the circle's inverse form.
 */
export function sliderBodySegments(
  joint: Transform3D,
  body: Transform3D,
  part: BodyPart,
  lowerLimit: number,
  upperLimit: number
): Float32Array {
  const base = lookBodyTowardX(joint, body);
  const inverse = part === 'bodyB';
  return circleSegments(f(BODY_RADIUS[part]), base, lowerLimit, upperLimit, (angle) =>
    ringAroundX(angle, inverse)
  );
}

/** What `CreateGeneric6DOFJointGizmo` reads for one axis: the linear and angular limits, each with its flag. */
export interface SixDofAxisLimits {
  linearEnabled: boolean;
  linearLower: number;
  linearUpper: number;
  angularEnabled: boolean;
  angularLower: number;
  angularUpper: number;
}

/** The limits of the X, Y and Z axes, in that order. */
export type SixDofLimits = readonly [SixDofAxisLimits, SixDofAxisLimits, SixDofAxisLimits];

/**
 * `ADD_VTX` (`CreateGeneric6DOFJointGizmo`, `:622-656`): `(x, y, z)` written on `axis`, the next axis
 * and the one after, so Y reads `(z, x, y)` and Z reads `(y, z, x)`.
 */
function axisVertex(axis: number, x: number, y: number, z: number): Vector3 {
  const components = [0, 0, 0];
  components[axis] = x;
  components[(axis + 1) % 3] = y;
  components[(axis + 2) % 3] = z;
  return { x: components[0]!, y: components[1]!, z: components[2]! };
}

/** The travel of one axis in the joint colour (`:658-690`): the negated limits with a square at each end, else a segment of half-length 0.5. */
function sixDofAxisTravel(axis: number, limits: SixDofAxisLimits): number[] {
  const out: number[] = [];
  const lower = f(-limits.linearLower);
  const upper = f(-limits.linearUpper);
  if (!limits.linearEnabled || lower < upper) {
    pushSegment(out, axisVertex(axis, 0.5, 0, 0), axisVertex(axis, -0.5, 0, 0));
    return out;
  }
  pushSegment(out, axisVertex(axis, upper, 0, 0), axisVertex(axis, lower, 0, 0));
  for (const x of [upper, lower]) pushSquare(out, (y, z) => axisVertex(axis, x, y, z));
  return out;
}

/** `CreateGeneric6DOFJointGizmo` (`:582-690`) for the joint colour: the travel of X, then Y, then Z. */
export function sixDofJointSegments(limits: SixDofLimits): Float32Array {
  return Float32Array.from(limits.flatMap((axisLimits, axis) => sixDofAxisTravel(axis, axisLimits)));
}

const LOOK_BODY_TOWARD = [lookBodyTowardX, lookBodyTowardY, lookBodyTowardZ];
const RING_AROUND: readonly ((angle: number, inverse: boolean) => Vector3)[] = [
  ringAroundX,
  ringAroundY,
  ringAroundZ,
];

/**
 * `CreateGeneric6DOFJointGizmo` (`:692-723`) for one body: the circle of X, then Y, then Z, each
 * looking from the joint toward the body around its own axis. A disabled angular limit draws the full
 * circle. Body A draws the inverse form (`p_inverse`) and body B the plain one.
 */
export function sixDofBodySegments(
  joint: Transform3D,
  body: Transform3D,
  part: BodyPart,
  limits: SixDofLimits
): Float32Array {
  const radius = f(BODY_RADIUS[part]);
  const inverse = part === 'bodyA';
  const out: number[] = [];
  limits.forEach(({ angularEnabled, angularLower, angularUpper }, axis) => {
    const base = LOOK_BODY_TOWARD[axis]!(joint, body);
    const ringAt = (angle: number) => RING_AROUND[axis]!(angle, inverse);
    const { lower, upper } = angularEnabled
      ? { lower: angularLower, upper: angularUpper }
      : FULL_CIRCLE_LIMITS;
    out.push(...circleSegments(radius, base, lower, upper, ringAt));
  });
  return Float32Array.from(out);
}
