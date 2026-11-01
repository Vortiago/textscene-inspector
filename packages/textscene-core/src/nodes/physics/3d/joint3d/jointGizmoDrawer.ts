/**
 * The line parts of Godot's Joint3D gizmo (`joint_3d_gizmo_plugin.cpp`), THREE-free: each builder
 * takes world transforms and returns flat segment ends `[x0,y0,z0, x1,y1,z1, …]` in the joint's
 * local frame, in float32 as Godot rounds.
 */

import { basisXform } from '../../../../godot/math/basisFloat.js';
import {
  basisFromColumns,
  basisInvert,
  basisMultiply,
  type BasisComponents,
} from '../../../../godot/math/basis.js';
import { degToRadf, radToDegf } from '../../../../godot/math/math.js';
import { storedReal as f } from '../../../../godot/math/real.js';
import { basisOfTransform3D, type Transform3D } from '../../../../godot/math/transform3d.js';
import { normalizedVector3, vector3Cross, type Vector3 } from '../../../../godot/math/vector.js';

/** `CreatePinJointGizmo`'s `cs` (`:462-464`). */
const PIN_ARM_LENGTH = 0.25;

/** The largest twist the cone draws, in degrees (`draw_cone`, `ts = MIN(ts, 720)`). */
const MAX_TWIST_DEGREES = 720;

const SWING_STEP_DEGREES = 10;
const TWIST_STEP_DEGREES = 5;
const SWING_AXIS_STEP_DEGREES = 90;

function asVector([x, y, z]: readonly [number, number, number]): Vector3 {
  return { x, y, z };
}

/**
 * `JointGizmosDrawer::look_body` (`:45-67`): the basis whose X axis points from the joint to the
 * body, crossed with the world up, in the joint's own frame. A body straight above or below the
 * joint, or at its origin, gives a zero Z axis, and the zero stays through the cross products.
 */
function lookBody(joint: Transform3D, body: Transform3D): BasisComponents {
  const towardBody = normalizedVector3(
    f(body.origin.x - joint.origin.x),
    f(body.origin.y - joint.origin.y),
    f(body.origin.z - joint.origin.z)
  );
  const sideways = normalizedVector3(...vector3Cross(towardBody, [0, 1, 0]));
  const up = normalizedVector3(...vector3Cross(sideways, towardBody));
  const base = basisFromColumns(asVector(towardBody), asVector(up), asVector(sideways));
  return basisMultiply(basisInvert(basisOfTransform3D(joint)), base);
}

/** The two ends of a segment from `from` to `to` through `base`. */
function pushSegment(out: number[], base: BasisComponents, from: Vector3, to: Vector3): void {
  const start = basisXform(base, from);
  const end = basisXform(base, to);
  out.push(start.x, start.y, start.z, end.x, end.y, end.z);
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
 * `JointGizmosDrawer::draw_cone` (`:238-279`) with an identity offset, which is the only offset the
 * plugin passes: the swing circle with spokes every 90 degrees, the X axis, then the twist spiral,
 * capped at 720 degrees.
 */
function drawCone(base: BasisComponents, swing: number, twist: number): Float32Array {
  const out: number[] = [];
  const width = f(Math.sin(swing));
  const depth = f(Math.cos(swing));
  const origin: Vector3 = { x: 0, y: 0, z: 0 };

  for (let degrees = 0; degrees < 360; degrees += SWING_STEP_DEGREES) {
    const a = ringPoint(degrees, width);
    const b = ringPoint(degrees + SWING_STEP_DEGREES, width);
    const rimA: Vector3 = { x: depth, y: a.x, z: a.y };
    pushSegment(out, base, rimA, { x: depth, y: b.x, z: b.y });
    if (degrees % SWING_AXIS_STEP_DEGREES === 0) pushSegment(out, base, rimA, origin);
  }
  pushSegment(out, base, origin, { x: 1, y: 0, z: 0 });

  const twistDegrees = Math.min(radToDegf(twist), MAX_TWIST_DEGREES);
  for (let degrees = 0; degrees < Math.trunc(twistDegrees); degrees += TWIST_STEP_DEGREES) {
    const growth = f(degrees / MAX_TWIST_DEGREES);
    const nextGrowth = f((degrees + TWIST_STEP_DEGREES) / MAX_TWIST_DEGREES);
    const a = ringPoint(degrees, width, growth);
    const b = ringPoint(degrees + TWIST_STEP_DEGREES, width, nextGrowth);
    pushSegment(out, base, { x: growth, y: a.x, z: a.y }, { x: nextGrowth, y: b.x, z: b.y });
  }
  return Float32Array.from(out);
}
/** `CreatePinJointGizmo` (`:462-471`): three segments through the joint along X, Y and Z. */
export function pinJointSegments(): Float32Array {
  const c = PIN_ARM_LENGTH;
  return Float32Array.of(c, 0, 0, -c, 0, 0, 0, c, 0, 0, -c, 0, 0, 0, c, 0, 0, -c);
}

/**
 * `CreateConeTwistJointGizmo` (`:562-580`) for one body: the cone that looks from the joint at
 * `body`, with the joint's `swing_span` and `twist_span`.
 */
export function coneTwistBodySegments(
  joint: Transform3D,
  body: Transform3D,
  swing: number,
  twist: number
): Float32Array {
  return drawCone(lookBody(joint, body), swing, twist);
}
