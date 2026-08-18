/**
 * The two parsers share one scanning loop and diverge only in their NodeCreator,
 * so the RAW property bag they see is identical by construction. This pins the
 * field it lands in.
 *
 * Without it the raw bag is `rawProperties` on the lenient tree and `properties`
 * on the strict one, and a helper both halves call answers false on whichever
 * shape its author did not have in mind — silently, because both fields exist on
 * `TscnNode` and neither read is a type error.
 */

import { describe, expect, it } from 'vitest';
import { TscnParser } from './TscnParser.js';
import { StrictTscnParser } from '../linter/StrictTscnParser.js';
import type { TscnNode } from './types.js';

const SRC = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Modelled" type="Camera3D" parent="."]
fov = 42.0
current = true

[node name="Unmodelled" type="Node3D" parent="."]
unique_name_in_owner = true
editor_description = "note"
`;

function rawByName(nodes: TscnNode[], out = new Map<string, Record<string, string>>()) {
  for (const node of nodes) {
    out.set(node.name, node.rawProperties ?? {});
    rawByName(node.children, out);
  }
  return out;
}

describe('raw property bag, across both parsers', () => {
  const lenient = rawByName(new TscnParser().parse(SRC).nodes);
  const strict = rawByName(new StrictTscnParser().parse(SRC).scene.nodes);

  it('lands in rawProperties on both trees', () => {
    expect([...strict.keys()].sort()).toEqual([...lenient.keys()].sort());
    for (const [name, raw] of lenient) {
      expect(strict.get(name)).toEqual(raw);
    }
  });

  it('keeps keys a slice models, which the lenient tree moves out of properties', () => {
    // `fov` is typed away into Camera3DProperties; the raw literal stays readable.
    expect(lenient.get('Modelled')?.fov).toBe('42.0');
    expect(strict.get('Modelled')?.fov).toBe('42.0');
  });

  it('keeps keys no slice models', () => {
    expect(lenient.get('Unmodelled')?.unique_name_in_owner).toBe('true');
    expect(strict.get('Unmodelled')?.unique_name_in_owner).toBe('true');
  });
});
