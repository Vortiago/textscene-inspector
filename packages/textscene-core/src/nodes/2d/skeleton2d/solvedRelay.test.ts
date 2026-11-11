/**
 * A RemoteTransform2D below a Bone2D that a modification stack turns moves its target with the
 * solved pose (`skeleton_2d.cpp:786-796` sets the bone transform, `remote_transform_2d.cpp:127-136`
 * pushes it). The numbers are the ones `pnpm ref:diff` found on Godot 4.6.3 for the scene of the issue.
 */

import { describe, expect, it } from 'vitest';
import { liveScenePassResults } from '../../../r3f/liveScenePass';
import { liveTreeOfText } from '../../../r3f/liveSceneTree.testkit';
import { liveNodePatches } from '../../../r3f/liveNodePatches';

/** The arm of `unit-skeleton2d-lookat.tscn` with a relay at its end, whose line `relayLines` extend. */
function armScene(relayLines = ''): string {
  return `[gd_scene format=3]
[sub_resource type="SkeletonModification2DLookAt" id="lookat"]
bone_index = 0
bone2d_node = NodePath("Arm")
target_nodepath = NodePath("../Target")

[sub_resource type="SkeletonModificationStack2D" id="stack"]
enabled = true
modification_count = 1
modifications/0 = SubResource("lookat")

[node name="Root" type="Node2D"]
[node name="Skeleton" type="Skeleton2D" parent="."]
position = Vector2(300, 150)
modification_stack = SubResource("stack")
[node name="Arm" type="Bone2D" parent="Skeleton"]
rest = Transform2D(1, 0, 0, 1, 0, 0)
auto_calculate_length_and_angle = false
length = 200.0
[node name="Hand" type="RemoteTransform2D" parent="Skeleton/Arm"]
position = Vector2(200, 0)
remote_path = NodePath("../../../Held")
${relayLines}
[node name="Held" type="Polygon2D" parent="."]
[node name="Target" type="Node2D" parent="."]
position = Vector2(300, 400)
`;
}

const LOOK_AT_ARM = armScene();

describe('the RemoteTransform2D pass below a solved bone', () => {
  it('puts the target at the end of the arm that the LookAt turns', () => {
    const patches = liveScenePassResults(liveNodePatches, liveTreeOfText(LOOK_AT_ARM));

    const held = patches.get('Root/Held') as { position: { x: number; y: number }; rotation: number };
    expect(held.position.x).toBeCloseTo(300, 2);
    expect(held.position.y).toBeCloseTo(350, 2);
    expect(held.rotation).toBeCloseTo(Math.PI / 2, 4);
  });

  it('leaves the stored transform of the bone to the inspector', () => {
    const patches = liveScenePassResults(liveNodePatches, liveTreeOfText(LOOK_AT_ARM));

    expect(patches.has('Root/Skeleton/Arm')).toBe(false);
  });

  it('keeps the target rotation where the relay does not update rotation', () => {
    const patches = liveScenePassResults(
      liveNodePatches,
      liveTreeOfText(armScene('update_rotation = false'))
    );

    const held = patches.get('Root/Held') as { position: { x: number; y: number }; rotation: number };
    expect(held.position.y).toBeCloseTo(350, 2);
    expect(held.rotation).toBeCloseTo(0, 6);
  });

  // A local relay copies its own local transform, which the turn of the bone above does not change.
  it('copies the local transform of a relay in local coordinates, whatever the bone does', () => {
    const patches = liveScenePassResults(
      liveNodePatches,
      liveTreeOfText(armScene('use_global_coordinates = false'))
    );

    const held = patches.get('Root/Held') as { position: { x: number; y: number }; rotation: number };
    expect(held.position).toEqual({ x: 200, y: 0 });
    expect(held.rotation).toBe(0);
  });

  it('solves the stack of an instanced skeleton in the scope of its own scene', () => {
    const rig = LOOK_AT_ARM.replace('[node name="Held" type="Polygon2D" parent="."]\n', '').replace(
      'remote_path = NodePath("../../../Held")',
      'remote_path = NodePath("../../../../Held")'
    );
    const host = `[gd_scene load_steps=2 format=3]
[ext_resource type="PackedScene" path="res://rig.tscn" id="1_rig"]
[node name="Host" type="Node2D"]
[node name="Rig" parent="." instance=ExtResource("1_rig")]
[node name="Held" type="Polygon2D" parent="."]
`;

    const patches = liveScenePassResults(liveNodePatches, liveTreeOfText(host, { 'res://rig.tscn': rig }));

    const held = patches.get('Host/Held') as { position: { x: number; y: number } };
    expect(held.position.x).toBeCloseTo(300, 2);
    expect(held.position.y).toBeCloseTo(350, 2);
  });

  it('solves a stack that a .tres file holds once the file is loaded', () => {
    const inFile = LOOK_AT_ARM.replace(
      /\[sub_resource type="SkeletonModificationStack2D"[\s\S]*?modifications\/0 = SubResource\("lookat"\)\n\n/,
      ''
    )
      .replace(
        '[gd_scene format=3]',
        '[gd_scene load_steps=2 format=3]\n[ext_resource type="Resource" path="res://stack.tres" id="1_stack"]'
      )
      .replace('SubResource("stack")', 'ExtResource("1_stack")');
    const stackFile = `[gd_resource type="SkeletonModificationStack2D" load_steps=2 format=3]
[ext_resource type="Resource" path="res://lookat.tres" id="1_look"]
[resource]
enabled = true
modification_count = 1
modifications/0 = ExtResource("1_look")
`;
    const lookAtFile = `[gd_resource type="SkeletonModification2DLookAt" format=3]
[resource]
bone_index = 0
bone2d_node = NodePath("Arm")
target_nodepath = NodePath("../Target")
`;

    const patches = liveScenePassResults(
      liveNodePatches,
      liveTreeOfText(inFile, {}, { 'res://stack.tres': stackFile, 'res://lookat.tres': lookAtFile })
    );

    const held = patches.get('Root/Held') as { position: { x: number; y: number } };
    expect(held.position.x).toBeCloseTo(300, 2);
    expect(held.position.y).toBeCloseTo(350, 2);
  });
});
