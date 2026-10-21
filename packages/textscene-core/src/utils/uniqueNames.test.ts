import { describe, expect, it } from 'vitest';
import { TscnParser } from '../parser/TscnParser.js';
import { StrictTscnParser } from '../linter/StrictTscnParser.js';
import type { RawNode } from '../parser/types.js';
import { cachedUniqueNameOwnership } from './uniqueNames.js';

/**
 * Both trees, every time. They agree on `rawProperties` (`parser/rawPropertyParity.test.ts`), but
 * only a real parse proves this reads that field: a hand-built `TscnNode` takes its author's shape.
 */
const SRC = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Target" type="Node3D" parent="."]
unique_name_in_owner = true

[node name="Plain" type="Node3D" parent="."]

[node name="Nested" type="Node3D" parent="Target"]
unique_name_in_owner = true
`;

/** Two claimants of `%X`, declared out of tree order: `Q/X` first, `P/X` second, while `P` sits before `Q`. */
const OUT_OF_ORDER = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="P" type="Node3D" parent="."]

[node name="Q" type="Node3D" parent="."]

[node name="X" type="Node3D" parent="Q"]
unique_name_in_owner = true

[node name="X" type="Node3D" parent="P"]
unique_name_in_owner = true
`;

function strictScene(source: string) {
  const { scene } = new StrictTscnParser().parse(source);
  // Absent only if the scanner could not run, which these sources do not provoke: a broken test.
  if (!scene) throw new Error('strict parser produced no scene');
  return scene;
}

/** The child of the scene root called `name`. */
function instanceNamed(roots: readonly RawNode[], name: string): RawNode {
  return roots[0]!.children.find((n) => n.name === name)!;
}

describe("the root's claim table", () => {
  it('finds a claim in the lenient tree, whose typed properties never carry the flag', () => {
    const claims = cachedUniqueNameOwnership(new TscnParser().parse(SRC).nodes).claims;
    expect(claims.get('%Target')?.path).toBe('Root/Target');
  });

  it('finds the same claim in the strict tree', () => {
    const claims = cachedUniqueNameOwnership(strictScene(SRC).nodes).claims;
    expect(claims.get('%Target')?.path).toBe('Root/Target');
  });

  it('claims a descendant at any depth, not just a root child', () => {
    const claims = cachedUniqueNameOwnership(new TscnParser().parse(SRC).nodes).claims;
    expect(claims.get('%Nested')?.path).toBe('Root/Target/Nested');
  });

  it('leaves a node without the flag unclaimed', () => {
    const claims = cachedUniqueNameOwnership(new TscnParser().parse(SRC).nodes).claims;
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
    const claims = cachedUniqueNameOwnership(new TscnParser().parse(duplicate).nodes).claims;
    expect(claims.get('%Dup')?.path).toBe('Root/First/Dup');
  });

  it('carries the node itself, so a caller can read its type', () => {
    const claims = cachedUniqueNameOwnership(new TscnParser().parse(SRC).nodes).claims;
    expect(claims.get('%Target')?.node.type).toBe('Node3D');
  });

  it('spells livePath through the instanced content a parent= descends into', () => {
    // `seatScene` can only anchor `parent="Bike/Body"` at the instance node
    // and records `Body` as the remainder, so the authored tree has the claimant
    // one level up from where the composed tree draws it.
    const into = `[gd_scene format=3]
[ext_resource type="PackedScene" path="res://bike.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Bike" parent="." instance=ExtResource("1")]

[node name="Sight" type="Node2D" parent="Bike/Body"]
unique_name_in_owner = true
`;
    const claim = cachedUniqueNameOwnership(new TscnParser().parse(into).nodes).claims.get('%Sight');
    expect(claim?.path).toBe('Root/Bike/Sight');
    expect(claim?.livePath).toBe('Root/Bike/Body/Sight');
  });

  it('leaves livePath equal to path where nothing is instanced', () => {
    const claims = cachedUniqueNameOwnership(new TscnParser().parse(SRC).nodes).claims;
    expect(claims.get('%Nested')?.livePath).toBe('Root/Target/Nested');
  });
});

