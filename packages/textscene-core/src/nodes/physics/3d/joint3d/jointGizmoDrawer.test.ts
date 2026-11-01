/**
 * The Joint3D gizmo parts (`joint_3d_gizmo_plugin.cpp`). The expected values come from a GDScript
 * port of `look_body`, `look_body_toward_x`, `look_body_toward_z`, `draw_cone` and `draw_circle` that
 * ran in Godot 4.6.3 through the engine's own `Basis` and `Vector3`, so they share no code with the build. `look_body` shows in every cone, since the cone
 * is built in the basis it returns. The 6DOF cases come from `/mnt/project-files/joint-1009/oracle.gd`.
 */
import { describe, expect, it } from 'vitest';
import { transform3DOf, type Transform3D } from '../../../../godot/math/transform3d.js';
import type { Vector3 } from '../../../../godot/math/vector.js';
import { expectClose, vertex } from './jointVertices.testkit.js';
import {
  coneTwistBodySegments,
  coneTwistLocalSegments,
  hingeBodySegments,
  hingeJointSegments,
  pinJointSegments,
  sixDofBodySegments,
  sixDofJointSegments,
  sliderBodySegments,
  sliderJointSegments,
  type SixDofAxisLimits,
  type SixDofLimits,
} from './jointGizmoDrawer.js';

const ROTATED_ABOUT_Y = transform3DOf(
  [Math.cos(0.6), 0, Math.sin(0.6), 0, 1, 0, -Math.sin(0.6), 0, Math.cos(0.6)],
  {
    x: 0.5,
    y: 0,
    z: 0.5,
  }
);
const SIDE_BODY = at({ x: 2, y: 1, z: -1 });

function at(origin: Vector3): Transform3D {
  return transform3DOf([1, 0, 0, 0, 1, 0, 0, 0, 1], origin);
}

const SWING = Math.PI / 4;
const SWING_ONLY_VERTICES = 82;

/** The cone of one body, built the way the component builds it: the local cone, then the body's basis. */
function cone(joint: Transform3D, body: Transform3D, swing: number, twist: number): Float32Array {
  return coneTwistBodySegments(joint, body, coneTwistLocalSegments(swing, twist));
}

