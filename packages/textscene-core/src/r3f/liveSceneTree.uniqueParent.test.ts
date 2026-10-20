/**
 * A host heading whose `parent=` reaches into an instanced sub-scene through a `%Name` that
 * sub-scene claims. Godot's walk reads the instance's own claim table first (node.cpp:1930-1933),
 * so the heading lands under the claimant inside the sub-scene.
 */
import { describe, expect, it } from 'vitest';
import { TscnParser } from '../parser/TscnParser';
import { liveChildGroups, rootScope, type LiveTreeContext } from './liveSceneTree';

const host = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="player"]

[node name="Main" type="Node3D"]

[node name="Player" parent="." instance=ExtResource("player")]

[node name="Hat" type="Node3D" parent="Player/%Head"]
`);
const player = new TscnParser().parse(`[gd_scene format=3]

[node name="Player" type="Node3D"]

[node name="Body" type="Node3D" parent="."]

[node name="Head" type="Node3D" parent="Body"]
unique_name_in_owner = true
`);
const ctx: LiveTreeContext = {
  externalResources: host.externalResources,
  internalResources: [],
  sceneCache: { getCached: (path) => (path === 'res://player.tscn' ? player : undefined) },
};

describe('a host heading below an instanced `%Name`', () => {
  it('composes under the node the sub-scene claims it for', () => {
    const instance = host.nodes[0]!.children.find((n) => n.name === 'Player')!;
    const [group] = liveChildGroups(instance, rootScope(ctx), ctx.sceneCache);
    const body = group!.mergedNode!.children.find((n) => n.name === 'Body')!;
    const head = body.children.find((n) => n.name === 'Head')!;

    expect(head.children.map((n) => n.name)).toEqual(['Hat']);
  });
});