describe('the claim table cache', () => {
  it('hands every caller over one roots array the same table object', () => {
    const roots = new TscnParser().parse(SRC).nodes;
    const first = cachedUniqueNameOwnership(roots).claims;
    expect(first.has('%Target')).toBe(true);
    expect(cachedUniqueNameOwnership(roots).claims).toBe(first);
  });

  it('builds a new table for a re-parse of the same source', () => {
    const first = cachedUniqueNameOwnership(new TscnParser().parse(SRC).nodes).claims;
    expect(cachedUniqueNameOwnership(new TscnParser().parse(SRC).nodes).claims).not.toBe(first);
  });

  it('is empty for a tree with no claim', () => {
    const roots = new TscnParser().parse('[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n').nodes;
    expect(cachedUniqueNameOwnership(roots).claims.size).toBe(0);
  });
});

describe('override headings inside an instanced sub-scene', () => {
  // An override keeps its sub-scene owner (resource_format_text.cpp:259-261). node.cpp:2222-2233
  // registers `%Name` there and node.cpp:1930-1938 reads only the caller's owner table, so the
  // outer `%Hit` addresses nothing. Probed on 4.6.3: `Hit.owner == Enemy` and
  // `Player.get_node_or_null("%Hit") == null`.
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
    const claims = cachedUniqueNameOwnership(new TscnParser().parse(overridden).nodes).claims;
    expect(claims.has('%Hit')).toBe(false);
  });

  it('does not claim the override in the strict tree', () => {
    const claims = cachedUniqueNameOwnership(strictScene(overridden).nodes).claims;
    expect(claims.has('%Hit')).toBe(false);
  });

  it('still claims a node ADDED under the instance, whose owner is the scene root', () => {
    const claims = cachedUniqueNameOwnership(new TscnParser().parse(overridden).nodes).claims;
    expect(claims.get('%Added')?.path).toBe('Player/Enemy/Added');
  });

  it('claims an override under an inherited-scene ROOT, whose sub-scene root is this root', () => {
    const inherited = `[gd_scene format=3]
[ext_resource type="PackedScene" path="res://base.tscn" id="1"]

[node name="Root" instance=ExtResource("1")]

[node name="Hit" parent="."]
unique_name_in_owner = true
`;
    const claims = cachedUniqueNameOwnership(new TscnParser().parse(inherited).nodes).claims;
    expect(claims.get('%Hit')?.path).toBe('Root/Hit');
  });
});

/**
 * The same walk, keeping what the root's claim table drops: an override's claim belongs to its
 * instance root, and a node added inside an instance is this root's. A per-owner table is
 * composed from both once the sub-scene loads.
 */
describe('cachedUniqueNameOwnership', () => {
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
  const ownership = cachedUniqueNameOwnership(new TscnParser().parse(src).nodes);

  it('leaves an override setting out of the root table', () => {
    expect(ownership.claims.has('%Hit')).toBe(false);
  });

  it('gives the instance node the setting at its path below that instance', () => {
    const enemy = new TscnParser().parse(src).nodes[0]!.children.find((n) => n.name === 'Enemy')!;
    expect(enemy.instanceNameSettings).toEqual([
      { pathInInstance: 'Body/Hit', isUnique: true, hostChildrenBefore: 1 },
    ]);
  });

  it('records a release, which an override writes as false (node.cpp:2236-2249)', () => {
    const released = instanceNamed(
      new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://enemy.tscn" id="1"]

[node name="Player" type="Node2D"]

[node name="Enemy" parent="." instance=ExtResource("1")]

[node name="Body" parent="Enemy"]
unique_name_in_owner = false
`).nodes,
      'Enemy'
    );
    expect(released.instanceNameSettings).toEqual([
      { pathInInstance: 'Body', isUnique: false, hostChildrenBefore: 1 },
    ]);
  });

  it('keeps each instance its own settings in file order', () => {
    const interleaved = instanceNamed(
      new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://enemy.tscn" id="1"]

[node name="Player" type="Node2D"]

[node name="A" parent="." instance=ExtResource("1")]

[node name="B" parent="." instance=ExtResource("1")]

[node name="X" parent="A"]
unique_name_in_owner = true

[node name="Y" parent="B"]
unique_name_in_owner = true

[node name="Z" parent="A"]
unique_name_in_owner = true
`).nodes,
      'A'
    );
    expect(interleaved.instanceNameSettings?.map((s) => s.pathInInstance)).toEqual(['X', 'Z']);
  });

  it("lists the live paths of this root's own nodes that sit inside an instance", () => {
    expect(
      [...ownership.insideInstances].filter(([, headings]) => headings.isRootOwned).map(([path]) => path)
    ).toEqual(['Player/Enemy/Added', 'Player/Enemy/Added/Child']);
  });

  it("holds the root's claim table", () => {
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
    const gun = instanceNamed(nested, 'Enemy').children.find((n) => n.name === 'Gun')!;
    expect(gun.instanceNameSettings?.map((s) => s.pathInInstance)).toEqual(['Barrel']);
    expect(cachedUniqueNameOwnership(nested).insideInstances.get('Player/Enemy/Gun')?.isRootOwned).toBe(true);
  });

  it('records no live path for a nameless heading inside an instance, which has none of its own', () => {
    const nameless = new TscnParser().parse(`[gd_scene format=3]
[ext_resource type="PackedScene" path="res://enemy.tscn" id="1"]

[node name="Player" type="Node2D"]

[node name="Enemy" parent="." instance=ExtResource("1")]

[node type="Node2D" parent="Enemy"]
`).nodes;
    expect(cachedUniqueNameOwnership(nameless).insideInstances.size).toBe(0);
  });
});

