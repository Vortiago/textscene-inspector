import { describe, expect, it } from 'vitest';
import { TscnParser } from '../parser/TscnParser.js';
import { StrictTscnParser } from '../linter/StrictTscnParser.js';
import { uniqueNameClaims, uniqueNameOwnership } from './uniqueNames.js';

/**
 * Both trees, every time. They agree on `rawProperties` by construction
 * (`parser/rawPropertyParity.test.ts`), but only a real parse proves this reads
 * the field they agree on — a hand-built `TscnNode` is written in whichever
 * shape its author had in mind, so it can only confirm that.
 */
const SRC = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Target" type="Node3D" parent="."]
unique_name_in_owner = true

[node name="Plain" type="Node3D" parent="."]

[node name="Nested" type="Node3D" parent="Target"]
unique_name_in_owner = true
`;

function strictScene(source: string) {
  const { scene } = new StrictTscnParser().parse(source);
  // Absent only if the scanner could not run at all, which these sources do not
  // provoke — so it is a broken test, not a case to assert around.
  if (!scene) throw new Error('strict parser produced no scene');
  return scene;
}

describe('uniqueNameClaims', () => {
  it('finds a claim in the lenient tree, whose typed properties never carry the flag', () => {
    const claims = uniqueNameClaims(new TscnParser().parse(SRC).nodes);
    expect(claims.get('%Target')?.path).toBe('Root/Target');
  });

  it('finds the same claim in the strict tree', () => {
    const claims = uniqueNameClaims(strictScene(SRC).nodes);
    expect(claims.get('%Target')?.path).toBe('Root/Target');
  });

  it('claims a descendant at any depth, not just a root child', () => {
    const claims = uniqueNameClaims(new TscnParser().parse(SRC).nodes);
    expect(claims.get('%Nested')?.path).toBe('Root/Target/Nested');
  });

  it('leaves a node without the flag unclaimed', () => {
    const claims = uniqueNameClaims(new TscnParser().parse(SRC).nodes);
    expect(claims.has('%Plain')).toBe(false);
  });

  it('keeps the first claim when two nodes claim one name (node.cpp:2224-2231)', () => {
    const duplicate = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="First" type="Node3D" parent="."]

[node name="Dup" type="Node3D" parent="First"]
unique_name_in_owner = true

[node name="Second" type="Node3D" parent="."]

[node name="Dup" type="Node3D" parent="Second"]
unique_name_in_owner = true
`;
    const claims = uniqueNameClaims(new TscnParser().parse(duplicate).nodes);
    expect(claims.get('%Dup')?.path).toBe('Root/First/Dup');
  });

  it('carries the node itself, so a caller can read its type', () => {
    const claims = uniqueNameClaims(new TscnParser().parse(SRC).nodes);
    expect(claims.get('%Target')?.node.type).toBe('Node3D');
  });

  it('spells livePath through the instanced content a parent= descends into', () => {
    // `buildSceneTree` can only anchor `parent="Bike/Body"` at the instance node
    // and records `Body` as the remainder, so the authored tree has the claimant
    // one level up from where the composed tree draws it.
    const into = `[gd_scene format=3]
[ext_resource type="PackedScene" path="res://bike.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Bike" parent="." instance=ExtResource("1")]

[node name="Sight" type="Node2D" parent="Bike/Body"]
unique_name_in_owner = true
`;
    const claim = uniqueNameClaims(new TscnParser().parse(into).nodes).get('%Sight');
    expect(claim?.path).toBe('Root/Bike/Sight');
    expect(claim?.livePath).toBe('Root/Bike/Body/Sight');
  });

  it('leaves livePath equal to path where nothing is instanced', () => {
    const claims = uniqueNameClaims(new TscnParser().parse(SRC).nodes);
    expect(claims.get('%Nested')?.livePath).toBe('Root/Target/Nested');
  });
});

