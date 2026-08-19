/**
 * A `[node]` whose `parent=` path names nothing still gets a diagnostic.
 *
 * `buildSceneTree` cannot place it, so Phase 2 walks a tree it is not in and
 * every semantic rule skips it AND its descendants without a word. Godot does
 * not merely drop it either: `SceneState::instantiate` warns "Parent path '…'
 * for node '…' has vanished when instantiating" and re-parents the node to the
 * scene root under `<parent path>#<name>` (`packed_scene.cpp:208-215`,
 * `:561-563`), so the engine reports it and the tier is a warning.
 */

import { describe, expect, it } from 'vitest';
import { Linter } from './Linter.js';
import './index.js';

const linter = new Linter();

/** A StaticBody2D with no shape — the rule that proves Phase 2 reached a node. */
const NEEDS_SHAPE = 'staticbody2d-needs-collision-shape';

function lint(source: string) {
  return linter.lint(source);
}

describe('a parent path this file never defines', () => {
  const dangling = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Body" type="StaticBody2D" parent="NoSuchNode"]
`;

  it('reports the node, its path, and the line its heading is on', () => {
    const orphans = lint(dangling).filter((d) => d.ruleName === 'unresolved-parent-path');
    expect(orphans).toHaveLength(1);
    expect(orphans[0]?.severity).toBe('warning');
    expect(orphans[0]?.nodeName).toBe('Body');
    expect(orphans[0]?.message).toContain('NoSuchNode');
    expect(orphans[0]?.location?.line).toBe(5);
  });

  it('says the semantic rules did not run on it', () => {
    // The claim has to be this narrow: property validation happens during the
    // scan, so Phase 1 still covered the node's own values.
    expect(lint(dangling).some((d) => d.ruleName === NEEDS_SHAPE)).toBe(false);
    const placed = dangling.replace('NoSuchNode', '.');
    expect(lint(placed).some((d) => d.ruleName === NEEDS_SHAPE)).toBe(true);
  });

  it('reports every node in the stranded subtree, as Godot warns per node', () => {
    // `Child`'s own path resolves only THROUGH `Body`, which was never placed,
    // so Godot re-roots and renames both — one warning each.
    const names = lint(`${dangling}
[node name="Child" type="StaticBody2D" parent="NoSuchNode/Body"]
`)
      .filter((d) => d.ruleName === 'unresolved-parent-path')
      .map((d) => d.nodeName)
      .sort();
    expect(names).toEqual(['Body', 'Child']);
  });

  it('leaves a path that descends into instanced content alone', () => {
    // The intermediate names live in the sub-scene, not here, so the node is
    // anchored to the instance rather than stranded.
    const instanced = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="1_a"]

[node name="Root" type="Node2D"]

[node name="Player" parent="." instance=ExtResource("1_a")]

[node name="Hat" type="Sprite2D" parent="Player/Head"]
`;
    expect(lint(instanced).filter((d) => d.ruleName === 'unresolved-parent-path')).toEqual([]);
  });

  it('errors on a second heading that declares no parent at all', () => {
    // `packed_scene.cpp:206` returns nullptr for the whole scene, so this one
    // does not load at all — a tier above the vanished-path case beside it.
    const twoRoots = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Stray" type="Node2D"]
`;
    const errors = lint(twoRoots).filter((d) => d.ruleName === 'node-without-parent');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.severity).toBe('error');
    expect(errors[0]?.nodeName).toBe('Stray');
  });

  it('spells the re-parented name the way Godot does', () => {
    // `./` stripped, every `/` to `@`, then `#` and the node's own name.
    const nested = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Leaf" type="Node2D" parent="Gone/Deeper"]
`;
    expect(lint(nested)[0]?.message).toContain('"Gone@Deeper#Leaf"');
  });

  it('says nothing about a scene whose every parent path resolves', () => {
    const sound = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Mid" type="Node2D" parent="."]

[node name="Leaf" type="Sprite2D" parent="Mid"]
`;
    expect(lint(sound).filter((d) => d.ruleName === 'unresolved-parent-path')).toEqual([]);
  });
});
