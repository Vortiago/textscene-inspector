/**
 * The patches of the live scene passes: the RemoteTransform pass runs before the CSGPolygon3D pass,
 * a load that leaves a result as it was hands back the same patch, and a mesh that draws behind its
 * node keeps that lag out of its property values.
 */

import { describe, expect, it } from 'vitest';
import type { Transform3D } from '../godot/math/transform3d';
import type { NodePatch } from './nodePatch';
import { TscnParser } from '../parser/TscnParser';
import { liveTreeOf } from './liveSceneTree';
import { contextOver, liveTreeOfText } from './liveSceneTree.testkit';
import { liveNodePatches } from './liveNodePatches';
import type { CSGPolygon3DResolvedPath } from '../nodes/3d/csg/csgpolygon3d/types';
import '../nodes/3d/csg/csgpolygon3d/index';
import '../nodes/3d/remotetransform3d/index';
import '../nodes/paths/path3d/index';
import '../nodes/3d/meshinstance3d/index';

const SCENE = `[gd_scene load_steps=2 format=3]
[sub_resource type="Curve3D" id="Curve3D_road"]
_data = {
"points": PackedVector3Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -4),
"tilts": PackedFloat32Array(0, 0)
}
point_count = 2
[node name="Root" type="Node3D"]
[node name="Poly" type="CSGPolygon3D" parent="."]
mode = 2
path_node = NodePath("../Track")
path_local = false
[node name="Track" type="Path3D" parent="."]
curve = SubResource("Curve3D_road")
[node name="Relay" type="RemoteTransform3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 9, 0)
remote_path = NodePath("../Track")
`;

/**
 * A relay cycle whose box sits in HolderA. Godot 4.6.3 moved HolderA to x 2883 by the harness frame
 * at the default physics clock, and drew the box at x 2881, two pushes behind its node.
 */
const CYCLE = `[gd_scene load_steps=2 format=3]
[sub_resource type="BoxMesh" id="Box"]
[node name="Root" type="Node3D"]
[node name="HolderA" type="Node3D" parent="."]
[node name="Box" type="MeshInstance3D" parent="HolderA"]
mesh = SubResource("Box")
[node name="RelayA" type="RemoteTransform3D" parent="HolderA"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0)
remote_path = NodePath("../../HolderB")
[node name="HolderB" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 3)
[node name="RelayB" type="RemoteTransform3D" parent="HolderB"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0)
remote_path = NodePath("../../HolderA")
`;

const originX = (patch: NodePatch | undefined): number | undefined =>
  (patch?.transform as Transform3D | undefined)?.origin.x;

describe('liveNodePatches', () => {
  it('runs the RemoteTransform pass before the path pass, which reads where the Path3D ended up', () => {
    const patches = liveNodePatches(liveTreeOfText(SCENE));

    expect(patches.get('Root/Track')).toHaveProperty('transform');
    const resolved = patches.get('Root/Poly')!.resolvedPath as CSGPolygon3DResolvedPath;
    expect(resolved.baseTransform!.origin.y).toBeCloseTo(9, 5);
  });

  it('hands back the same patch while a later tree leaves its content as it was', () => {
    // Two trees over one parse: a later load hands the same nodes to a new tree.
    const main = new TscnParser().parse(SCENE);
    const first = liveNodePatches(liveTreeOf(main.nodes, contextOver(main, {})));
    const second = liveNodePatches(liveTreeOf(main.nodes, contextOver(main, {})));

    expect(second.get('Root/Track')).toBe(first.get('Root/Track'));
    expect(second.get('Root/Poly')).toBe(first.get('Root/Poly'));
  });

  it('keeps a mesh that draws behind its node at its own transform', () => {
    const patches = liveNodePatches(liveTreeOfText(CYCLE));

    expect(originX(patches.get('Root/HolderA'))).toBeCloseTo(2883, 3);
    expect(patches.has('Root/HolderA/Box')).toBe(false);
  });

  it('hands back a new patch once the relay moves', () => {
    const before = liveNodePatches(liveTreeOfText(SCENE)).get('Root/Track');
    const after = liveNodePatches(liveTreeOfText(SCENE.replace('1, 0, 9, 0)', '1, 0, 8, 0)'))).get(
      'Root/Track'
    );

    expect(after).not.toBe(before);
    expect(after).not.toEqual(before);
  });
});