describe('override headings inside an instanced sub-scene', () => {
  // A heading with neither `type=` nor `instance=` overrides a node that
  // already exists inside the instance, and resource_format_text.cpp:259-261
  // leaves its owner untouched (`owner = 0` only when
  // `!(type == TYPE_INSTANTIATED && instance == -1)`), so it stays owned by the
  // SUB-SCENE root. node.cpp:2222-2233 registers `%Name` on that owner and
  // node.cpp:1930-1938 consults only the caller's own owner table, so the
  // outer scene's `%Hit` addresses nothing. Probed on 4.6.3: `Hit.owner ==
  // Enemy` and `Player.get_node_or_null("%Hit") == null`.
  const overridden = `[gd_scene format=3]
[ext_resource type="PackedScene" path="res://enemy.tscn" id="1"]

[node name="Player" type="Node2D"]

[node name="Enemy" parent="." instance=ExtResource("1")]

[node name="Hit" parent="Enemy"]
unique_name_in_owner = true

[node name="Added" type="Node2D" parent="Enemy"]
unique_name_in_owner = true
`;

  it('does not claim the override in the lenient tree', () => {
    const claims = uniqueNameClaims(new TscnParser().parse(overridden).nodes);
    expect(claims.has('%Hit')).toBe(false);
  });

  it('does not claim the override in the strict tree', () => {
    const claims = uniqueNameClaims(strictScene(overridden).nodes);
    expect(claims.has('%Hit')).toBe(false);
  });

  it('still claims a node ADDED under the instance, whose owner is the scene root', () => {
    const claims = uniqueNameClaims(new TscnParser().parse(overridden).nodes);
    expect(claims.get('%Added')?.path).toBe('Player/Enemy/Added');
  });

  it('claims an override under an inherited-scene ROOT, whose sub-scene root is this root', () => {
    const inherited = `[gd_scene format=3]
[ext_resource type="PackedScene" path="res://base.tscn" id="1"]

[node name="Root" instance=ExtResource("1")]

[node name="Hit" parent="."]
unique_name_in_owner = true
`;
    const claims = uniqueNameClaims(new TscnParser().parse(inherited).nodes);
    expect(claims.get('%Hit')?.path).toBe('Root/Hit');
  });
});

/**
 * The same walk, keeping what `uniqueNameClaims` drops: an override's claim
 * belongs to the instance root that owns it, and an added node inside an
 * instance is still this root's. Both are what a per-owner table is composed
 * from once the sub-scene is loaded.
 */
describe('uniqueNameOwnership', () => {
  const src = `[gd_scene format=3]
[ext_resource type="PackedScene" path="res://enemy.tscn" id="1"]

[node name="Player" type="Node2D"]

[node name="Enemy" parent="." instance=ExtResource("1")]

[node name="Hit" parent="Enemy/Body"]
unique_name_in_owner = true

[node name="Added" type="Node2D" parent="Enemy"]
unique_name_in_owner = true

[node name="Child" type="Node2D" parent="Enemy/Added"]
`;
  const ownership = uniqueNameOwnership(new TscnParser().parse(src).nodes);

  it('keys an override claim by the live path of the instance that owns it', () => {
    const claims = ownership.instanceClaims.get('Player/Enemy');
    expect(claims?.map((c) => c.livePath)).toEqual(['Player/Enemy/Body/Hit']);
    expect(ownership.claims.has('%Hit')).toBe(false);
  });

  it('lists the live paths of this root\'s own nodes that sit inside an instance', () => {
    expect([...ownership.ownedInsideInstances]).toEqual([
      'Player/Enemy/Added',
      'Player/Enemy/Added/Child',
    ]);
  });

  it('is the table uniqueNameClaims returns', () => {
    expect(ownership.claims.get('%Added')?.path).toBe('Player/Enemy/Added');
  });

  it('keys by the NEAREST instance heading, so an added instance owns the overrides under it', () => {
    const nested = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://enemy.tscn" id="1"]
[ext_resource type="PackedScene" path="res://gun.tscn" id="2"]

[node name="Player" type="Node2D"]

[node name="Enemy" parent="." instance=ExtResource("1")]

[node name="Gun" parent="Enemy" instance=ExtResource("2")]

[node name="Barrel" parent="Enemy/Gun"]
unique_name_in_owner = true
`).nodes;
    const { instanceClaims, ownedInsideInstances } = uniqueNameOwnership(nested);
    expect([...instanceClaims.keys()]).toEqual(['Player/Enemy/Gun']);
    expect(ownedInsideInstances.has('Player/Enemy/Gun')).toBe(true);
  });
});
