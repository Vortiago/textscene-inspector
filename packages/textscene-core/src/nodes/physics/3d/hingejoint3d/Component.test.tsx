/**
 * <HingeJoint3D> draws its axis in the joint colour and one circle around Z per resolved body, faint
 * while unselected (`joint_3d_gizmo_plugin.cpp:473-501`). The expected vertices come from a GDScript
 * port of `look_body_toward_z` and `draw_circle` that ran in Godot 4.6.3.
 */
import { describe, expect, it } from 'vitest';
import { describeGizmoToggle, describeInstantiatedGizmo } from '../../../../r3f/testing/gizmoContract';
import {
  BOTH_BODIES,
  describeJointBodyGating,
  drawnLines,
  jointGizmoCase,
  mountJointScene,
  twoBodyScene,
} from '../joint3d/jointScene.testkit';
import { EXPECTED_PART_COLOURS, expectClose, vertex } from '../joint3d/jointVertices.testkit';

const CIRCLE_VERTEX_COUNT = 70;
const SELECTED = 'Root/Joint';

const hingeScene = (joint: Record<string, string> = {}) =>
  twoBodyScene('HingeJoint3D', { ...BOTH_BODIES, ...joint });

describe('<HingeJoint3D> gizmo', () => {
  it('draws the axis, then the circle of body A and of body B, each in its colour at opacity 1 when selected', async () => {
    const lines = drawnLines(await mountJointScene({ nodes: hingeScene(), selectedPath: SELECTED }));
    expect(lines.map(({ color, opacity }) => ({ color, opacity }))).toEqual([
      { color: EXPECTED_PART_COLOURS.joint, opacity: 1 },
      { color: EXPECTED_PART_COLOURS.bodyA, opacity: 1 },
      { color: EXPECTED_PART_COLOURS.bodyB, opacity: 1 },
    ]);
    expect(lines[0]!.positions).toEqual([0, 0, 0.5, 0, 0, -0.5]);
  });

  it('draws at 0.3 of that opacity while unselected', async () => {
    const lines = drawnLines(await mountJointScene({ nodes: hingeScene() }));
    for (const { opacity } of lines) expect(opacity).toBeCloseTo(0.3, 10);
  });

  it('draws full circles at the defaults, where the limit is off', async () => {
    const [, bodyA] = drawnLines(await mountJointScene({ nodes: hingeScene() }));
    expect(bodyA!.positions.length / 3).toBe(CIRCLE_VERTEX_COUNT);
    expectClose(vertex(bodyA!.positions, 0), [-0.208013, -0.138675, 0]);
    expectClose(vertex(bodyA!.positions, 40), [0.095912, 0.23087, 0]);
    expectClose(vertex(bodyA!.positions, 64), [-0.208013, -0.138675, 0]);
  });

  it('draws full circles for limits that are authored while the limit is off', async () => {
    const off = drawnLines(await mountJointScene({ nodes: hingeScene() }));
    const authored = drawnLines(
      await mountJointScene({
        nodes: hingeScene({ 'angular_limit/lower': '-0.3', 'angular_limit/upper': '0.3' }),
      })
    );
    expect(authored[1]!.positions).toEqual(off[1]!.positions);
  });

  it('draws the arc between the limits for body B when the limit is on', async () => {
    const nodes = hingeScene({
      'angular_limit/enable': 'true',
      'angular_limit/lower': '-1.0471975',
      'angular_limit/upper': '1.0471975',
    });
    const [, , bodyB] = drawnLines(await mountJointScene({ nodes }));
    expectClose(vertex(bodyB!.positions, 0), [-0.05413, 0.264518, 0]);
    expectClose(vertex(bodyB!.positions, 3), [-0.071314, 0.260412, 0]);
    expectClose(vertex(bodyB!.positions, 40), [-0.26788, 0.03377, 0]);
    expectClose(vertex(bodyB!.positions, 64), [-0.202015, -0.179137, 0]);
  });

  it('draws one segment for equal limits when the limit is on', async () => {
    const nodes = hingeScene({
      'angular_limit/enable': 'true',
      'angular_limit/lower': '0.0',
      'angular_limit/upper': '0.0',
    });
    const [, bodyA] = drawnLines(await mountJointScene({ nodes }));
    expect(bodyA!.positions).toHaveLength(6);
  });
});

describeJointBodyGating('<HingeJoint3D>', 'HingeJoint3D', {
  both: ['joint', 'bodyA', 'bodyB'],
  onlyA: ['joint', 'bodyA'],
  onlyB: ['joint', 'bodyB'],
});

const GIZMO_CASE = jointGizmoCase('HingeJoint3D', {});
describeGizmoToggle('<HingeJoint3D>', GIZMO_CASE);
describeInstantiatedGizmo('<HingeJoint3D>', GIZMO_CASE);
