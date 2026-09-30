/**
 * The `[ext_resource]` ids a scene's values name. The text loader waits on an `[ext_resource]`'s load only where a value names it
 * (`resource_format_text.cpp:125-151`), so a missing dependency aborts the load only through a use.
 */

import { describe, expect, it } from 'vitest';
import { StrictTscnParser } from './StrictTscnParser.js';
import { usedExtResourceIds } from './usedExtResources.js';

function used(content: string): string[] {
  return [...usedExtResourceIds(new StrictTscnParser().parse(content).scene!)].sort();
}

const HEADER = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://tree.glb" id="1_tree"]
[ext_resource type="Texture2D" path="res://t.png" id="2_tex"]
`;

describe('usedExtResourceIds', () => {
  it("reads a node heading's instance=", () => {
    expect(
      used(`${HEADER}
[node name="Root" type="Node3D"]

[node name="Tree" parent="." instance=ExtResource("1_tree")]
`)
    ).toEqual(['1_tree']);
  });

  it("reads a reference inside a node's property value", () => {
    expect(
      used(`${HEADER}
[node name="Root" type="Node3D"]
metadata/scenes = [ExtResource("1_tree")]
`)
    ).toEqual(['1_tree']);
  });

  it("reads a reference inside a sub-resource's property value", () => {
    expect(
      used(`${HEADER}
[sub_resource type="StandardMaterial3D" id="mat"]
albedo_texture = ExtResource("2_tex")

[node name="Root" type="Node3D"]
`)
    ).toEqual(['2_tex']);
  });

  it('reads a node whose parent path resolves against nothing', () => {
    // Godot still loads it, re-parented to the root (`packed_scene.cpp:208-215`).
    expect(
      used(`${HEADER}
[node name="Root" type="Node3D"]

[node name="Lost" parent="Nowhere" instance=ExtResource("1_tree")]
`)
    ).toEqual(['1_tree']);
  });

  it('gives an empty set for a declaration no value names', () => {
    expect(
      used(`${HEADER}
[node name="Root" type="Node3D"]
metadata/note = "ExtResource(\\"1_tree\\")"
`)
    ).toEqual([]);
  });
});
