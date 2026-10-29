/**
 * A heading whose `owner=` walk enters an instance, and whose `owner_uid_path=` names the file root.
 * Godot takes the root as owner only where the walk finds no node (packed_scene.cpp:159-163), so
 * only a reader that sees the instance can tell. Each reader reads that one decision: the live
 * seating, the render path's `%Name` table and the parse's own walk.
 */
import { describe, expect, it } from 'vitest';
import type { TscnScene } from '../parser/types';
import { sceneSeating } from '../parser/sceneTreeBuilder';
import { PLAYER_ID, TRAIL_SCENES, parseScene, pathsEnding, tableOf } from './idTrail.testkit';
import '../nodes/node/index';
import '../nodes/base/node3d/index';

const ROOT_ID = 5;

/** A host whose `Lamp` names `owner` and the root by its `owner_uid_path=`, then `Shade` below `%Lamp`. */
const hostOwnedBy = (owner: string) =>
  parseScene(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="player"]

[node name="Main" type="Node3D" unique_id=${ROOT_ID}]

[node name="Player" parent="." instance=ExtResource("player") unique_id=${PLAYER_ID}]

[node name="Lamp" type="Node3D" parent="." owner="${owner}" owner_uid_path=PackedInt32Array(${ROOT_ID})]
unique_name_in_owner = true

[node name="Shade" type="Node3D" parent="%Lamp"]
`);

const shadePaths = (host: TscnScene, scenes = TRAIL_SCENES) => pathsEnding(host, 'Shade', scenes);

const rootTable = (host: TscnScene) => tableOf('Main/Player', host);

describe('where the owner= walk finds nothing in the instance', () => {
  const host = hostOwnedBy('Player/Gone');

  it('seats a heading below the %Name the root claims', () => {
    expect(shadePaths(host)).toEqual(['Main/Lamp/Shade']);
  });

  it('gives the root the name in its table', () => {
    expect(rootTable(host).get('%Lamp')).toBe('Main/Lamp');
  });
});

describe('where the owner= walk finds the owner in the instance', () => {
  const host = hostOwnedBy('Player/Inner');

  it('re-roots a heading below the %Name, which the root does not claim', () => {
    expect(shadePaths(host)).toEqual(['Main/_Lamp#Shade']);
  });

  it('gives the root no such name', () => {
    expect(rootTable(host).has('%Lamp')).toBe(false);
  });
});

describe('while the instance is not loaded', () => {
  const host = hostOwnedBy('Player/Gone');

  it('seats the heading as the trail says, and keeps it there', () => {
    expect(shadePaths(host, {})).toEqual(['Main/Lamp/Shade']);
  });
});

describe('while a nested scene the owner= walk enters is not loaded', () => {
  const host = hostOwnedBy('Player/Inner/Gone');
  const playerOnly = { 'res://player.tscn': TRAIL_SCENES['res://player.tscn']! };

  it('keeps the heading below the %Name the root claims', () => {
    expect(shadePaths(host, playerOnly)).toEqual(['Main/Lamp/Shade']);
  });

  it('seats it there once that scene loads and the walk finds nothing', () => {
    expect(shadePaths(host)).toEqual(['Main/Lamp/Shade']);
  });
});

describe('where the owner= walk finds the owner in a nested instance', () => {
  it('re-roots a heading below the %Name, which the root does not claim', () => {
    expect(shadePaths(hostOwnedBy('Player/Inner/Box'))).toEqual(['Main/_Lamp#Shade']);
  });
});

describe('the parse, which cannot see the instance', () => {
  it('answers a path through the %Name as unknowable', () => {
    expect(sceneSeating(hostOwnedBy('Player/Gone').nodes).resolve('%Lamp').status).toBe('unknowable');
  });

  it('answers a path through the %Name with a subname as unknowable', () => {
    expect(sceneSeating(hostOwnedBy('Player/Gone').nodes).resolve('%Lamp:position').status).toBe(
      'unknowable'
    );
  });

  it('answers the path of a heading below the %Name as unknowable', () => {
    expect(sceneSeating(hostOwnedBy('Player/Gone').nodes).resolve('Lamp/Shade').status).toBe('unknowable');
  });

  it('answers the path the heading takes, re-rooted, as unknowable', () => {
    expect(sceneSeating(hostOwnedBy('Player/Gone').nodes).resolve('_Lamp#Shade').status).toBe('unknowable');
  });

  it('answers the path of the node itself', () => {
    expect(sceneSeating(hostOwnedBy('Player/Gone').nodes).resolve('Lamp').status).toBe('found');
  });
});

describe('a scene whose root is the fallback owner, instanced by another', () => {
  const subOwnedBy = (owner: string) =>
    parseScene(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="player"]

[node name="Sub" type="Node3D" unique_id=${ROOT_ID}]

[node name="Player" parent="." instance=ExtResource("player") unique_id=${PLAYER_ID}]

[node name="Lamp" type="Node3D" parent="." owner="${owner}" owner_uid_path=PackedInt32Array(${ROOT_ID})]
unique_name_in_owner = true
`);
  const host = parseScene(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://sub.tscn" id="sub"]

[node name="Main" type="Node3D"]

[node name="S" parent="." instance=ExtResource("sub")]

[node name="X" type="Node3D" parent="S/%Lamp"]
`);
  const xPaths = (owner: string) =>
    pathsEnding(host, 'X', { ...TRAIL_SCENES, 'res://sub.tscn': subOwnedBy(owner) });

  it('gives the instance the name where the walk finds nothing', () => {
    expect(xPaths('Player/Gone')).toEqual(['Main/S/Lamp/X']);
  });

  it('gives the instance no such name where the walk finds the owner', () => {
    expect(xPaths('Player/Inner')).toEqual(['Main/S__Lamp#X']);
  });
});
