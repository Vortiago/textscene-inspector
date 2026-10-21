/**
 * A host heading whose `parent=` reaches into an instanced sub-scene through a `%Name` that
 * sub-scene claims. Godot's walk reads the instance's own claim table first (node.cpp:1930-1933),
 * so the heading lands under the claimant inside the sub-scene.
 */
import { describe, expect, it } from 'vitest';
import { TscnParser } from '../parser/TscnParser';
import type { TscnScene } from '../parser/types';
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
const unclaimed = new TscnParser().parse(`[gd_scene format=3]

[node name="Player" type="Node3D"]

[node name="Body" type="Node3D" parent="."]

[node name="Head" type="Node3D" parent="Body"]
`);

/** The children of the sub-scene's `Body/Head` once `host` instances `sub` as Player. */
function headChildren(host: TscnScene, sub: TscnScene): string[] {
  const ctx: LiveTreeContext = {
    externalResources: host.externalResources,
    internalResources: [],
    sceneCache: { getCached: (path) => (path === 'res://player.tscn' ? sub : undefined) },
  };
  const instance = host.nodes[0]!.children.find((n) => n.name === 'Player')!;
  const [group] = liveChildGroups(instance, rootScope(ctx), ctx.sceneCache);
  const body = group!.mergedNode!.children.find((n) => n.name === 'Body')!;
  return body.children.find((n) => n.name === 'Head')!.children.map((n) => n.name);
}

describe('a host heading below an instanced `%Name`', () => {
  it('composes under the node the sub-scene claims it for', () => {
    expect(headChildren(host, player)).toEqual(['Hat']);
  });

  it('composes under the node a host override claims it for', () => {
    // The override keeps the sub-scene's owner (resource_format_text.cpp:264-265).
    const claiming = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="player"]

[node name="Main" type="Node3D"]

[node name="Player" parent="." instance=ExtResource("player")]

[node name="Head" parent="Player/Body"]
unique_name_in_owner = true

[node name="Hat" type="Node3D" parent="Player/%Head"]
`);
    expect(headChildren(claiming, unclaimed)).toEqual(['Hat']);
  });
});
