/**
 * The emission shape lines of Godot's `Particles3DEmissionShapeGizmoPlugin`, ported from
 * `particles_3d_emission_shape_gizmo_plugin.cpp:95-216` (GPU) and `:225-337` (CPU). The CPU branch is
 * the GPU one with no offset and a scale of 1, so one builder serves both. The formulas are not
 * guarded, as in Godot: an input that divides by zero leaves NaN vertices in the result.
 */

import { aabbEdges, type Aabb } from '../../../../godot/math/aabb';
import { basisInvert, type BasisComponents } from '../../../../godot/math/basis';
import { degToRad } from '../../../../godot/math/math';
import {
  VECTOR3_AXES,
  normalizedVector3,
  vector3Cross,
  vector3Dot,
  type Vector3,
} from '../../../../godot/math/vector';
import { EmissionShape } from '../../../../godot/scene/particles3d';
import type { ParticleEmission } from '../../../../resources/materials/particleprocessmaterial/types';

/** The circles run `i = 0..120` of 3 degrees, so the last segment overlaps the first. */
const LAST_CIRCLE_SEGMENT = 120;
const DEGREES_PER_SEGMENT = 3;
/** The ring's vertical lines stand at every 30th segment: 0, 90, 180, 270 and 360 degrees. */
const RING_LINE_SEGMENT_STEP = 30;

/**
 * The AABB of a `BoxMesh()`, size `Vector3(1, 1, 1)` (`primitive_meshes.h:164`) centred on the
 * origin. Its edges times twice the extents give the box, as the extents are half the size.
 */
const UNIT_BOX_AABB: Aabb = {
  position: { x: -0.5, y: -0.5, z: -0.5 },
  size: { x: 1, y: 1, z: 1 },
};

/**
 * The line segments of `emission`, as flat `xyz` start and end points in the emitter's space, each
 * point scaled by `shapeScale` and moved by `shapeOffset`. A shape without lines gives none.
 */
export function emissionShapeLines(emission: ParticleEmission): number[] {
  const { shapeOffset: offset, shapeScale: scale } = emission;
  switch (emission.shape) {
    case EmissionShape.SPHERE:
    case EmissionShape.SPHERE_SURFACE:
      return sphereLines(emission.sphereRadius, offset, scale);
    case EmissionShape.BOX:
      return boxLines(emission.boxExtents, offset, scale);
    case EmissionShape.RING:
      return ringLines(emission, offset, scale);
    default:
      return [];
  }
}

/** `Vector2(sin(a), cos(a)) * radius` for an angle in degrees. */
function circlePoint(degrees: number, radius: number): [number, number] {
  const angle = degToRad(degrees);
  return [Math.sin(angle) * radius, Math.cos(angle) * radius];
}

function sphereLines(radius: number, offset: Vector3, scale: Vector3): number[] {
  const points: number[] = [];
  for (let i = 0; i <= LAST_CIRCLE_SEGMENT; i++) {
    const [ax, ay] = circlePoint(i * DEGREES_PER_SEGMENT, radius);
    const [bx, by] = circlePoint((i + 1) * DEGREES_PER_SEGMENT, radius);
    points.push(
      ...[ax * scale.x + offset.x, offset.y, ay * scale.z + offset.z],
      ...[bx * scale.x + offset.x, offset.y, by * scale.z + offset.z],
      ...[offset.x, ax * scale.y + offset.y, ay * scale.z + offset.z],
      ...[offset.x, bx * scale.y + offset.y, by * scale.z + offset.z],
      ...[ax * scale.x + offset.x, ay * scale.y + offset.y, offset.z],
      ...[bx * scale.x + offset.x, by * scale.y + offset.y, offset.z]
    );
  }
  return points;
}

function boxLines(extents: Vector3, offset: Vector3, scale: Vector3): number[] {
  return aabbEdges(UNIT_BOX_AABB).map((coordinate, i) => {
    const axis = VECTOR3_AXES[i % 3]!;
    return coordinate * 2 * scale[axis] * extents[axis] + offset[axis];
  });
}

function ringLines(ring: ParticleEmission, offset: Vector3, scale: Vector3): number[] {
  const halfHeight = ring.ringHeight / 2;
  const taperedRadius = ring.ringRadius - Math.tan(degToRad(90 - ring.ringConeAngle)) * ring.ringHeight;
  // `MAX(a, 0.0)` is `a > 0.0 ? a : 0.0`, so a NaN `a` gives 0.
  const radiusTop = taperedRadius > 0 ? taperedRadius : 0;
  const innerRadiusTop = (ring.ringInnerRadius / ring.ringRadius) * radiusTop;
  const basis = ringBasis(ring.ringAxis);

  // The circle's point at `degrees` and `radius`, `height` along the axis, then the basis and the placement.
  const point = (degrees: number, radius: number, height: number): number[] => {
    const [x, z] = circlePoint(degrees, radius);
    return [
      (basis[0] * x + basis[1] * height + basis[2] * z) * scale.x + offset.x,
      (basis[3] * x + basis[4] * height + basis[5] * z) * scale.y + offset.y,
      (basis[6] * x + basis[7] * height + basis[8] * z) * scale.z + offset.z,
    ];
  };

  const points: number[] = [];
  for (let i = 0; i <= LAST_CIRCLE_SEGMENT; i++) {
    for (const degrees of [i, i + 1].map((segment) => segment * DEGREES_PER_SEGMENT)) {
      points.push(...point(degrees, radiusTop, halfHeight));
    }
    for (const degrees of [i, i + 1].map((segment) => segment * DEGREES_PER_SEGMENT)) {
      points.push(...point(degrees, ring.ringRadius, -halfHeight));
    }
    for (const degrees of [i, i + 1].map((segment) => segment * DEGREES_PER_SEGMENT)) {
      points.push(...point(degrees, innerRadiusTop, halfHeight));
    }
    for (const degrees of [i, i + 1].map((segment) => segment * DEGREES_PER_SEGMENT)) {
      points.push(...point(degrees, ring.ringInnerRadius, -halfHeight));
    }
  }
  for (let i = 0; i <= LAST_CIRCLE_SEGMENT; i += RING_LINE_SEGMENT_STEP) {
    const degrees = i * DEGREES_PER_SEGMENT;
    points.push(
      ...point(degrees, radiusTop, halfHeight),
      ...point(degrees, ring.ringRadius, -halfHeight),
      ...point(degrees, innerRadiusTop, halfHeight),
      ...point(degrees, ring.ringInnerRadius, -halfHeight)
    );
  }
  return points;
}

/** Single precision: each `f(...)` rounds as a C++ `float` operation does. */
const f = Math.fround;

/**
 * The basis that carries the ring's own axes onto its `ring_axis`, built as the plugin builds it
 * (`particles_3d_emission_shape_gizmo_plugin.cpp:155-160`): the rows are a vector made orthogonal
 * to the axis by one Gram-Schmidt step, the axis and their cross product, then inverted. It is
 * float arithmetic, since a start vector near the axis cancels to rounding noise. A zero axis
 * leaves a zero basis, which stays as it is.
 */
function ringBasis(axis: Vector3): BasisComponents {
  const up = normalizedVector3(axis.x, axis.y, axis.z);
  const start = normalizedVector3(up[1], -up[2], -up[0]);
  const overlap = vector3Dot(start, up);
  const right = normalizedVector3(
    f(start[0] - f(overlap * up[0])),
    f(start[1] - f(overlap * up[1])),
    f(start[2] - f(overlap * up[2]))
  );
  const forward = normalizedVector3(...vector3Cross(right, up));
  return basisInvert([...right, ...up, ...forward]);
}