describe('the cone of a body', () => {
  it('looks from an unrotated joint at the body, with the swing circle, spokes and X axis for a twist of 0', () => {
    const segments = cone(at({ x: 0.5, y: 0, z: 0.5 }), SIDE_BODY, SWING, 0);
    expect(segments.length / 3).toBe(SWING_ONLY_VERTICES);
    expectClose(vertex(segments, 1), [0.907649, 0.412577, 0.077159]);
    expectClose(vertex(segments, 80), [0, 0, 0]);
    expectClose(vertex(segments, 81), [0.639602, 0.426401, -0.639602]);
  });

  it("absorbs the joint's own rotation, as look_body multiplies by the inverse of its basis", () => {
    const segments = cone(ROTATED_ABOUT_Y, SIDE_BODY, SWING, 0);
    expectClose(vertex(segments, 1), [0.705548, 0.412577, 0.576179]);
    expectClose(vertex(segments, 9), [0.538006, 0.71264, 0.450216]);
    expectClose(vertex(segments, 40), [0.498295, 0.301511, -0.812892]);
    expectClose(vertex(segments, 80), [0, 0, 0]);
    expectClose(vertex(segments, 81), [0.889033, 0.426401, -0.16674]);
  });

  it('crosses with the world up, so a rotated joint and body turn the cone', () => {
    const rotation = 0.5;
    const [cos, sin] = [Math.cos(rotation), Math.sin(rotation)];
    const turned = (x: number, y: number, z: number) => ({ x, y: cos * y - sin * z, z: sin * y + cos * z });
    const joint = transform3DOf([1, 0, 0, 0, cos, -sin, 0, sin, cos], turned(0.5, 0, 0.5));
    const segments = cone(joint, at(turned(2, 1, -1)), SWING, Math.PI);
    expectClose(vertex(segments, 1), [0.718566, 0.691507, 0.07403]);
    expectClose(vertex(segments, 40), [0.107729, 0.005471, -0.994165]);
    expectClose(vertex(segments, 153), [0.073766, 0.03259, -0.295375]);
  });

  it('adds a twist spiral of one segment per 5 degrees, 36 for a twist of PI', () => {
    const segments = cone(ROTATED_ABOUT_Y, SIDE_BODY, SWING, Math.PI);
    expect(segments.length / 3).toBe(SWING_ONLY_VERTICES + 72);
    expectClose(vertex(segments, 152), [0.178246, 0.117188, -0.207628]);
    expectClose(vertex(segments, 153), [0.189672, 0.1066, -0.215432]);
  });

  it('stops the spiral at 720 degrees, so 5 PI draws what 13 radians draws', () => {
    const capped = cone(ROTATED_ABOUT_Y, SIDE_BODY, SWING, 5 * Math.PI);
    expect(capped.length / 3).toBe(SWING_ONLY_VERTICES + 288);
    expectClose(vertex(capped, 368), [1.037457, 0.368082, 0.517144]);
    expectClose(vertex(capped, 369), [1.019379, 0.426401, 0.528249]);
    expect(Array.from(cone(ROTATED_ABOUT_Y, SIDE_BODY, SWING, 13))).toEqual(Array.from(capped));
  });

  it('draws no spiral for a negative twist', () => {
    expect(cone(ROTATED_ABOUT_Y, SIDE_BODY, SWING, -1)).toHaveLength(SWING_ONLY_VERTICES * 3);
  });

  it('follows a swing span of 0.5236 with a twist of 13', () => {
    const segments = cone(ROTATED_ABOUT_Y, SIDE_BODY, 0.5236, 13);
    expectClose(vertex(segments, 1), [0.824306, 0.44781, 0.34639]);
    expectClose(vertex(segments, 40), [0.677755, 0.369274, -0.635833]);
    expectClose(vertex(segments, 369), [0.981202, 0.426401, 0.324693]);
  });

  it.each([
    ['above', 4],
    ['below', -4],
  ])('collapses the cone onto the world Y axis for a body straight %s the joint', (_label, height) => {
    const segments = cone(at({ x: 1, y: 0, z: 1 }), at({ x: 1, y: height, z: 1 }), SWING, 0);
    const offAxis = Array.from(segments).filter((_value, index) => index % 3 !== 1);
    expect(offAxis.every((value) => value === 0)).toBe(true);
  });

  it('collapses every point onto the joint for a body at its origin', () => {
    const segments = cone(at({ x: 1, y: 0, z: 1 }), at({ x: 1, y: 0, z: 1 }), SWING, 0);
    expect(Array.from(segments).every((value) => value === 0)).toBe(true);
  });
});

describe('pinJointSegments', () => {
  it('draws three segments of half-length 0.25 along X, Y and Z', () => {
    expect(Array.from(pinJointSegments())).toEqual([
      0.25, 0, 0, -0.25, 0, 0, 0, 0.25, 0, 0, -0.25, 0, 0, 0, 0.25, 0, 0, -0.25,
    ]);
  });
});

/** Vertices of a 32-arc circle: the first arc, the 30 between, the last arc, and the spoke to the Y mark. */
const CIRCLE_VERTEX_COUNT = 70;
const FIRST_ARC_START = 0;
const FIRST_ARC_END = 3;
const MIDDLE_ARC_END = 40;
const LAST_ARC_END = 67;
const Y_MARK = 68;

describe('hingeJointSegments', () => {
  it('draws the hinge axis, one segment along Z from 0.5 to -0.5', () => {
    expect(Array.from(hingeJointSegments())).toEqual([0, 0, 0.5, 0, 0, -0.5]);
  });
});

