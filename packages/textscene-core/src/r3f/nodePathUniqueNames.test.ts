/**
 * A `%Name` segment of a NodePath reads the table of the node it starts from where that node owns
 * one, an instance root, and then its owner's (node.cpp:1930-1938).
 */
import { describe, expect, it } from 'vitest';
import { TscnParser } from '../parser/TscnParser.js';
import { contextOver } from './liveSceneTree.testkit.js';
import { nodePathUniquePaths } from './nodePathUniqueNames.js';

const parse = (content: string) => new TscnParser().parse(content);

const body = parse(`[gd_scene format=3]
[node name="Body" type="Node3D"]
[node name="Lamp" type="Node3D" parent="."]
unique_name_in_owner = true
[node name="Arm" type="Node3D" parent="."]
`);

const main = parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://body.tscn" id="1"]
[node name="Root" type="Node3D"]
[node name="Lamp" type="Node3D" parent="."]
unique_name_in_owner = true
[node name="Sign" type="Node3D" parent="."]
unique_name_in_owner = true
[node name="Body" parent="." instance=ExtResource("1")]
`);

const ctx = contextOver(main, { 'res://body.tscn': body });
const tableAt = (path: string | null) => nodePathUniquePaths(path, main.nodes, ctx);

describe('nodePathUniquePaths', () => {
  it('reads the table an instance root owns before the table of its owner', () => {
    expect(tableAt('Root/Body').get('%Lamp')).toBe('Root/Body/Lamp');
    expect(tableAt('Root/Body').get('%Sign')).toBe('Root/Sign');
  });

  it('reads only the table of the owner from a node inside the instance', () => {
    expect(tableAt('Root/Body/Arm').get('%Lamp')).toBe('Root/Body/Lamp');
    expect(tableAt('Root/Body/Arm').has('%Sign')).toBe(false);
  });

  it('reads the outer table from an outer node, and without a path', () => {
    expect(tableAt('Root/Sign').get('%Lamp')).toBe('Root/Lamp');
    expect(tableAt(null).get('%Lamp')).toBe('Root/Lamp');
  });

  it('falls back from an instance root to the owner its owner= names', () => {
    const holder = parse(`[gd_scene format=3]
[node name="Holder" type="Node3D"]
[node name="Knob" type="Node3D" parent="."]
unique_name_in_owner = true
`);
    const host = parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://holder.tscn" id="1"]
[ext_resource type="PackedScene" path="res://body.tscn" id="2"]
[node name="Main" type="Node3D"]
[node name="Holder" parent="." instance=ExtResource("1")]
[node name="Body" parent="Holder" instance=ExtResource("2") owner="Holder"]
`);
    const hostCtx = contextOver(host, { 'res://holder.tscn': holder, 'res://body.tscn': body });
    const table = nodePathUniquePaths('Main/Holder/Body', host.nodes, hostCtx);

    expect(table.get('%Knob')).toBe('Main/Holder/Knob');
    expect(table.get('%Lamp')).toBe('Main/Holder/Body/Lamp');
  });
});
