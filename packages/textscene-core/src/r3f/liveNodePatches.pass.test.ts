/**
 * The patches of the live scene passes: the RemoteTransform pass runs before the CSGPolygon3D pass,
 * and a load that leaves a result as it was hands back the same patch.
 */

import { describe, expect, it } from 'vitest';
import { TscnParser } from '../parser/TscnParser';
import type { TscnScene } from '../parser/types';
import { liveTreeOf } from './liveSceneTree';
import { contextOver } from './liveSceneTree.testkit';
import { liveNodePatches } from './liveNodePatches';
import type { CSGPolygon3DResolvedPath } from '../nodes/3d/csg/csgpolygon3d/types';
import '../nodes/3d/csg/csgpolygon3d/index';
import '../nodes/3d/remotetransform3d/index';
import '../nodes/paths/path3d/index';

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

const patchesOver = (main: TscnScene) => liveNodePatches(liveTreeOf(main.nodes, contextOver(main, {})));

describe('liveNodePatches', () => {
  it('runs the RemoteTransform pass before the path pass, which reads where the Path3D ended up', () => {
    const patches = patchesOver(new TscnParser().parse(SCENE));

    expect(patches.get('Root/Track')).toHaveProperty('transform');
    const resolved = patches.get('Root/Poly')!.resolvedPath as CSGPolygon3DResolvedPath;
    expect(resolved.baseTransform!.origin.y).toBeCloseTo(9, 5);
  });

  it('hands back the same patch while a later tree leaves its content as it was', () => {
    const main = new TscnParser().parse(SCENE);
    const first = patchesOver(main);
    const second = patchesOver(main);

    expect(second.get('Root/Track')).toBe(first.get('Root/Track'));
    expect(second.get('Root/Poly')).toBe(first.get('Root/Poly'));
  });

  it('hands back a new patch once the relay moves', () => {
    const main = new TscnParser().parse(SCENE);
    const before = patchesOver(main).get('Root/Track');
    const moved = new TscnParser().parse(SCENE.replace('1, 0, 9, 0)', '1, 0, 8, 0)'));
    const after = patchesOver(moved).get('Root/Track');

    expect(after).not.toBe(before);
    expect(after).not.toEqual(before);
  });
});
