/**
 * A host heading whose `parent=` walk leaves the instance it enters, or finds nothing. Godot
 * walks the path from the root of the file that holds the heading, over the tree built so far
 * (packed_scene.cpp:157-165), so the heading sits where that walk ends, not under the instance.
 */
import { describe, expect, it } from 'vitest';
import { TscnParser } from '../parser/TscnParser';
import type { TscnScene } from '../parser/types';
import { resolveLiveEntry, walkLiveTree } from './liveSceneTree';
import { contextOver } from './liveSceneTree.testkit';
import '../nodes/node/index';
import '../nodes/base/node3d/index';

const parse = (text: string): TscnScene => new TscnParser().parse(text);

/** The path of every node of `main`'s live tree, with each scene in `scenes` cached. */
function livePaths(main: TscnScene, scenes: Record<string, TscnScene>): string[] {
  const paths: string[] = [];
  walkLiveTree(main.nodes, contextOver(main, scenes), ({ path }) => paths.push(path));
  return paths;
}

const HUD = parse(`[gd_scene format=3]

[node name="Hud" type="Node3D"]

[node name="Box" type="Node3D" parent="."]
`);

/** The headings of issue example 2: HudInstance's table holds `%Lamp` for a node outside the instance. */
const LAMP_HOST_TEXT = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://hud.tscn" id="hud"]

[node name="Main" type="Node3D"]

[node name="HudInstance" parent="." instance=ExtResource("hud")]

[node name="Lamp" type="Node3D" parent="." owner="HudInstance"]
unique_name_in_owner = true

[node name="Shade" type="Node3D" parent="HudInstance/%Lamp"]
`;
const LAMP_HOST = parse(LAMP_HOST_TEXT);

describe('a host heading whose `%Name` the instance holds for a node outside it', () => {
  it('seats under that node, not under the instance', () => {
    const paths = livePaths(LAMP_HOST, { 'res://hud.tscn': HUD });

    expect(paths).toContain('Main/Lamp/Shade');
    expect(paths.filter((path) => path.endsWith('Shade'))).toEqual(['Main/Lamp/Shade']);
  });

  it('resolves the escaped node at its new path', () => {
    const entry = resolveLiveEntry(
      'Main/Lamp/Shade',
      LAMP_HOST.nodes,
      contextOver(LAMP_HOST, { 'res://hud.tscn': HUD })
    );

    expect(entry?.node.name).toBe('Shade');
  });
});

describe('a host heading whose `%Name` the file claims for a node it owns', () => {
  const ownedLamp = parse(LAMP_HOST_TEXT.replace(' owner="HudInstance"', ''));

  it('seats under that node, as Godot reads the name from the owner of the instance', () => {
    const paths = livePaths(ownedLamp, { 'res://hud.tscn': HUD });

    expect(paths.filter((path) => path.endsWith('Shade'))).toEqual(['Main/Lamp/Shade']);
  });
});

const INNER = parse(`[gd_scene format=3]

[node name="Inner" type="Node3D"]

[node name="Box" type="Node3D" parent="."]
`);

/** A sub-scene that instances `Inner` and holds no `%Q`. */
const PLAYER = parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://inner.tscn" id="inner"]

[node name="Player" type="Node3D"]

[node name="Inner" parent="." instance=ExtResource("inner")]
`);

/** The same sub-scene with a `%Q` of its own, which `Inner` lacks. */
const PLAYER_Q = parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://inner.tscn" id="inner"]

[node name="Player" type="Node3D"]

[node name="Q" type="Node3D" parent="."]
unique_name_in_owner = true

[node name="Inner" parent="." instance=ExtResource("inner")]
`);

/** A host that instances `res://player.tscn` and states the headings in `headings`. */
function playerHost(headings: string): TscnScene {
  return parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="player"]

[node name="Main" type="Node3D"]

[node name="Player" parent="." instance=ExtResource("player")]

${headings}`);
}

const SCENES = { 'res://inner.tscn': INNER, 'res://player.tscn': PLAYER };

describe('a host heading whose `%Name` the nested instance lacks', () => {
  const hat = playerHost('[node name="Hat" type="Node3D" parent="Player/Inner/%Q"]');

  it('seats under the node its owner claims the name for', () => {
    const paths = livePaths(hat, { ...SCENES, 'res://player.tscn': PLAYER_Q });

    expect(paths).toContain('Main/Player/Q/Hat');
    expect(paths.filter((path) => path.endsWith('Hat'))).toEqual(['Main/Player/Q/Hat']);
  });

  it('re-roots under the file root where nothing claims the name', () => {
    const paths = livePaths(hat, SCENES);

    expect(paths).toContain('Main/Player_Inner__Q#Hat');
    expect(paths.filter((path) => path.endsWith('Hat'))).toEqual(['Main/Player_Inner__Q#Hat']);
  });

  it('keeps the name the heading wrote on the re-rooted node', () => {
    const entry = resolveLiveEntry('Main/Player_Inner__Q#Hat', hat.nodes, contextOver(hat, SCENES));

    expect(entry?.node.authoredName).toBe('Hat');
  });
});

describe('a host heading whose plain name the instance lacks', () => {
  it('re-roots under the file root, renamed from the vanished parent', () => {
    const cap = playerHost('[node name="Cap" type="Node3D" parent="Player/Missing"]');

    expect(livePaths(cap, SCENES)).toContain('Main/Player_Missing#Cap');
  });

  it('re-roots from inside a nested instance too', () => {
    const hat = playerHost('[node name="Hat" type="Node3D" parent="Player/Inner/Missing"]');

    expect(livePaths(hat, SCENES)).toContain('Main/Player_Inner_Missing#Hat');
  });

  it('numbers a second heading with the same name past the first', () => {
    const twice = playerHost(`[node name="Hat" type="Node3D" parent="Player/Inner/%Q"]