describe('an explicit owner= on a node heading', () => {
  // The loader resolves an `owner=` NodePath from the scene root and sets it
  // on the node (resource_format_text.cpp:257-262, packed_scene.cpp NODE_FROM_ID
  // on `n.owner`), so it decides which table `%Name` registers on.
  const explicit = `[gd_scene format=3]
[ext_resource type="PackedScene" path="res://enemy.tscn" id="1"]

[node name="Player" type="Node2D"]

[node name="Enemy" parent="." instance=ExtResource("1")]

[node name="Hit" type="Area2D" parent="Enemy/Body" owner="Enemy"]
unique_name_in_owner = true

[node name="Hud" parent="Enemy" owner="."]
unique_name_in_owner = true
`;

  it('is kept as written by both parsers', () => {
    const lenient = new TscnParser().parse(explicit).nodes[0]!;
    const strict = strictScene(explicit).nodes[0]!;
    for (const root of [lenient, strict]) {
      const enemy = root.children.find((n) => n.name === 'Enemy')!;
      const hit = enemy.children.find((n) => n.name === 'Hit')!;
      const hud = enemy.children.find((n) => n.name === 'Hud')!;
      expect(hit.owner).toBe('Enemy');
      expect(hud.owner).toBe('.');
    }
  });

  it('registers the claim on the named owner, not on this root', () => {
    const ownership = cachedUniqueNameOwnership(new TscnParser().parse(explicit).nodes);
    expect(ownership.claims.has('%Hit')).toBe(false);
  });

  it('gives the instance node an explicit owner below it, empty for the instance itself', () => {
    const enemy = new TscnParser().parse(explicit).nodes[0]!.children.find((n) => n.name === 'Enemy')!;
    expect(enemy.instanceNameSettings).toEqual([
      { pathInInstance: 'Body/Hit', isUnique: true, ownerInInstance: '', hostChildrenBefore: 1 },
    ]);
  });

  it('owner="." claims for this root even on an override inside an instance', () => {
    const ownership = cachedUniqueNameOwnership(new TscnParser().parse(explicit).nodes);
    expect(ownership.claims.get('%Hud')?.path).toBe('Player/Enemy/Hud');
  });
});

describe('the first claimant', () => {
  // Instantiate sets each owner in declaration order (packed_scene.cpp:565-570), and a later
  // claimant is refused (node.cpp:2225-2231), so file order decides, not tree order.
  it('is the one declared first, on the lenient tree', () => {
    expect(cachedUniqueNameOwnership(new TscnParser().parse(OUT_OF_ORDER).nodes).claims.get('%X')?.path).toBe(
      'Root/Q/X'
    );
  });

  it('is the one declared first, on the strict tree', () => {
    expect(cachedUniqueNameOwnership(strictScene(OUT_OF_ORDER).nodes).claims.get('%X')?.path).toBe(
      'Root/Q/X'
    );
  });
});
