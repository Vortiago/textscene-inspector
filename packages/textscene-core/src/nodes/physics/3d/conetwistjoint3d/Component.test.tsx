/**
 * <ConeTwistJoint3D> draws one swing cone and twist spiral per resolved body, in the colour of that
 * body and faint while unselected (`joint_3d_gizmo_plugin.cpp:562-580`). The expected vertices
 * come from a GDScript port of `look_body` and `draw_cone` that ran in Godot 4.6.3.
 */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import { describeGizmoToggle, describeInstantiatedGizmo } from '../../../../r3f/testing/gizmoContract';
import { at, drawnLines, jointGizmoCase, mountJointScene, nodeText } from '../joint3d/jointScene.testkit';

const BODY_A_COLOUR = godotColorToLinear({ r: 0.6, g: 0.8, b: 1 }).toArray();
const BODY_B_COLOUR = godotColorToLinear({ r: 0.6, g: 0.9, b: 1 }).toArray();

/** The swing circle, its spokes and the X axis: 82 vertices, then 72 for a twist of PI. */
const DEFAULT_VERTEX_COUNT = 154;
const SELECTED = 'Root/Joint';

function coneScene(joint: Record<string, string>) {
  return [
    nodeText('Joint', 'ConeTwistJoint3D', '.', { transform: at(0.5, 0, 0.5), ...joint }),
    nodeText('BodyA', 'StaticBody3D', '.', { transform: at(2, 1, -1) }),
    nodeText('BodyB', 'StaticBody3D', '.', { transform: at(-1, 0.5, 2) }),
  ];
}

const BOTH = { node_a: 'NodePath("../BodyA")', node_b: 'NodePath("../BodyB")' };

function vertex(positions: number[], index: number): number[] {
  return positions.slice(index * 3, index * 3 + 3);
}

function expectClose(actual: number[], expected: number[]) {
  expected.forEach((value, index) => expect(actual[index]).toBeCloseTo(value, 5));
}

describe('<ConeTwistJoint3D> cones', () => {
  it('draws one cone per body, body A in its colour then body B in its own, at opacity 1 when selected', async () => {
    const lines = drawnLines(await mountJointScene({ nodes: coneScene(BOTH), selectedPath: SELECTED }));
    expect(lines.map(({ color, opacity }) => ({ color, opacity }))).toEqual([
      { color: BODY_A_COLOUR, opacity: 1 },
      { color: BODY_B_COLOUR, opacity: 1 },
    ]);
    expect(lines.map(({ positions }) => positions.length / 3)).toEqual([
      DEFAULT_VERTEX_COUNT,
      DEFAULT_VERTEX_COUNT,
    ]);
  });

  it('draws no line in the joint colour', async () => {
    const lines = drawnLines(await mountJointScene({ nodes: coneScene(BOTH) }));
    expect(lines.map(({ color }) => color)).not.toContainEqual(
      godotColorToLinear({ r: 0.5, g: 0.8, b: 1 }).toArray()
    );
  });

  it('draws at 0.3 of that opacity while unselected', async () => {
    const lines = drawnLines(await mountJointScene({ nodes: coneScene(BOTH) }));
    for (const { opacity } of lines) expect(opacity).toBeCloseTo(0.3, 10);
  });

  it("follows each body with Godot's default spans, PI / 4 and PI", async () => {
    const [bodyA] = drawnLines(await mountJointScene({ nodes: coneScene(BOTH) }));
    expectClose(vertex(bodyA!.positions, 1), [0.907649, 0.412577, 0.077159]);
    expectClose(vertex(bodyA!.positions, 40), [-0.047733, 0.301511, -0.952267]);
    expectClose(vertex(bodyA!.positions, 81), [0.639602, 0.426401, -0.639602]);
    expectClose(vertex(bodyA!.positions, 153), [0.034901, 0.1066, -0.284901]);
  });

  it('follows authored spans, with the twist capped at 720 degrees', async () => {
    const nodes = coneScene({ ...BOTH, swing_span: '0.5236', twist_span: '13.0' });
    const [bodyA] = drawnLines(await mountJointScene({ nodes }));
    expect(bodyA!.positions.length / 3).toBe(370);
  });

  it('draws only the cone of body A when only node_a resolves', async () => {
    const lines = drawnLines(await mountJointScene({ nodes: coneScene({ node_a: BOTH.node_a }) }));
    expect(lines.map(({ color }) => color)).toEqual([BODY_A_COLOUR]);
  });

  it('draws only the cone of body B when only node_b resolves', async () => {
    const lines = drawnLines(await mountJointScene({ nodes: coneScene({ node_b: BOTH.node_b }) }));
    expect(lines.map(({ color }) => color)).toEqual([BODY_B_COLOUR]);
  });

  it('draws nothing when neither body resolves', async () => {
    expect(drawnLines(await mountJointScene({ nodes: coneScene({}) }))).toEqual([]);
  });

  it('turns the cone bases with a rotated ancestor, as look_body crosses with the world up', async () => {
    const header =
      '[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n' +
      `transform = Transform3D(1, 0, 0, 0, ${Math.cos(0.5)}, ${-Math.sin(0.5)}, 0, ${Math.sin(0.5)}, ${Math.cos(0.5)}, 0, 0, 0)\n\n`;
    const [bodyA] = drawnLines(await mountJointScene({ header, nodes: coneScene(BOTH) }));
    expectClose(vertex(bodyA!.positions, 1), [0.718566, 0.691507, 0.07403]);
    expectClose(vertex(bodyA!.positions, 40), [0.107729, 0.005471, -0.994165]);
    expectClose(vertex(bodyA!.positions, 153), [0.073766, 0.03259, -0.295375]);
  });

  it('redraws when a body moves, since an animation moves a node with no render of the joint', async () => {
    const renderer = await mountJointScene({ nodes: coneScene(BOTH) });
    const [before] = drawnLines(renderer);
    const body = renderer.scene.findByProps({ name: 'BodyA' }).instance as THREE.Object3D;
    body.position.set(-3, 0, 1);
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(1, 0.016);
    });
    const [after] = drawnLines(renderer);
    expect(after!.positions).not.toEqual(before!.positions);
  });
});

const GIZMO_CASE = jointGizmoCase('ConeTwistJoint3D', {});
describeGizmoToggle('<ConeTwistJoint3D>', GIZMO_CASE);
describeInstantiatedGizmo('<ConeTwistJoint3D>', GIZMO_CASE);
