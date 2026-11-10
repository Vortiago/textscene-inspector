/**
 * The Bone2D children Godot draws a kite to are the ones its `Object::cast_to<Bone2D>` finds
 * (`skeleton_2d.cpp:223-228`), and an instance whose scene root is a Bone2D casts to one.
 */

import { describe, expect, it } from 'vitest';
import { TscnParser } from '../../../parser/TscnParser';
import { liveTreeOf } from '../../../r3f/liveSceneTree';
import { contextOver } from '../../../r3f/liveSceneTree.testkit';
import { bindBoneChildren } from './boneChildren';
import '../../../r3f/nodes/index';

const CHILD_SCENE = `[gd_scene format=3]
[node name="Hand" type="Bone2D"]
[node name="Finger" type="Bone2D" parent="."]
`;

const ROOT_SCENE = `[gd_scene load_steps=2 format=3]
[ext_resource type="PackedScene" path="res://hand.tscn" id="1_hand"]
[node name="Root" type="Node2D"]
[node name="Arm" type="Bone2D" parent="."]
[node name="Forearm" type="Bone2D" parent="Arm"]
[node name="Hand" parent="Arm" instance=ExtResource("1_hand")]
[node name="Marker" type="Marker2D" parent="Arm"]
[node name="Bystander" type="Node2D" parent="."]
[node name="Stray" type="Bone2D" parent="Bystander"]
`;

describe('bindBoneChildren', () => {
  const tree = () => {
    const main = new TscnParser().parse(ROOT_SCENE);
    const hand = new TscnParser().parse(CHILD_SCENE);
    return liveTreeOf(main.nodes, contextOver(main, { 'res://hand.tscn': hand }));
  };

  it('lists the Bone2D children of a bone in order, an instance root among them', () => {
    expect(bindBoneChildren(tree()).get('Root/Arm')?.children).toEqual(['Root/Arm/Forearm', 'Root/Arm/Hand']);
  });

  it('lists the Bone2D child inside an instance', () => {
    expect(bindBoneChildren(tree()).get('Root/Arm/Hand')?.children).toEqual(['Root/Arm/Hand/Finger']);
  });

  it('lists no child for a leaf bone, and none under a node that is not a Bone2D', () => {
    expect(bindBoneChildren(tree()).get('Root/Arm/Forearm')?.children).toEqual([]);
    expect(bindBoneChildren(tree()).has('Root/Bystander/Stray')).toBe(true);
    expect(bindBoneChildren(tree()).has('Root/Bystander')).toBe(false);
  });

  // Godot makes the gizmo canvas item of a bone on its first draw, after the items of its children
  // exist, so a bone's kite draws after every kite below it and after the kites of earlier siblings.
  it('orders the kites children first, then parents, siblings in tree order', () => {
    const order = (path: string) => bindBoneChildren(tree()).get(path)!.drawOrder;
    expect(order('Root/Arm/Forearm')).toBeLessThan(order('Root/Arm/Hand/Finger'));
    expect(order('Root/Arm/Hand/Finger')).toBeLessThan(order('Root/Arm/Hand'));
    expect(order('Root/Arm/Hand')).toBeLessThan(order('Root/Arm'));
    expect(order('Root/Arm')).toBeLessThan(order('Root/Bystander/Stray'));
    expect(order('Root/Arm/Forearm')).toBeGreaterThan(0);
    expect(order('Root/Bystander/Stray')).toBeLessThan(1);
  });
});
