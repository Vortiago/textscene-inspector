import { describe, expect, it } from 'vitest';
import { TscnParser } from '../parser/TscnParser.js';
import { StrictTscnParser } from '../linter/StrictTscnParser.js';
import { uniqueNameClaims } from './uniqueNames.js';

/**
 * Both trees, every time: the lenient parser keeps `unique_name_in_owner` only in
 * `rawProperties` (a slice's `properties` carries the keys it models), while the
 * strict parser puts it in `properties` and has no `rawProperties`. A predicate
 * reading one shape answers false on the other.
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
  return scene;
}

describe('uniqueNameClaims', () => {
  it('finds a claim in the lenient tree, where the flag is only in rawProperties', () => {
    const claims = uniqueNameClaims(new TscnParser().parse(SRC).nodes);
    expect(claims.get('%Target')?.path).toBe('Root/Target');
  });

  it('finds the same claim in the strict tree, where the flag is in properties', () => {
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
});
