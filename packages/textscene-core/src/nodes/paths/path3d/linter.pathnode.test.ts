/**
 * `path3d-unused` must not fire on a Path3D that a CSGPolygon3D extrudes along.
 *
 * A Path3D consumed via `CSGPolygon3D.path_node` (mode PATH) is a first-class
 * Godot pattern with no PathFollow3D anywhere — and the rule only looked for
 * PathFollow3D descendants, so it warned on two vendored scenes that are doing
 * nothing wrong (`scenes/demos/3d/csg/csg.tscn` `Testers/Road/Path3D` among
 * them). A linter that cries wolf on the corpus trains people to ignore it.
 */
import { describe, expect, it } from 'vitest';
import { lint } from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

function unusedWarnings(source: string): string[] {
  return lint(source)
    .filter((d) => d.ruleName === 'path3d-unused')
    .map((d) => d.nodeName ?? '');
}

const CURVE = `[sub_resource type="Curve3D" id="Curve3D_1"]
_data = {
"points": PackedVector3Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0)
}
`;

describe('path3d-unused', () => {
  it('still warns for a Path3D nothing references', () => {
    const scene = `[gd_scene format=3]\n\n${CURVE}
[node name="Root" type="Node3D"]

[node name="Lonely" type="Path3D" parent="."]
curve = SubResource("Curve3D_1")
`;
    expect(unusedWarnings(scene)).toEqual(['Lonely']);
  });

  it('stays quiet when a PathFollow3D rides the path', () => {
    const scene = `[gd_scene format=3]\n\n${CURVE}
[node name="Root" type="Node3D"]

[node name="Track" type="Path3D" parent="."]
curve = SubResource("Curve3D_1")

[node name="Follower" type="PathFollow3D" parent="Track"]
`;
    expect(unusedWarnings(scene)).toEqual([]);
  });

  it('stays quiet when a CSGPolygon3D extrudes along it', () => {
    const scene = `[gd_scene format=3]\n\n${CURVE}
[node name="Root" type="Node3D"]

[node name="Road" type="Node3D" parent="."]

[node name="Path3D" type="Path3D" parent="Road"]
curve = SubResource("Curve3D_1")

[node name="RoadTop" type="CSGPolygon3D" parent="Road"]
mode = 2
path_node = NodePath("../Path3D")
`;
    expect(unusedWarnings(scene)).toEqual([]);
  });

  it('matches the path_node by its final segment, not the whole NodePath', () => {
    // The linter cannot resolve a NodePath against a live tree (instanced
    // sub-scenes are opaque to it), so the reference test is deliberately by
    // name — a false negative beats warning on a correct scene.
    const scene = `[gd_scene format=3]\n\n${CURVE}
[node name="Root" type="Node3D"]

[node name="Rail" type="Path3D" parent="."]
curve = SubResource("Curve3D_1")

[node name="Extrusion" type="CSGPolygon3D" parent="."]
mode = 2
path_node = NodePath("../../Somewhere/Deep/Rail")
`;
    expect(unusedWarnings(scene)).toEqual([]);
  });
});
