/**
 * <SliderJoint3D> draws its travel in the joint colour and one circle around X per resolved body,
 * faint while unselected (`joint_3d_gizmo_plugin.cpp:503-560`). The expected vertices come from a
 * GDScript port of `look_body_toward_x` and `draw_circle` that ran in Godot 4.6.3.
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

const CIRCLE_VERTEX_COUNT = 70;
const TRAVEL_WITH_SQUARES_VERTEX_COUNT = 20;
const SELECTED = 'Root/Joint';

const sliderScene = (joint: Record<string, string> = {}) =>
  twoBodyScene('SliderJoint3D', { ...BOTH_BODIES, ...joint });

describe('<SliderJoint3D> gizmo', () => {
  it('draws the travel, then the circle of body A and of body B, each in its colour at opacity 1 when selected', async () => {
    const nodes = sliderScene({ 'angular_limit/lower_angle': '-0.5', 'angular_limit/upper_angle': '0.8' });
    const lines = drawnLines(await mountJointScene({ nodes, selectedPath: SELECTED }));
    expect(lines.map(({ color, opacity }) => ({ color, opacity }))).toEqual([
      { color: EXPECTED_PART_COLOURS.joint, opacity: 1 },
      { color: EXPECTED_PART_COLOURS.bodyA, opacity: 1 },
      { color: EXPECTED_PART_COLOURS.bodyB, opacity: 1 },
    ]);
  });

  it('draws the travel with a square at each end, and one segment along X per body, at the defaults', async () => {
    const [travel, bodyA, bodyB] = drawnLines(await mountJointScene({ nodes: sliderScene() }));
    expect(travel!.positions.length / 3).toBe(TRAVEL_WITH_SQUARES_VERTEX_COUNT);
    expectClose(vertex(travel!.positions, 2), [-1, 0, 0]);
    expectClose(vertex(travel!.positions, 3), [1, 0, 0]);
    expect(bodyA!.positions).toEqual([0, 0, 0, 0.5, 0, 0]);
    expect(bodyB!.positions).toEqual([0, 0, 0, 0.5, 0, 0]);
  });

  it('draws both squares at -0.5 for both linear limits at 0.5', async () => {
    const nodes = sliderScene({
      'linear_limit/upper_distance': '0.5',
      'linear_limit/lower_distance': '0.5',
    });
    const [travel] = drawnLines(await mountJointScene({ nodes }));
    expect(travel!.positions.length / 3).toBe(TRAVEL_WITH_SQUARES_VERTEX_COUNT);
    expectClose(vertex(travel!.positions, 2), [-0.5, 0, 0]);
    expectClose(vertex(travel!.positions, 12), [-0.5, -0.25, -0.25]);
  });

  it('draws the arcs between the angular limits, with the inverse form for body B', async () => {
    const nodes = sliderScene({ 'angular_limit/lower_angle': '-0.5', 'angular_limit/upper_angle': '0.8' });
    const [, bodyA, bodyB] = drawnLines(await mountJointScene({ nodes }));
    expect(bodyA!.positions.length / 3).toBe(CIRCLE_VERTEX_COUNT);
    expectClose(vertex(bodyA!.positions, 0), [0, 0.221425, -0.116064]);
    expectClose(vertex(bodyA!.positions, 40), [0, 0.077722, -0.237612]);
    expectClose(vertex(bodyA!.positions, 64), [0, -0.052603, -0.244403]);
    expectClose(vertex(bodyB!.positions, 0), [0, 0.197732, 0.183854]);
    expectClose(vertex(bodyB!.positions, 40), [0, 0.013461, 0.269664]);
    expectClose(vertex(bodyB!.positions, 64), [0, -0.124261, 0.239707]);
  });
});

describeJointBodyGating('<SliderJoint3D>', 'SliderJoint3D', {
  both: ['joint', 'bodyA', 'bodyB'],
  onlyA: ['joint', 'bodyA'],
  onlyB: ['joint', 'bodyB'],
});

const GIZMO_CASE = jointGizmoCase('SliderJoint3D', {});
describeGizmoToggle('<SliderJoint3D>', GIZMO_CASE);
describeInstantiatedGizmo('<SliderJoint3D>', GIZMO_CASE);
