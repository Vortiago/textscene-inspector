/**
 * The scenes the id-trail tests share: `res://player.tscn` instances `res://inner.tscn` as the
 * heading with id `INNER_ID`, and a host instances Player as the heading with id `PLAYER_ID`.
 */
import { TscnParser } from '../parser/TscnParser';
import type { TscnScene } from '../parser/types';
import { contextOver, livePathsOver } from './liveSceneTree.testkit';
import type { UniqueNamePaths } from '../resources/instanceNameTable';
import { claimOwnerOf, ownerUniquePaths } from './uniqueNameOwner';

export const parseScene = (text: string): TscnScene => new TscnParser().parse(text);

export const PLAYER_ID = 2222;
export const INNER_ID = 3333;

const INNER = parseScene(`[gd_scene format=3]

[node name="Inner" type="Node3D" unique_id=1]

[node name="Box" type="Node3D" parent="." unique_id=2]
`);

const PLAYER = parseScene(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://inner.tscn" id="inner"]

[node name="Player" type="Node3D" unique_id=1]

[node name="Inner" parent="." instance=ExtResource("inner") unique_id=${INNER_ID}]
`);

/** @canonical In tests, the Player and Inner scenes an id trail enters */
export const TRAIL_SCENES: Readonly<Record<string, TscnScene>> = {
  'res://inner.tscn': INNER,
  'res://player.tscn': PLAYER,
};

/** Only `res://player.tscn`, as while the scene it instances loads. */
export const PLAYER_SCENE_ONLY: Readonly<Record<string, TscnScene>> = { 'res://player.tscn': PLAYER };

/** A host with the root `Main` and an ext_resource `player` for `res://player.tscn`, then `headings`. */
export function hostOf(headings: string): TscnScene {
  return parseScene(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="player"]

[node name="Main" type="Node3D"]

${headings}`);
}

export const playerHeading = `[node name="Player" parent="." instance=ExtResource("player") unique_id=${PLAYER_ID}]\n`;

/** A host that instances `res://player.tscn` as the heading with id `PLAYER_ID`, then states `headings`. */
export const playerHost = (headings: string): TscnScene => hostOf(`${playerHeading}\n${headings}`);

/** The live paths of `host` that end in `name`. */
export const pathsEnding = (host: TscnScene, name: string, scenes = TRAIL_SCENES): string[] =>
  livePathsOver(host, scenes).filter((path) => path.endsWith(name));

/** The `%Name` table of the owner the node at `path` in `host`'s live tree claims in. */
export const tableOf = (path: string, host: TscnScene, scenes = TRAIL_SCENES): UniqueNamePaths =>
  ownerUniquePaths(claimOwnerOf(path, host.nodes, contextOver(host, scenes)));

/** A base whose `Deep` an id trail names as 77, and whose `Feather` claims `%Feather` first. */
export const TRAIL_BASE = parseScene(`[gd_scene format=3]

[node name="Base" type="Node3D" unique_id=1]

[node name="Deep" type="Node3D" parent="." unique_id=77]

[node name="Feather" type="Node3D" parent="." unique_id=78]
unique_name_in_owner = true
`);

/** A file whose root `Main` inherits `TRAIL_BASE` from `res://base.tscn`, then states `headings`. */
export function inheritingTrailBase(headings: string): TscnScene {
  return parseScene(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://base.tscn" id="base"]

[node name="Main" instance=ExtResource("base")]

${headings}`);
}
