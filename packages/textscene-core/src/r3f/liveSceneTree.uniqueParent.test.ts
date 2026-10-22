/**
 * A host heading whose `parent=` reaches into an instanced sub-scene through a `%Name` that
 * sub-scene claims. Godot's walk reads the instance's own claim table first (node.cpp:1930-1933),
 * so the heading lands under the claimant inside the sub-scene.
 */
import { describe, expect, it, vi } from 'vitest';
import * as logger from '../logger';
import { TscnParser } from '../parser/TscnParser';
import type { TscnNode, TscnScene } from '../parser/types';
import { scopeOf } from '../resources/liveNode';
import {
  collapseLiveNode,
  liveChildGroups,
  rootScope,
  singlePathCache,
  type LiveTreeContext,
} from './liveSceneTree';

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

/** The node `host`'s Player collapses into, with each scene path in `scenes` cached. */
function composedPlayer(host: TscnScene, scenes: Record<string, TscnScene>): TscnNode {
  const ctx: LiveTreeContext = {
    externalResources: host.externalResources,
    internalResources: [],
    sceneCache: { getCached: (path) => scenes[path] },
  };
  const instance = host.nodes[0]!.children.find((n) => n.name === 'Player')!;
  const [group] = liveChildGroups(instance, rootScope(ctx), ctx.sceneCache);
  return group!.mergedNode!;
}

function childNames(node: TscnNode, name: string): string[] {
  return node.children.find((n) => n.name === name)!.children.map((n) => n.name);
}

/** The children of the sub-scene's `Body/Head` once `host` instances `sub` as Player. */
function headChildren(host: TscnScene, sub: TscnScene): string[] {
  const body = composedPlayer(host, { 'res://player.tscn': sub }).children.find((n) => n.name === 'Body')!;
  return childNames(body, 'Head');
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

  it('composes under a claim a host override releases only after the heading', () => {
    // Instantiate sets each heading's properties as it reaches it (packed_scene.cpp:157-165).
    const releasingLater = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="player"]

[node name="Main" type="Node3D"]

[node name="Player" parent="." instance=ExtResource("player")]

[node name="Hat" type="Node3D" parent="Player/%Head"]

[node name="Head" parent="Player/Body"]
unique_name_in_owner = false
`);
    expect(headChildren(releasingLater, player)).toEqual(['Hat']);
  });

  it('composes under a claimant the sub-scene seats inside its own nested instance', () => {
    const mid = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://inner.tscn" id="inner"]

[node name="Player" type="Node3D"]

[node name="Inner" parent="." instance=ExtResource("inner")]

[node name="New" type="Node3D" parent="Inner/X"]
unique_name_in_owner = true
`);
    const hatOnNew = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="player"]

[node name="Main" type="Node3D"]

[node name="Player" parent="." instance=ExtResource("player")]

[node name="Hat" type="Node3D" parent="Player/%New"]
`);
    const innerNode = composedPlayer(hatOnNew, { 'res://player.tscn': mid }).children[0]!;

    expect(innerNode.children.map((n) => [n.name, n.instanceSubPath])).toEqual([
      ['New', 'X'],
      ['Hat', 'X/New'],
    ]);
  });

  it('keeps a host release out of the inherited scene its sub-scene collapses into next', () => {
    // The inherited scene instantiates, and seats its own `%A` heading, before the host's release lands.
    const base = new TscnParser().parse(`[gd_scene format=3]

[node name="Base" type="Node3D"]

[node name="A" type="Node3D" parent="."]
unique_name_in_owner = true
`);
    const inherited = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://base.tscn" id="base"]

[node name="Player" instance=ExtResource("base")]

[node name="Hat" type="Node3D" parent="%A"]
`);
    const releasing = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="player"]

[node name="Main" type="Node3D"]

[node name="Player" parent="." instance=ExtResource("player")]

[node name="A" parent="Player"]
unique_name_in_owner = false
`);
    const composed = composedPlayer(releasing, { 'res://player.tscn': inherited, 'res://base.tscn': base });

    expect(childNames(composed, 'A')).toEqual(['Hat']);
  });

  it('misses a base %Name a host releases before its heading', () => {
    // The inherited root owns its base's nodes (packed_scene.cpp:227-231), so the host's clear
    // releases the base's claim (node.cpp:2236-2249) before Hat's `parent=` reads it.
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const base = new TscnParser().parse(`[gd_scene format=3]

[node name="Base" type="Node3D"]

[node name="A" type="Node3D" parent="."]
unique_name_in_owner = true
`);
    const inherited = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://base.tscn" id="base"]

[node name="Player" instance=ExtResource("base")]
`);
    const releasingFirst = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="player"]

[node name="Main" type="Node3D"]

[node name="Player" parent="." instance=ExtResource("player")]

[node name="A" parent="Player"]
unique_name_in_owner = false

[node name="Hat" type="Node3D" parent="Player/%A"]
`);
    const composed = composedPlayer(releasingFirst, {
      'res://player.tscn': inherited,
      'res://base.tscn': base,
    });

    expect(childNames(composed, 'A')).toEqual([]);
    warnSpy.mockRestore();
  });

  it('misses a %Name an inherited scene releases on its base', () => {
    // The base's nodes are the inherited root's own, so the clear releases the name before Hat reads it.
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const base = new TscnParser().parse(`[gd_scene format=3]

[node name="Base" type="Node3D"]

[node name="A" type="Node3D" parent="."]
unique_name_in_owner = true
`);
    const releasing = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://base.tscn" id="base"]

[node name="Player" instance=ExtResource("base")]

[node name="A" parent="."]
unique_name_in_owner = false

[node name="Hat" type="Node3D" parent="%A"]
`);
    const bareHost = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="player"]

[node name="Main" type="Node3D"]

[node name="Player" parent="." instance=ExtResource("player")]
`);
    const composed = composedPlayer(bareHost, { 'res://player.tscn': releasing, 'res://base.tscn': base });

    expect(childNames(composed, 'A')).toEqual([]);
    expect(composed.children.map((n) => n.name)).toEqual(['A', 'Hat']);
    warnSpy.mockRestore();
  });

  it('composes under the %Name an inherited scene claims when each scene collapses on its own', () => {
    // The dispatcher's cache answers one scene, so the base merges on a second collapse.
    const base = new TscnParser().parse(`[gd_scene format=3]

[node name="Player" type="Node3D"]

[node name="Body" type="Node3D" parent="."]

[node name="Head" type="Node3D" parent="Body"]
`);
    const inherited = new TscnParser().parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://base.tscn" id="base"]

[node name="Player" instance=ExtResource("base")]

[node name="Head" parent="Body"]
unique_name_in_owner = true
`);
    const instance = host.nodes[0]!.children.find((n) => n.name === 'Player')!;
    const outer = { externalResources: host.externalResources, internalResources: [] };
    const overInherited = collapseLiveNode(instance, outer, singlePathCache('res://player.tscn', inherited));
    const overBase = collapseLiveNode(
      overInherited,
      scopeOf(overInherited, outer),
      singlePathCache('res://base.tscn', base)
    );

    expect(
      childNames(
        overBase.children.find((n) => n.name === 'Body')!,
        'Head'
      )
    ).toEqual(['Hat']);
  });
});
