/**
 * <PinJoint3D> draws the pin cross for every node, faint while unselected, once either body
 * resolves (`joint_3d_gizmo_plugin.cpp:335-337`, `:462-471`). Bodies resolve in the live scene
 * tree, so every case mounts the whole scene.
 */
import { describe, expect, it } from 'vitest';
import { describeGizmoToggle, describeInstantiatedGizmo } from '../../../../r3f/testing/gizmoContract';
import {
  BOTH_BODIES,
  drawnLines,
  jointGizmoCase,
  mountJointScene,
  nodeText,
  twoBodyScene,
} from '../joint3d/jointScene.testkit';
import { describeJointBodyGating } from '../joint3d/jointBodyGating.testkit';
import { EXPECTED_PART_COLOURS } from '../joint3d/jointVertices.testkit';
import { pinJointSegments } from '../joint3d/jointGizmoDrawer';

const JOINT_COLOUR = EXPECTED_PART_COLOURS.joint;
const PIN_CROSS = Array.from(pinJointSegments());

const pinScene = (joint: Record<string, string>) => twoBodyScene('PinJoint3D', joint);

describe('<PinJoint3D> cross', () => {
  it('draws three segments of half-length 0.25 in the joint colour at opacity 1 when selected', async () => {
    const lines = drawnLines(
      await mountJointScene({ nodes: pinScene(BOTH_BODIES), selectedPath: 'Root/Joint' })
    );
    expect(lines).toEqual([{ color: JOINT_COLOUR, opacity: 1, positions: PIN_CROSS }]);
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
});

describeJointBodyGating('<PinJoint3D>', 'PinJoint3D', {
  both: ['joint'],
  onlyA: ['joint'],
  onlyB: ['joint'],
});

const GIZMO_CASE = jointGizmoCase('PinJoint3D', {});
describeGizmoToggle('<PinJoint3D>', GIZMO_CASE);
describeInstantiatedGizmo('<PinJoint3D>', GIZMO_CASE);