describe('the hinge circle of a body', () => {
  it('draws a full circle for the defaults of the limit off, where lower 0 is above upper -1', () => {
    const circle = hingeBodySegments(ROTATED_ABOUT_Y, SIDE_BODY, 'bodyA', 0, -1);
    expect(circle.length / 3).toBe(CIRCLE_VERTEX_COUNT);
    expectClose(vertex(circle, FIRST_ARC_START), [-0.225414, -0.108114, 0]);
    expectClose(vertex(circle, FIRST_ARC_END), [-0.199991, -0.150013, 0]);
    expectClose(vertex(circle, MIDDLE_ARC_END), [0.12736, 0.215127, 0]);
    expectClose(vertex(circle, LAST_ARC_END), [-0.225414, -0.108114, 0]);
    expectClose(vertex(circle, Y_MARK), [0, 0.375, 0]);
  });

  it('draws the same full circle for any lower limit above the upper one', () => {
    const inverted = hingeBodySegments(ROTATED_ABOUT_Y, SIDE_BODY, 'bodyA', 1, -0.5);
    expect(Array.from(inverted)).toEqual(
      Array.from(hingeBodySegments(ROTATED_ABOUT_Y, SIDE_BODY, 'bodyA', 0, -1))
    );
  });

  it('draws the arc between the limits, at radius 0.25 for body A', () => {
    const circle = hingeBodySegments(ROTATED_ABOUT_Y, SIDE_BODY, 'bodyA', -1.0471975, 1.0471975);
    expectClose(vertex(circle, FIRST_ARC_START), [0.206336, -0.141157, 0]);
    expectClose(vertex(circle, FIRST_ARC_END), [0.215127, -0.12736, 0]);
    expectClose(vertex(circle, MIDDLE_ARC_END), [0.199991, 0.150013, 0]);
    expectClose(vertex(circle, LAST_ARC_END), [0.019078, 0.249271, 0]);
    expectClose(vertex(circle, Y_MARK), [0, 0.375, 0]);
  });

  it('draws at radius 0.27 for body B, looking at body B', () => {
    const circle = hingeBodySegments(
      ROTATED_ABOUT_Y,
      at({ x: -1, y: 0.5, z: 2 }),
      'bodyB',
      -1.0471975,
      1.0471975
    );
    expectClose(vertex(circle, FIRST_ARC_START), [-0.076749, 0.258862, 0]);
    expectClose(vertex(circle, MIDDLE_ARC_END), [-0.269795, 0.010532, 0]);
    expectClose(vertex(circle, LAST_ARC_END), [-0.185806, -0.195898, 0]);
    expectClose(vertex(circle, Y_MARK), [0, 0.405, 0]);
  });

  it('draws one segment from the origin to the basis times 0.5 along X for equal limits', () => {
    const circle = hingeBodySegments(ROTATED_ABOUT_Y, SIDE_BODY, 'bodyA', 0.3, 0.3);
    expectClose(circle, [0, 0, 0, 0.450828, 0.216228, 0]);
  });
});

describe('sliderJointSegments', () => {
  it('draws the Z axis, the X segment and a 0.5 square at each end of the default limits', () => {
    expectClose(
      sliderJointSegments(-1, 1),
      [
        0, 0, 0.5, 0, 0, -0.5, -1, 0, 0, 1, 0, 0, -1, -0.25, -0.25, -1, -0.25, 0.25, -1, -0.25, 0.25, -1,
        0.25, 0.25, -1, 0.25, 0.25, -1, 0.25, -0.25, -1, 0.25, -0.25, -1, -0.25, -0.25, 1, -0.25, -0.25, 1,
        -0.25, 0.25, 1, -0.25, 0.25, 1, 0.25, 0.25, 1, 0.25, 0.25, 1, 0.25, -0.25, 1, 0.25, -0.25, 1, -0.25,
        -0.25,
      ]
    );
  });

  it('draws both squares at one place for both limits at 0.5', () => {
    const segments = sliderJointSegments(0.5, 0.5);
    expect(segments.length / 3).toBe(20);
    expectClose(vertex(segments, 2), [-0.5, 0, 0]);
    expectClose(vertex(segments, 3), [-0.5, 0, 0]);
    expectClose(vertex(segments, 12), [-0.5, -0.25, -0.25]);
  });

  it('draws one X segment from 0.5 to -0.5 where the negated lower limit is below the upper', () => {
    expectClose(sliderJointSegments(1, -1), [0, 0, 0.5, 0, 0, -0.5, 0.5, 0, 0, -0.5, 0, 0]);
  });
});

