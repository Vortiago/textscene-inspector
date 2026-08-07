/**
 * Bone2D linter tests — `Bone2D::get_configuration_warnings()`
 * (skeleton_2d.cpp:412-427): the ancestor chain must reach a Skeleton2D, the
 * immediate parent must be a Skeleton2D or Bone2D, and `rest` must not be the
 * all-zero Transform2D.
 */
import { describe, it, expect } from 'vitest';
import { node, scene, lint, expectDiagnostic, expectNoDiagnostic } from '../../../linter/testing/testkit';
import { readFixture } from '../../../linter/testing/fixtureCheck';
import './linterParser';
import './linter';

describe('Bone2D Linter', () => {
  describe('ancestry (bone2d-chain-does-not-terminate / bone2d-invalid-parent)', () => {
    it('passes when the immediate parent is a Skeleton2D', () => {
      expectNoDiagnostic(
        scene(node('Skeleton2D', {}, { name: 'Root' }), node('Bone2D', {}, { parent: '.' })),
        { ruleName: 'bone2d-invalid-parent' }
      );
      expectNoDiagnostic(
        scene(node('Skeleton2D', {}, { name: 'Root' }), node('Bone2D', {}, { parent: '.' })),
        { ruleName: 'bone2d-chain-does-not-terminate' }
      );
    });

    it('passes when a chain of Bone2D parents eventually reaches a Skeleton2D', () => {
      expectNoDiagnostic(
        scene(
          node('Skeleton2D', {}, { name: 'Root' }),
          node('Bone2D', {}, { name: 'Mid', parent: '.' }),
          node('Bone2D', {}, { name: 'Leaf', parent: 'Mid' })
        ),
        { ruleName: 'bone2d-chain-does-not-terminate' }
      );
    });

    it('warns "chain does not terminate" when the Bone2D chain never reaches a Skeleton2D', () => {
      const diagnostic = expectDiagnostic(
        scene(
          node('Node2D', {}, { name: 'Root' }),
          node('Bone2D', {}, { name: 'Mid', parent: '.' }),
          node('Bone2D', {}, { name: 'Leaf', parent: 'Mid' })
        ),
        { ruleName: 'bone2d-chain-does-not-terminate', severity: 'warning' }
      );
      expect(diagnostic.nodeName).toBe('Leaf');
    });

    it('warns "invalid parent" at the scene root (no parent at all)', () => {
      expectDiagnostic(scene(node('Bone2D')), {
        ruleName: 'bone2d-invalid-parent',
        severity: 'warning',
      });
    });

    it('warns "invalid parent" when the immediate parent is neither Skeleton2D nor Bone2D', () => {
      expectDiagnostic(
        scene(node('Node2D', {}, { name: 'Root' }), node('Bone2D', {}, { parent: '.' })),
        { ruleName: 'bone2d-invalid-parent', severity: 'warning' }
      );
    });

    it('never raises both verdicts on the same node (the two are mutually exclusive per-node)', () => {
      // "Leaf" has a Bone2D parent ("Mid") whose own chain never reaches a
      // Skeleton2D, so Leaf gets ONLY chain-broken — "Mid" itself separately
      // trips invalid-parent (its own parent, "Root", is a plain Node2D), but
      // that is a diagnostic about Mid, not about Leaf.
      const diagnostics = lint(
        scene(
          node('Node2D', {}, { name: 'Root' }),
          node('Bone2D', {}, { name: 'Mid', parent: '.' }),
          node('Bone2D', {}, { name: 'Leaf', parent: 'Mid' })
        )
      ).filter((d) => d.nodeName === 'Leaf');
      expect(diagnostics.map((d) => d.ruleName)).toEqual(['bone2d-chain-does-not-terminate']);
    });

    it('stays quiet when the parent is an untyped instance whose type it cannot know', () => {
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://rig.tscn" id="1"]

[node name="Root" type="Node2D"]

[node name="Rig" parent="." instance=ExtResource("1")]

[node name="MyBone2D" type="Bone2D" parent="Rig"]
`;
      const diagnostics = lint(content).filter((d) => d.nodeType === 'Bone2D');
      expect(diagnostics).toEqual([]);
    });

    it('stays quiet when a further ancestor up a Bone2D chain is an untyped instance', () => {
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://rig.tscn" id="1"]

[node name="Rig" instance=ExtResource("1")]

[node name="Mid" type="Bone2D" parent="."]

[node name="Leaf" type="Bone2D" parent="Mid"]
`;
      const diagnostics = lint(content).filter((d) => d.nodeType === 'Bone2D');
      expect(diagnostics).toEqual([]);
    });
  });

  describe('rest pose (bone2d-missing-rest-pose)', () => {
    it('passes when rest is absent (identity default, skeleton_2d.h:48)', () => {
      expectNoDiagnostic(
        scene(node('Skeleton2D', {}, { name: 'Root' }), node('Bone2D', {}, { parent: '.' })),
        { ruleName: 'bone2d-missing-rest-pose' }
      );
    });

    it('passes when rest is a real, non-zero Transform2D', () => {
      expectNoDiagnostic(
        scene(
          node('Skeleton2D', {}, { name: 'Root' }),
          node('Bone2D', { rest: 'Transform2D(1, 0, 0, 1, 10, 20)' }, { parent: '.' })
        ),
        { ruleName: 'bone2d-missing-rest-pose' }
      );
    });

    it('warns when rest is explicitly the all-zero Transform2D', () => {
      expectDiagnostic(
        scene(
          node('Skeleton2D', {}, { name: 'Root' }),
          node('Bone2D', { rest: 'Transform2D(0, 0, 0, 0, 0, 0)' }, { parent: '.' })
        ),
        { ruleName: 'bone2d-missing-rest-pose', severity: 'warning' }
      );
    });
  });

  it('lints the shipped fixture clean — zero Bone2D diagnostics at all', () => {
    const diagnostics = lint(readFixture('unit-bone-2d.tscn'));
    expect(diagnostics.filter((d) => d.nodeType === 'Bone2D')).toEqual([]);
  });
});
