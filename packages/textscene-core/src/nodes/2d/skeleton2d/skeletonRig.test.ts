/** The Skeleton2D rig pass over the Live scene tree (`skeleton_2d.cpp:548-570`). */

import { describe, expect, it } from 'vitest';
import { TscnParser } from '../../../parser/TscnParser';
import { liveTreeOf } from '../../../r3f/liveSceneTree';
import { contextOver } from '../../../r3f/liveSceneTree.testkit';
import { bindSkeleton2DRigs, skeletonOfBone, type Skeleton2DRig } from './skeletonRig';
import './index';
import '../bone2d/index';

const SCENE = `[gd_scene format=3]
[node name="Root" type="Node2D"]
[node name="Skeleton" type="Skeleton2D" parent="."]
[node name="Upper" type="Bone2D" parent="Skeleton"]
rest = Transform2D(1, 0, 0, 1, 0, 0)
[node name="Lower" type="Bone2D" parent="Skeleton/Upper"]
position = Vector2(30, 40)
rest = Transform2D(1, 0, 0, 1, 100, 0)
[node name="Free" type="Bone2D" parent="Skeleton/Upper/Lower"]
rotation = 0.5
length = 24.0
[node name="Stored" type="Bone2D" parent="Skeleton"]
auto_calculate_length_and_angle = false
length = 70.0
bone_angle = 90.0
[node name="Sprite" type="Node2D" parent="Skeleton"]
[node name="Loose" type="Bone2D" parent="Skeleton/Sprite"]
`;

function liveTree() {
  const main = new TscnParser().parse(SCENE);
  return liveTreeOf(main.nodes, contextOver(main, {}));
}

function rig(): Skeleton2DRig {
  return bindSkeleton2DRigs(liveTree()).get('Root/Skeleton')!;
}

describe('bindSkeleton2DRigs', () => {
  it('lists the bones of the skeleton in tree order, and no Bone2D below a node of another type', () => {
    expect(rig().bones.map((bone) => bone.path)).toEqual([
      'Root/Skeleton/Upper',
      'Root/Skeleton/Upper/Lower',
      'Root/Skeleton/Upper/Lower/Free',
      'Root/Skeleton/Stored',
    ]);
    expect(rig().indexOf.get('Root/Skeleton/Stored')).toBe(3);
  });

  it('gives each bone the index of its parent bone, and -1 on the skeleton', () => {
    expect(rig().bones.map((bone) => bone.parent)).toEqual([-1, 0, 1, -1]);
  });

  it('inverts the rest each bone composes down the chain', () => {
    const { a, b, c, d, tx, ty } = rig().bones[1]!.restInverse;
    expect([a, b, c, d, tx, ty].map((value) => value + 0)).toEqual([1, 0, 0, 1, -100, 0]);
  });

  it('leaves a singular rest uninverted, as affine_invert does', () => {
    // The unset rest of Free zeroes the basis, and its parent's rest still carries the origin.
    expect(rig().bones[2]!.restInverse).toEqual({ a: 0, b: 0, c: 0, d: 0, tx: 100, ty: 0 });
  });

  it('reads the reach of a bone from its first Bone2D child', () => {
    const { length, angle } = rig().bones[0]!.reach;
    expect(length).toBeCloseTo(50, 6);
    expect(angle).toBeCloseTo(Math.atan2(40, 30), 6);
  });

  it('keeps the stored length and takes the rotation as the angle for a bone with no Bone2D child', () => {
    expect(rig().bones[2]!.reach).toEqual({ length: 24, angle: 0.5 });
  });

  it('keeps the stored reach of a bone that does not calculate', () => {
    const { length, angle } = rig().bones[3]!.reach;
    expect(length).toBe(70);
    expect(angle).toBeCloseTo(Math.PI / 2, 6);
  });
});

describe('skeletonOfBone', () => {
  it('names the skeleton a chain of Bone2D parents ends at', () => {
    expect(skeletonOfBone('Root/Skeleton/Upper/Lower', liveTree())).toBe('Root/Skeleton');
  });

  it('names none for a bone below a node of another type', () => {
    expect(skeletonOfBone('Root/Skeleton/Sprite/Loose', liveTree())).toBeNull();
  });
});