describe('the slider circle of a body', () => {
  it('draws one segment along X for the default angular limits of 0 and 0', () => {
    expectClose(sliderBodySegments(ROTATED_ABOUT_Y, SIDE_BODY, 'bodyA', 0, 0), [0, 0, 0, 0.5, 0, 0]);
  });

  it('draws the arc around X for body A, with Y negated', () => {
    const circle = sliderBodySegments(ROTATED_ABOUT_Y, SIDE_BODY, 'bodyA', -0.5, 0.8);
    expect(circle.length / 3).toBe(CIRCLE_VERTEX_COUNT);
    expectClose(vertex(circle, FIRST_ARC_START), [0, 0.247979, 0.031725]);
    expectClose(vertex(circle, FIRST_ARC_END), [0, 0.249063, 0.021627]);
    expectClose(vertex(circle, MIDDLE_ARC_END), [0, 0.19983, -0.150226]);
    expectClose(vertex(circle, LAST_ARC_END), [0, 0.096903, -0.230456]);
    expectClose(vertex(circle, Y_MARK), [0, 0.375, 0]);
  });

  it('draws the arc for body B with the Y form flipped and radius 0.27', () => {
    const circle = sliderBodySegments(ROTATED_ABOUT_Y, at({ x: -1, y: 0.5, z: 2 }), 'bodyB', -0.5, 0.8);
    expectClose(vertex(circle, FIRST_ARC_START), [0, 0.26639, 0.044007]);
    expectClose(vertex(circle, FIRST_ARC_END), [0, 0.264383, 0.054789]);
    expectClose(vertex(circle, MIDDLE_ARC_END), [0, 0.160202, 0.217337]);
    expectClose(vertex(circle, LAST_ARC_END), [0, 0.028856, 0.268454]);
    expectClose(vertex(circle, Y_MARK), [0, 0.405, 0]);
  });

  it('draws a full circle for body B where the lower limit is above the upper one', () => {
    const circle = sliderBodySegments(ROTATED_ABOUT_Y, at({ x: -1, y: 0.5, z: 2 }), 'bodyB', 1, -1);
    expectClose(vertex(circle, FIRST_ARC_START), [0, -0.212681, -0.166333]);
    expectClose(vertex(circle, MIDDLE_ARC_END), [0, 0.084428, 0.25646]);
    expectClose(vertex(circle, LAST_ARC_END), [0, -0.212681, -0.166333]);
  });
});

const SIX_DOF_DEFAULT_AXIS: SixDofAxisLimits = {
  linearEnabled: true,
  linearLower: 0,
  linearUpper: 0,
  angularEnabled: true,
  angularLower: 0,
  angularUpper: 0,
};
const BODY_B_SIDE = at({ x: -1, y: 0.5, z: 2 });
const SIX_DOF_AXIS_VERTEX_COUNT = 18;
const SIX_DOF_DEFAULTS: SixDofLimits = [SIX_DOF_DEFAULT_AXIS, SIX_DOF_DEFAULT_AXIS, SIX_DOF_DEFAULT_AXIS];
const UNROTATED_JOINT = at({ x: 0.5, y: 0, z: 0.5 });

/** The defaults with the given overrides on each of the X, Y and Z axes. */
function sixDofLimits(
  x: Partial<SixDofAxisLimits>,
  y: Partial<SixDofAxisLimits> = {},
  z: Partial<SixDofAxisLimits> = {}
): SixDofLimits {
  return [
    { ...SIX_DOF_DEFAULT_AXIS, ...x },
    { ...SIX_DOF_DEFAULT_AXIS, ...y },
    { ...SIX_DOF_DEFAULT_AXIS, ...z },
  ];
}

describe('sixDofJointSegments', () => {
  it('draws a degenerate travel and a 0.5 square at the origin per axis at the defaults', () => {
    const segments = sixDofJointSegments(SIX_DOF_DEFAULTS);
    expect(segments.length / 3).toBe(3 * SIX_DOF_AXIS_VERTEX_COUNT);
    expectClose(vertex(segments, 0), [0, 0, 0]);
    expectClose(vertex(segments, 2), [0, -0.25, -0.25]);
    expectClose(vertex(segments, 20), [-0.25, 0, -0.25]);
    expectClose(vertex(segments, 38), [-0.25, -0.25, 0]);
  });

  it('draws the travel between the negated limits with a square at each end', () => {
    const segments = sixDofJointSegments(sixDofLimits({ linearLower: -1, linearUpper: 1 }));
    expectClose(vertex(segments, 0), [-1, 0, 0]);
    expectClose(vertex(segments, 1), [1, 0, 0]);
    expectClose(vertex(segments, 2), [-1, -0.25, -0.25]);
    expectClose(vertex(segments, 10), [1, -0.25, -0.25]);
  });

  it('writes the Y axis travel along Y and the squares across Z then X', () => {
    const segments = sixDofJointSegments(sixDofLimits({}, { linearLower: 0.5, linearUpper: 1.5 }));
    expectClose(vertex(segments, 18), [0, -1.5, 0]);
    expectClose(vertex(segments, 19), [0, -0.5, 0]);
    expectClose(vertex(segments, 20), [-0.25, -1.5, -0.25]);
    expectClose(vertex(segments, 21), [0.25, -1.5, -0.25]);
  });

  it('draws one segment of half-length 0.5 for an axis whose linear limit is off', () => {
    const segments = sixDofJointSegments(sixDofLimits({ linearEnabled: false }));
    expect(segments.length / 3).toBe(2 + 2 * SIX_DOF_AXIS_VERTEX_COUNT);
    expectClose(vertex(segments, 0), [0.5, 0, 0]);
    expectClose(vertex(segments, 1), [-0.5, 0, 0]);
    expectClose(vertex(segments, 2), [0, 0, 0]);
  });

  it('draws the half-length segment where the negated lower limit is below the upper one', () => {
    const segments = sixDofJointSegments(sixDofLimits({ linearLower: 1, linearUpper: -1 }));
    expectClose(vertex(segments, 0), [0.5, 0, 0]);
    expectClose(vertex(segments, 1), [-0.5, 0, 0]);
  });
});

