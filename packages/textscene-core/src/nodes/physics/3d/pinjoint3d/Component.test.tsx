/**
 * <PinJoint3D> draws the pin cross for every node, faint while unselected, once either body
 * resolves (`joint_3d_gizmo_plugin.cpp:335-337`, `:462-471`). Bodies resolve in the live scene
 * tree, so every case mounts the whole scene.
 */
import { describe, expect, it } from 'vitest';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import { describeGizmoToggle, describeInstantiatedGizmo } from '../../../../r3f/testing/gizmoContract';
import { at, drawnLines, jointGizmoCase, mountJointScene, nodeText } from '../joint3d/jointScene.testkit';
import { pinJointSegments } from '../joint3d/jointGizmoDrawer';

const JOINT_COLOUR = godotColorToLinear({ r: 0.5, g: 0.8, b: 1 }).toArray();
const PIN_CROSS = Array.from(pinJointSegments());

function pinScene(joint: Record<string, string>, ...bodies: string[]) {
  return [
    nodeText('Joint', 'PinJoint3D', '.', { transform: at(0.5, 0, 0.5), ...joint }),
    nodeText('BodyA', 'StaticBody3D', '.', { transform: at(2, 1, -1) }),
    nodeText('BodyB', 'StaticBody3D', '.', { transform: at(-1, 0.5, 2) }),
    ...bodies,
  ];
}

const BOTH = { node_a: 'NodePath("../BodyA")', node_b: 'NodePath("../BodyB")' };

describe('<PinJoint3D> cross', () => {
  it('draws three segments of half-length 0.25 in the joint colour at opacity 1 when selected', async () => {
    const lines = drawnLines(await mountJointScene({ nodes: pinScene(BOTH), selectedPath: 'Root/Joint' }));
    expect(lines).toEqual([{ color: JOINT_COLOUR, opacity: 1, positions: PIN_CROSS }]);
  });

  it('draws at 0.3 of that opacity while unselected', async () => {
    const [line] = drawnLines(await mountJointScene({ nodes: pinScene(BOTH) }));
    expect(line!.opacity).toBeCloseTo(0.3, 10);
  });

  it('draws with only node_a resolved', async () => {
    const lines = drawnLines(await mountJointScene({ nodes: pinScene({ node_a: BOTH.node_a }) }));
    expect(lines).toHaveLength(1);
  });

  it('draws nothing when neither body resolves', async () => {
    expect(drawnLines(await mountJointScene({ nodes: pinScene({}) }))).toEqual([]);
  });

  it('draws nothing for a path that names no node', async () => {
    const nodes = pinScene({ node_a: 'NodePath("../Nowhere")' });
    expect(drawnLines(await mountJointScene({ nodes }))).toEqual([]);
  });

  it('resolves a body inside an instanced scene', async () => {
    const header =
      '[gd_scene format=3]\n\n[ext_resource type="PackedScene" path="res://holder.tscn" id="1"]\n\n' +
      '[node name="Root" type="Node3D"]\n\n';
    const nodes = [
      nodeText('Joint', 'PinJoint3D', '.', { node_a: 'NodePath("../Holder/Inner/Body")' }),
      '[node name="Holder" parent="." instance=ExtResource("1")]\n',
    ];
    const holder =
      '[gd_scene format=3]\n\n[node name="Holder" type="Node3D"]\n\n' +
      nodeText('Inner', 'Node3D', '.') +
      nodeText('Body', 'StaticBody3D', 'Inner');
    const lines = drawnLines(
      await mountJointScene({ header, nodes, files: { 'res://holder.tscn': holder } })
    );
    expect(lines).toHaveLength(1);
  });

  it('draws nothing when the path names a node that is no Node3D', async () => {
    const nodes = [
      nodeText('Joint', 'PinJoint3D', '.', { node_a: 'NodePath("../Plain")' }),
      nodeText('Plain', 'Node', '.'),
    ];
    expect(drawnLines(await mountJointScene({ nodes }))).toEqual([]);
  });
});

const GIZMO_CASE = jointGizmoCase('PinJoint3D', {});
describeGizmoToggle('<PinJoint3D>', GIZMO_CASE);
describeInstantiatedGizmo('<PinJoint3D>', GIZMO_CASE);
