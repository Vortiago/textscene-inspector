/**
 * Where a scene's values name each `[ext_resource]`. The text loader waits on an `[ext_resource]`'s load only where a
 * value names it (`resource_format_text.cpp:125-180`), and a failed load ends the file's load everywhere except inside
 * a node body, where the loader skips it (`:288-289`).
 */

import { describe, expect, it } from 'vitest';
import { StrictTscnParser } from './StrictTscnParser.js';
import { extResourceUses, type ExtResourceUse } from './usedExtResources.js';

function uses(content: string): Record<string, ExtResourceUse> {
  return Object.fromEntries(extResourceUses(new StrictTscnParser().parse(content).scene!));
}

const HEADER = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://tree.glb" id="1_tree"]
[ext_resource type="Texture2D" path="res://t.png" id="2_tex"]
`;

describe('extResourceUses', () => {
  it("reads a node heading's instance= as a node use", () => {
    expect(
      uses(`${HEADER}
[node name="Root" type="Node3D"]

[node name="Tree" parent="." instance=ExtResource("1_tree")]
`)
    ).toEqual({ '1_tree': 'node' });
  });

  it("reads a reference inside a node's property value as a node use", () => {
    expect(
      uses(`${HEADER}
[node name="Root" type="Node3D"]
metadata/scenes = [ExtResource("1_tree")]
`)
    ).toEqual({ '1_tree': 'node' });
  });

  it('reads a node whose parent path resolves against nothing as a node use', () => {
    // Godot still loads it, re-parented to the root (`packed_scene.cpp:208-215`).
    expect(
      uses(`${HEADER}
[node name="Root" type="Node3D"]

[node name="Lost" parent="Nowhere" instance=ExtResource("1_tree")]
`)
    ).toEqual({ '1_tree': 'node' });
  });

  it("reads the first node heading's instance=, which the loader reads outside a node body, as aborting", () => {
    expect(
      uses(`${HEADER}
[node name="Tree" instance=ExtResource("1_tree")]
`)
    ).toEqual({ '1_tree': 'aborting' });
  });

  it('reads the instance= of a node heading after a [connection] as aborting', () => {
    expect(
      uses(`${HEADER}
[node name="Root" type="Node3D"]

[connection signal="ready" from="." to="." method="_on_ready"]

[node name="Tree" parent="." instance=ExtResource("1_tree")]
`)
    ).toEqual({ '1_tree': 'aborting' });
  });

  it('reads the instance= of a node heading after an [editable] as aborting', () => {
    expect(
      uses(`${HEADER}
[node name="Root" type="Node3D"]

[editable path="Other"]

[node name="Tree" parent="." instance=ExtResource("1_tree")]
`)
    ).toEqual({ '1_tree': 'aborting' });
  });

  it("reads a reference inside a sub-resource's property value as aborting", () => {
    expect(
      uses(`${HEADER}
[sub_resource type="StandardMaterial3D" id="mat"]
albedo_texture = ExtResource("2_tex")

[node name="Root" type="Node3D"]
`)
    ).toEqual({ '2_tex': 'aborting' });
  });

  it("reads a reference inside a .tres file's [resource] body as aborting", () => {
    // The body's values parse through the same `_parse_ext_resource` callback (`resource_format_text.cpp:774`, `:1191`).
    expect(
      uses(`[gd_resource type="MeshLibrary" format=3]

[ext_resource type="PackedScene" path="res://tree.glb" id="1_tree"]

[resource]
item/0/mesh = ExtResource("1_tree")
`)
    ).toEqual({ '1_tree': 'aborting' });
  });

  it("reads a reference inside a [connection] heading's binds as aborting", () => {
    expect(
      uses(`${HEADER}
[node name="Root" type="Node3D"]

[connection signal="ready" from="." to="." method="_on_ready" binds= [ExtResource("1_tree"), 2]]
`)
    ).toEqual({ '1_tree': 'aborting' });
  });

  it('reads the binds of every [connection] heading', () => {
    expect(
      uses(`${HEADER}
[node name="Root" type="Node3D"]

[connection signal="ready" from="." to="." method="a" binds= [ExtResource("1_tree")]]
[connection signal="ready" from="." to="." method="b" binds= [ExtResource("2_tex")]]
`)
    ).toEqual({ '1_tree': 'aborting', '2_tex': 'aborting' });
  });

  it('lets an aborting use decide for an id a node uses as well, whichever comes first', () => {
    expect(
      uses(`${HEADER}
[sub_resource type="StandardMaterial3D" id="mat"]
metadata/tree = ExtResource("1_tree")

[node name="Root" type="Node3D"]
metadata/icon = ExtResource("2_tex")

[node name="Tree" parent="." instance=ExtResource("1_tree")]

[connection signal="ready" from="." to="." method="a" binds= [ExtResource("2_tex")]]
`)
    ).toEqual({ '1_tree': 'aborting', '2_tex': 'aborting' });
  });

  it('reads nothing from a [connection] heading without binds', () => {
    expect(
      uses(`${HEADER}
[node name="Root" type="Node3D"]

[connection signal="ready" from="." to="." method="_on_ready"]
`)
    ).toEqual({});
  });

  it('gives an empty map for a declaration no value names', () => {
    expect(
      uses(`${HEADER}
[node name="Root" type="Node3D"]
metadata/note = "ExtResource(\\"1_tree\\")"
`)
    ).toEqual({});
  });
});