describe('the 6DOF circles of a body', () => {
  it('draws one segment along each axis for the default angular limits of 0 and 0', () => {
    const circles = sixDofBodySegments(UNROTATED_JOINT, SIDE_BODY, 'bodyA', SIX_DOF_DEFAULTS);
    expect(circles.length / 3).toBe(6);
    expectClose(vertex(circles, 1), [0.5, 0, 0]);
    expectClose(vertex(circles, 3), [0.353553, 0, -0.353553]);
    expectClose(vertex(circles, 5), [0.416025, 0.27735, 0]);
  });

  it('absorbs the rotation of the joint on every axis', () => {
    const a = sixDofBodySegments(ROTATED_ABOUT_Y, SIDE_BODY, 'bodyA', SIX_DOF_DEFAULTS);
    expectClose(vertex(a, 3), [0.491432, 0, -0.092169]);
    expectClose(vertex(a, 5), [0.450828, 0.216228, 0]);
    const b = sixDofBodySegments(ROTATED_ABOUT_Y, BODY_B_SIDE, 'bodyB', SIX_DOF_DEFAULTS);
    expectClose(vertex(b, 3), [-0.491432, 0, 0.092169]);
    expectClose(vertex(b, 5), [-0.486214, 0.1166, 0]);
  });

  it('draws the arcs of each axis in the form of its body and in the order X, Y, Z', () => {
    const limits = sixDofLimits(
      { angularLower: -0.5, angularUpper: 0.8 },
      { angularLower: -1, angularUpper: 1 },
      { angularEnabled: false, angularLower: 0.3, angularUpper: 0.3 }
    );
    const a = sixDofBodySegments(ROTATED_ABOUT_Y, SIDE_BODY, 'bodyA', limits);
    expect(a.length / 3).toBe(3 * CIRCLE_VERTEX_COUNT);
    expectClose(vertex(a, 0), [0, 0.160679, -0.191526]);
    expectClose(vertex(a, 40), [0, 0.248729, -0.025178]);
    expectClose(vertex(a, 64), [0, 0.227528, 0.103591]);
    expectClose(vertex(a, 70), [0.17154, 0, 0.181863]);
    expectClose(vertex(a, 110), [0.232819, 0, -0.091079]);
    expectClose(vertex(a, 140), [-0.225414, -0.108114, 0]);
    const b = sixDofBodySegments(ROTATED_ABOUT_Y, BODY_B_SIDE, 'bodyB', limits);
    expectClose(vertex(b, 0), [0, 0.106901, 0.247936]);
    expectClose(vertex(b, 40), [0, 0.249536, 0.103111]);
    expectClose(vertex(b, 70), [-0.101501, 0, 0.250195]);
    expectClose(vertex(b, 110), [-0.269999, 0, -0.000567]);
    expectClose(vertex(b, 140), [0.262556, -0.062964, 0]);
  });

  it('draws a full circle for a lower limit above the upper one', () => {
    const limits = sixDofLimits({}, {}, { angularLower: 1, angularUpper: -0.5 });
    const a = sixDofBodySegments(UNROTATED_JOINT, SIDE_BODY, 'bodyA', limits);
    expectClose(vertex(a, 4), [-0.208013, -0.138675, 0]);
    const b = sixDofBodySegments(UNROTATED_JOINT, BODY_B_SIDE, 'bodyB', limits);
    expectClose(vertex(b, 4), [0.256144, -0.085382, 0]);
  });
});
