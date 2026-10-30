/** The global transform of a Node3D of the Live scene tree, where the instance borders do not break it. */

import { describe, expect, it } from 'vitest';
import { TscnParser } from '../parser/TscnParser';
import { liveTreeOf } from './liveSceneTree';
import { contextOver } from './liveSceneTree.testkit';
import { liveGlobalTransform3D } from './liveGlobalTransform';
import '../nodes/base/node3d/index';

const SCENE = `[gd_scene format=3]
[node name="Root" type="Node3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0)
[node name="Arm" type="Node3D" parent="."]
transform = Transform3D(0, -1, 0, 1, 0, 0, 0, 0, 1, 0, 2, 0)
[node name="Hand" type="Node3D" parent="Arm"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 0, 0)
[node name="Free" type="Node3D" parent="Arm"]
top_level = true
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 7)
[node name="Plain" type="Node" parent="."]
`;

function globalAt(path: string) {
  const main = new TscnParser().parse(SCENE);
  return liveGlobalTransform3D(liveTreeOf(main.nodes, contextOver(main, {})), path);
}

describe('liveGlobalTransform3D', () => {
  it('composes the transforms of the Node3D nodes above the path', () => {
    const hand = globalAt('Root/Arm/Hand')!;

    // Root moves x by 1; Arm turns a quarter about Z and moves y by 2; Hand sits 3 along Arm's x.
    expect(hand.origin.x).toBeCloseTo(1, 5);
    expect(hand.origin.y).toBeCloseTo(5, 5);
    expect(hand.origin.z).toBeCloseTo(0, 5);
  });

  it('starts again at a top_level node', () => {
    expect(globalAt('Root/Arm/Free')!.origin).toEqual({ x: 0, y: 0, z: 7 });
  });

  it('is null for a path that names no node', () => {
    expect(globalAt('Root/Missing')).toBeNull();
  });

  it('is null for a node that is not a Node3D', () => {
    expect(globalAt('Root/Plain')).toBeNull();
  });
});
