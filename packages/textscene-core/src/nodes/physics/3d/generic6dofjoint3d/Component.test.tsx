/**
 * <Generic6DOFJoint3D> draws the travel of its three axes in the joint colour and three circles per
 * resolved body, faint while unselected (`joint_3d_gizmo_plugin.cpp:582-723`). The vertices themselves
 * are pinned against a Godot 4.6.3 port in `jointGizmoDrawer.test.ts`, so these tests check the wiring:
 * the keys, the bodies and the lines reach the drawer's own output.
 */
import { describe, expect, it } from 'vitest';
import { identityTransform3D } from '../../../../godot/math/transform3d';
import { describeGizmoToggle, describeInstantiatedGizmo } from '../../../../r3f/testing/gizmoContract';
import {
  BOTH_BODIES,
  drawnGeometries,
  drawnLines,
  jointGizmoCase,
  mountJointScene,
  twoBodyScene,
  updateJointScene,
} from '../joint3d/jointScene.testkit';
import { describeJointBodyGating } from '../joint3d/jointBodyGating.testkit';
import { sixDofBodySegments, sixDofJointSegments, type SixDofLimits } from '../joint3d/jointGizmoDrawer';
import { EXPECTED_PART_COLOURS, TWO_BODY_TRANSFORMS } from '../joint3d/jointVertices.testkit';

const SELECTED = 'Root/Joint';
const { joint, bodyA, bodyB } = TWO_BODY_TRANSFORMS;

const DEFAULT_AXIS = {
  linearEnabled: true,
  linearLower: 0,
  linearUpper: 0,
  angularEnabled: true,
  angularLower: 0,
  angularUpper: 0,
};
const DEFAULT_LIMITS: SixDofLimits = [DEFAULT_AXIS, DEFAULT_AXIS, DEFAULT_AXIS];

/** Scene keys that set every limit away from its default, and the limits they must reach the drawer as. */
const AUTHORED_KEYS = {
  'linear_limit_x/enabled': 'false',
  'linear_limit_x/lower_distance': '-0.5',
  'linear_limit_x/upper_distance': '1.5',
  'angular_limit_x/lower_angle': '-0.5',
  'angular_limit_x/upper_angle': '0.8',
  'linear_limit_y/lower_distance': '0.5',
  'linear_limit_y/upper_distance': '1.5',
  'angular_limit_y/lower_angle': '-1.0',
  'angular_limit_y/upper_angle': '1.0',
  'linear_limit_z/lower_distance': '2',
  'angular_limit_z/enabled': 'false',
  'angular_limit_z/lower_angle': '0.3',
};
const AUTHORED_LIMITS: SixDofLimits = [
  {
    linearEnabled: false,
    linearLower: -0.5,
    linearUpper: 1.5,
    angularEnabled: true,
    angularLower: -0.5,
    angularUpper: 0.8,
  },
  { ...DEFAULT_AXIS, linearLower: 0.5, linearUpper: 1.5, angularLower: -1, angularUpper: 1 },
  { ...DEFAULT_AXIS, linearLower: 2, angularEnabled: false, angularLower: 0.3 },
];

const sixDofScene = (joint: Record<string, string> = {}) =>
  twoBodyScene('Generic6DOFJoint3D', { ...BOTH_BODIES, ...joint });

const drawn = async (properties: Record<string, string> = {}) =>
  drawnLines(await mountJointScene({ nodes: sixDofScene(properties) })).map(({ positions }) => positions);

/** The positions the drawer builds for a joint with two bodies. */
function expectedPositions(limits: SixDofLimits) {
  return [
    Array.from(sixDofJointSegments(limits)),
    Array.from(sixDofBodySegments(joint, bodyA, 'bodyA', limits)),
    Array.from(sixDofBodySegments(joint, bodyB, 'bodyB', limits)),
  ];
}

describe('<Generic6DOFJoint3D> gizmo', () => {
  it('draws the travel, then the circles of body A and of body B, each in its colour at opacity 1 when selected', async () => {
    const lines = drawnLines(await mountJointScene({ nodes: sixDofScene(), selectedPath: SELECTED }));
    expect(lines.map(({ color, opacity }) => ({ color, opacity }))).toEqual([
      { color: EXPECTED_PART_COLOURS.joint, opacity: 1 },
      { color: EXPECTED_PART_COLOURS.bodyA, opacity: 1 },
      { color: EXPECTED_PART_COLOURS.bodyB, opacity: 1 },
    ]);
  });

  it('draws the drawer output for Godot defaults where no key is authored', async () => {
    expect(await drawn()).toEqual(expectedPositions(DEFAULT_LIMITS));
  });

  it('reads the limit keys of each axis into the drawer', async () => {
    expect(await drawn(AUTHORED_KEYS)).toEqual(expectedPositions(AUTHORED_LIMITS));
  });

  it('draws body B toward the world origin for node_a alone, as Godot passes it an identity transform', async () => {
    const nodes = twoBodyScene('Generic6DOFJoint3D', { node_a: BOTH_BODIES.node_a });
    const [, positionsA, positionsB] = drawnLines(await mountJointScene({ nodes })).map(
      (line) => line.positions
    );
    expect(positionsA).toEqual(Array.from(sixDofBodySegments(joint, bodyA, 'bodyA', DEFAULT_LIMITS)));
    expect(positionsB).toEqual(
      Array.from(sixDofBodySegments(joint, identityTransform3D(), 'bodyB', DEFAULT_LIMITS))
    );
  });

  it('keeps every line when an unrelated key is edited, since no limit changed', async () => {
    const renderer = await mountJointScene({ nodes: sixDofScene() });
    const before = drawnGeometries(renderer);
    await updateJointScene(renderer, { nodes: sixDofScene({ 'linear_motor_x/enabled': 'true' }) });
    const after = drawnGeometries(renderer);
    expect(after).toHaveLength(before.length);
    after.forEach((geometry, index) => expect(geometry).toBe(before[index]));
  });
});

describeJointBodyGating('<Generic6DOFJoint3D>', 'Generic6DOFJoint3D', {
  both: ['joint', 'bodyA', 'bodyB'],
  onlyA: ['joint', 'bodyA', 'bodyB'],
  onlyB: ['joint'],
});

const GIZMO_CASE = jointGizmoCase('Generic6DOFJoint3D', {});
describeGizmoToggle('<Generic6DOFJoint3D>', GIZMO_CASE);
describeInstantiatedGizmo('<Generic6DOFJoint3D>', GIZMO_CASE);