[node name="Hat" type="Node3D" parent="Player/Inner/%Q"]`);

    const hats = livePaths(twice, SCENES).filter((path) => path.includes('#'));

    expect(hats).toEqual(['Main/Player_Inner__Q#Hat', 'Main/Player_Inner__Q#Hat2']);
  });
});

describe('a host heading below an escaped heading', () => {
  it('seats under the escaped node, where its own walk reaches it', () => {
    const bulb = parse(`${LAMP_HOST_TEXT}
[node name="Bulb" type="Node3D" parent="HudInstance/%Lamp/Shade"]
`);

    expect(livePaths(bulb, { 'res://hud.tscn': HUD })).toContain('Main/Lamp/Shade/Bulb');
  });

  it('re-roots on its own where the walk through the vanished parent fails again', () => {
    const feather = playerHost(`[node name="Hat" type="Node3D" parent="Player/Inner/%Q"]

[node name="Feather" type="Node3D" parent="Player/Inner/%Q/Hat"]`);

    const paths = livePaths(feather, SCENES);

    expect(paths).toContain('Main/Player_Inner__Q#Hat');
    expect(paths).toContain('Main/Player_Inner__Q_Hat#Feather');
    expect(paths.filter((path) => path.includes('Feather'))).toEqual(['Main/Player_Inner__Q_Hat#Feather']);
  });
});

describe('an escaped heading of an instanced file', () => {
  /** A scene that instances `res://main1.tscn` as `Stage`. */
  const OUTER = parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://main1.tscn" id="main1"]

[node name="Outer" type="Node3D"]

[node name="Stage" parent="." instance=ExtResource("main1")]
`);

  it('seats under the file root the instance merges into, outside the instance it walked', () => {
    const paths = livePaths(OUTER, { 'res://main1.tscn': LAMP_HOST, 'res://hud.tscn': HUD });

    expect(paths).toContain('Outer/Stage/Lamp/Shade');
    expect(paths.filter((path) => path.endsWith('Shade'))).toEqual(['Outer/Stage/Lamp/Shade']);
  });

  it('re-roots under the instance the file merges into', () => {
    const hat = playerHost('[node name="Hat" type="Node3D" parent="Player/Inner/%Q"]');

    const paths = livePaths(OUTER, { 'res://main1.tscn': hat, ...SCENES });

    expect(paths).toContain('Outer/Stage/Player_Inner__Q#Hat');
    expect(paths.filter((path) => path.endsWith('Hat'))).toEqual(['Outer/Stage/Player_Inner__Q#Hat']);
  });
});

describe('a file whose root inherits a base', () => {
  const BASE = parse(`[gd_scene format=3]

[node name="Base" type="Node3D"]

[node name="Deep" type="Node3D" parent="."]
`);

  /** The root's own headings: `heading` states a `parent=` that no node of the base answers. */
  const inheriting = (heading: string) =>
    parse(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://base.tscn" id="base"]

[node name="Main" instance=ExtResource("base")]

${heading}`);

  it('re-roots a heading whose walk through the base finds nothing', () => {
    const main = inheriting('[node name="Z" type="Node3D" parent="Nope/Deeper"]');

    expect(livePaths(main, { 'res://base.tscn': BASE })).toContain('Main/Nope_Deeper#Z');
  });

  it('re-roots a heading whose %Name the base does not claim', () => {
    const main = inheriting('[node name="Y" type="Node3D" parent="%Q"]');

    expect(livePaths(main, { 'res://base.tscn': BASE })).toContain('Main/_Q#Y');
  });

  it('seats a heading at the base node its walk names', () => {
    const main = inheriting('[node name="X" type="Node3D" parent="Deep"]');

    expect(livePaths(main, { 'res://base.tscn': BASE })).toContain('Main/Deep/X');
  });

  it('shows a heading under the root while the base is not loaded, and seats it once the base loads', () => {
    const main = inheriting('[node name="Z" type="Node3D" parent="Nope/Deeper"]');

    expect(livePaths(main, {})).toContain('Main/Z');
    expect(livePaths(main, { 'res://base.tscn': BASE })).not.toContain('Main/Z');
    expect(livePaths(main, { 'res://base.tscn': BASE })).toContain('Main/Nope_Deeper#Z');
  });
});
