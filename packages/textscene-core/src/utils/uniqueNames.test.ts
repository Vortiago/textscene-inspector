import { describe, expect, it } from 'vitest';
import { TscnParser } from '../parser/TscnParser.js';
import { StrictTscnParser } from '../linter/StrictTscnParser.js';
import { uniqueNameClaims } from './uniqueNames.js';

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
});
