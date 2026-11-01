/**
 * <Generic6DOFJoint3D> draws the travel of its three axes in the joint colour and three circles per
 * resolved body, faint while unselected (`joint_3d_gizmo_plugin.cpp:582-723`). The expected vertices come
 * from a GDScript port that ran in Godot 4.6.3 (`/mnt/project-files/joint-1009/oracle.gd`).
 */
import { describe, expect, it } from 'vitest';
import { describeGizmoToggle, describeInstantiatedGizmo } from '../../../../r3f/testing/gizmoContract';
import {
  BOTH_BODIES,
  drawnLines,
  jointGizmoCase,
  mountJointScene,
  twoBodyScene,
} from '../joint3d/jointScene.testkit';
import { describeJointBodyGating } from '../joint3d/jointBodyGating.testkit';
import { EXPECTED_PART_COLOURS, expectClose, vertex } from '../joint3d/jointVertices.testkit';

const TRAVEL_VERTEX_COUNT = 54;
const CIRCLE_VERTEX_COUNT = 70;
const SELECTED = 'Root/Joint';

const sixDofScene = (joint: Record<string, string> = {}) =>
  twoBodyScene('Generic6DOFJoint3D', { ...BOTH_BODIES, ...joint });

const drawn = async (joint: Record<string, string> = {}) =>
  drawnLines(await mountJointScene({ nodes: sixDofScene(joint) }));

describe('<Generic6DOFJoint3D> gizmo', () => {
  it('draws the travel, then the circles of body A and of body B, each in its colour at opacity 1 when selected', async () => {
    const nodes = sixDofScene();
    const lines = drawnLines(await mountJointScene({ nodes, selectedPath: SELECTED }));
    expect(lines.map(({ color, opacity }) => ({ color, opacity }))).toEqual([
      { color: EXPECTED_PART_COLOURS.joint, opacity: 1 },
      { color: EXPECTED_PART_COLOURS.bodyA, opacity: 1 },
      { color: EXPECTED_PART_COLOURS.bodyB, opacity: 1 },
    ]);
  });

  it('draws a square at the origin and one segment toward each body per axis at the defaults', async () => {
    const [travel, bodyA, bodyB] = await drawn();
    expect(travel!.positions.length / 3).toBe(TRAVEL_VERTEX_COUNT);
    expectClose(vertex(travel!.positions, 2), [0, -0.25, -0.25]);
    expectClose(vertex(travel!.positions, 20), [-0.25, 0, -0.25]);
    expectClose(vertex(travel!.positions, 38), [-0.25, -0.25, 0]);
    expectClose(
      bodyA!.positions,
      [0, 0, 0, 0.5, 0, 0, 0, 0, 0, 0.353553, 0, -0.353553, 0, 0, 0, 0.416025, 0.27735, 0]
    );
    expectClose(
      bodyB!.positions,
      [0, 0, 0, 0.5, 0, 0, 0, 0, 0, -0.353553, 0, 0.353553, 0, 0, 0, -0.474342, 0.158114, 0]
    );
  });

  it('draws the X travel between -1 and 1 for the limits of -1 and 1', async () => {
    const [travel] = await drawn({
      'linear_limit_x/lower_distance': '-1',
      'linear_limit_x/upper_distance': '1',
    });
    expectClose(vertex(travel!.positions, 0), [-1, 0, 0]);
    expectClose(vertex(travel!.positions, 1), [1, 0, 0]);
    expectClose(vertex(travel!.positions, 10), [1, -0.25, -0.25]);
  });

  it('draws a segment of half-length 0.5 for an axis whose linear limit is off', async () => {
    const [travel] = await drawn({
      'linear_limit_x/enabled': 'false',
      'linear_limit_x/lower_distance': '-1',
      'linear_limit_x/upper_distance': '1',
    });
    expect(travel!.positions.length / 3).toBe(38);
    expectClose(vertex(travel!.positions, 0), [0.5, 0, 0]);
    expectClose(vertex(travel!.positions, 1), [-0.5, 0, 0]);
  });

  it('draws the arcs of each axis, with the angular limit off on Z as a full circle', async () => {
    const [travel, bodyA, bodyB] = await drawn({
      'angular_limit_x/lower_angle': '-0.5',
      'angular_limit_x/upper_angle': '0.8',
      'linear_limit_y/lower_distance': '0.5',
      'linear_limit_y/upper_distance': '1.5',
      'angular_limit_y/lower_angle': '-1.0',
      'angular_limit_y/upper_angle': '1.0',
      'angular_limit_z/enabled': 'false',
      'angular_limit_z/lower_angle': '0.3',
      'angular_limit_z/upper_angle': '0.3',
    });
    expectClose(vertex(travel!.positions, 18), [0, -1.5, 0]);
    expectClose(vertex(travel!.positions, 19), [0, -0.5, 0]);
    expect(bodyA!.positions.length / 3).toBe(3 * CIRCLE_VERTEX_COUNT);
    expectClose(vertex(bodyA!.positions, 0), [0, 0.021972, -0.249033]);
    expectClose(vertex(bodyA!.positions, 40), [0, 0.189441, -0.163133]);
    expectClose(vertex(bodyA!.positions, 70), [0.244265, 0, 0.05324]);
    expectClose(vertex(bodyA!.positions, 110), [0.140727, 0, -0.20663]);
    expectClose(vertex(bodyA!.positions, 140), [-0.208013, -0.138675, 0]);
    expectClose(vertex(bodyB!.positions, 0), [0, -0.047873, 0.265722]);
    expectClose(vertex(bodyB!.positions, 70), [0.057499, 0, 0.263807]);
    expectClose(vertex(bodyB!.positions, 110), [-0.223161, 0, 0.151985]);
    expectClose(vertex(bodyB!.positions, 140), [0.256144, -0.085382, 0]);
  });
});

describe('<Generic6DOFJoint3D> with a single body', () => {
  it('draws body B toward the world origin for node_a alone, as Godot passes it an identity transform', async () => {
    const nodes = twoBodyScene('Generic6DOFJoint3D', { node_a: BOTH_BODIES.node_a });
    const [, bodyA, bodyB] = drawnLines(await mountJointScene({ nodes }));
    expectClose(
      bodyA!.positions,
      [0, 0, 0, 0.5, 0, 0, 0, 0, 0, 0.353553, 0, -0.353553, 0, 0, 0, 0.416025, 0.27735, 0]
    );
    expectClose(
      bodyB!.positions,
      [0, 0, 0, 0.5, 0, 0, 0, 0, 0, -0.353553, 0, -0.353553, 0, 0, 0, -0.5, 0, 0]
    );
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
