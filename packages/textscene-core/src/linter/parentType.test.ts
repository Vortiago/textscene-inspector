/**
 * `parentTypeVerdict`'s three ways of not knowing.
 *
 * The union exists so a rule has to choose deliberately between them, and the
 * arm that matters most is `unknowable`: getting it wrong means announcing a
 * defect in a scene the linter cannot actually see into.
 *
 * `visibleInTreeVerdict`, the other family in `parentType.ts`, is the siblings
 * `parentType.visibility.test.ts` and `parentType.canvasItemVisibility.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { parentTypeVerdict, placementPhrase } from './parentType.js';
import { byName } from './testing/sceneNodes.js';
import { TscnParser } from '../parser/TscnParser.js';

/**
 * The lenient parser, constructed here rather than in `testing/sceneNodes.ts`:
 * importing it pulls every node slice's registration, and this is the only one
 * of the three `parentType.*` files that needs it.
 */
const parse = (source: string) => new TscnParser().parse(source);

describe('parentTypeVerdict', () => {
  it('is satisfied by the wanted type, and carries the parent', () => {
    const scene = parse(
      `[gd_scene format=3]

[node name="Skel" type="Skeleton3D"]

[node name="Mod" type="AimModifier3D" parent="."]
`
    );
    const verdict = parentTypeVerdict(scene, byName(scene.nodes, 'Mod'), 'Skeleton3D');
    expect(verdict.kind).toBe('satisfied');
    expect(verdict.kind === 'satisfied' && verdict.parent.name).toBe('Skel');
  });

  it('is satisfied by a subclass, not just the exact name', () => {
    const scene = parse(
      `[gd_scene format=3]

[node name="Body" type="RigidBody3D"]

[node name="Shape" type="CollisionShape3D" parent="."]
`
    );
    expect(parentTypeVerdict(scene, byName(scene.nodes, 'Shape'), 'CollisionObject3D').kind).toBe(
      'satisfied'
    );
  });

  it('separates a parentless root from a wrong parent', () => {
    const scene = parse(
      `[gd_scene format=3]

[node name="Lonely" type="AimModifier3D"]
`
    );
    expect(parentTypeVerdict(scene, byName(scene.nodes, 'Lonely'), 'Skeleton3D').kind).toBe('root');

    const mismatched = parse(
      `[gd_scene format=3]

[node name="Holder" type="Node3D"]

[node name="Mod" type="AimModifier3D" parent="."]
`
    );
    const verdict = parentTypeVerdict(mismatched, byName(mismatched.nodes, 'Mod'), 'Skeleton3D');
    expect(verdict.kind).toBe('mismatch');
    expect(placementPhrase(verdict)).toBe('a child of a Node3D node');
  });

  it('cannot know the type of an instanced parent', () => {
    const scene = parse(
      `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://char.tscn" id="1"]

[node name="Char" instance=ExtResource("1")]

[node name="Mod" type="AimModifier3D" parent="."]
`
    );
    expect(parentTypeVerdict(scene, byName(scene.nodes, 'Mod'), 'Skeleton3D').kind).toBe(
      'unknowable'
    );
  });

  it('cannot know the type of a parent that only OVERRIDES one inside an instance', () => {
    // The regression this file was written for. A heading with neither `type=`
    // nor `instance=` overrides a node already present inside an instanced
    // ancestor, and its real type lives in that other scene. But
    // `NodeRegistry.ts:109` defaults a missing type to `'Node'`, so a check of
    // `!parent.type` sees a confident `'Node'` and answers `mismatch` — which
    // made the linter report a misplaced skeleton modifier in Godot's own
    // shipped ragdoll demo.
    const scene = parse(
      `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://mannequiny.tscn" id="1"]

[node name="Mannequiny" instance=ExtResource("1")]

[node name="Skeleton3D" parent="." index="0"]

[node name="Sim" type="PhysicalBoneSimulator3D" parent="Skeleton3D" index="1"]
`
    );
    const parent = byName(scene.nodes, 'Skeleton3D');
    expect(parent.overridesExistingNode).toBe(true);
    expect(parent.type).toBe('Node'); // the default that made the old check lie

    expect(parentTypeVerdict(scene, byName(scene.nodes, 'Sim'), 'Skeleton3D').kind).toBe(
      'unknowable'
    );
  });
});
