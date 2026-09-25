/**
 * `parentTypeVerdict`'s three ways of not knowing, a union so a rule chooses
 * between them. A wrong `unknowable` announces a defect in a scene the linter
 * cannot see into. `visibleInTreeVerdict` is tested in `parentType.visibility.test.ts`
 * and `parentType.canvasItemVisibility.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { knownParent, parentIdentity, parentTypeVerdict, placementPhrase } from './parentType.js';
import { byName } from './testing/sceneNodes.js';
import { TscnParser } from '../parser/TscnParser.js';

/**
 * The lenient parser, constructed here rather than in `testing/sceneNodes.ts`:
 * importing it pulls every node slice's registration, and this is the only one
 * of the three `parentType.*` files that needs it.
 */
const parse = (source: string) => new TscnParser().parse(source);

describe('the two doors to a parent', () => {
  const overridden = () =>
    parse(
      `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Mid" parent="."]

[node name="Leaf" type="Sprite2D" parent="Mid"]
`
    );

  it('knownParent declines a parent whose type this file never states', () => {
    const scene = overridden();
    expect(knownParent(scene, byName(scene.nodes, 'Leaf')).kind).toBe('unknowable');
  });

  it('declines a parent whose stated type ClassDB does not know', () => {
    // Godot's own check is a runtime `cast_to` against a ClassDB with every
    // GDExtension registered (collision_shape_3d.cpp:125-128). A `.tscn` names
    // only the class, so ancestry outside the catalog is undecidable, as for
    // `JBody3D`, a Jolt extension class.
    const scene = new TscnParser().parse(
      `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Body" type="JBody3D" parent="."]

[node name="Shape" type="CollisionShape3D" parent="Body"]
`
    );
    expect(parentTypeVerdict(scene, byName(scene.nodes, 'Shape'), 'CollisionObject3D').kind).toBe(
      'unknowable'
    );
  });

  it('still decides against a parent the catalog DOES know', () => {
    const scene = new TscnParser().parse(
      `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Body" type="Node3D" parent="."]

[node name="Shape" type="CollisionShape3D" parent="Body"]
`
    );
    expect(parentTypeVerdict(scene, byName(scene.nodes, 'Shape'), 'CollisionObject3D').kind).toBe(
      'mismatch'
    );
  });

  it('parentIdentity hands the same node back, because identity is knowable', () => {
    // A NodePath `..` is `get_parent()` and never reads the class, so declining
    // here would stop a walk over a node the file names.
    const scene = overridden();
    expect(parentIdentity(scene, byName(scene.nodes, 'Leaf'))?.name).toBe('Mid');
  });

  it('parentIdentity is null at the scene root, where there is no parent at all', () => {
    const scene = overridden();
    expect(parentIdentity(scene, byName(scene.nodes, 'Root'))).toBeNull();
  });
});

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
    // A heading with neither `type=` nor `instance=` overrides a node inside an
    // instanced ancestor, whose real type lives in that other scene. But
    // `NodeRegistry.ts:109` defaults a missing type to `'Node'`, so a check of
    // `!parent.type` sees a confident `'Node'` and answers `mismatch`.
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

describe('an ancestor Godot\'s catalog does not know', () => {
  const scene = parse(
    `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Ext" type="JSkeleton2D" parent="."]

[node name="Bone" type="Bone2D" parent="Ext"]
`
  );
  const bone = byName(scene.nodes, 'Bone');

  it('is unknowable at the walk, not a mismatch at each caller', () => {
    // `descendsFrom` is false for "not a subclass" and "never heard of it"
    // alike, so a GDExtension parent read as the former warns about a correct
    // scene. The check lives in `knownParent`, so every caller reading
    // `ancestor.type` through `searchAncestors` gets it.
    expect(knownParent(scene, bone).kind).toBe('unknowable');
    expect(parentTypeVerdict(scene, bone, 'Skeleton2D').kind).toBe('unknowable');
  });

  it('still resolves as an identity, which reads no type', () => {
    expect(parentIdentity(scene, bone)?.name).toBe('Ext');
  });
});
