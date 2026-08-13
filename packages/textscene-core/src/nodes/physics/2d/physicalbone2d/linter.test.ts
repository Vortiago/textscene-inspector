/**
 * PhysicalBone2D linter tests — Skeleton2D/PhysicalBone2D ancestry, an
 * assigned bone2d_index, and a Joint2D child when chained under another bone.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { node, scene, lint, expectDiagnostic, expectNoDiagnostic , instanced, override, packedScene} from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';

const here = dirname(fileURLToPath(import.meta.url));
// .../src/nodes/physics/2d/physicalbone2d -> repo root is 7 levels up.
const FIXTURE = resolve(here, '../../../../../../../scenes/fixtures/unit-physical-bone-2d.tscn');

describe('PhysicalBone2D Linter', () => {
  describe('Skeleton2D ancestry (physicalbone2d-missing-skeleton-parent)', () => {
    it('warns when PhysicalBone2D is at the scene root (no parent)', () => {
      expectDiagnostic(scene(node('PhysicalBone2D')), {
        ruleName: 'physicalbone2d-missing-skeleton-parent',
        severity: 'warning',
      });
    });

    it('warns when the parent is neither Skeleton2D nor PhysicalBone2D', () => {
      expectDiagnostic(
        scene(node('Node2D', {}, { name: 'Root' }), node('PhysicalBone2D', { bone2d_index: 0 }, { parent: '.' })),
        { ruleName: 'physicalbone2d-missing-skeleton-parent', severity: 'warning' }
      );
    });

    it('says nothing when an ancestor takes its type from another scene', () => {
      // `_find_skeleton_parent` (physical_bone_2d.cpp:79-95) stops at the first
      // ancestor that is neither a Skeleton2D nor a PhysicalBone2D, so an
      // ancestor whose class is declared elsewhere could be the Skeleton2D, the
      // next bone in the chain, or the terminator. Deciding it is none of the
      // three warns on every rig assembled by instancing one.
      const instancedAncestor = scene(
        packedScene,
        node('Node2D', {}, { name: 'Root' }),
        instanced('Skel', { parent: '.' }),
        node('PhysicalBone2D', { bone2d_index: 0 }, { name: 'Bone', parent: 'Skel' })
      );
      const overrideAncestor = scene(
        packedScene,
        node('Node2D', {}, { name: 'Root' }),
        instanced('Rig', { parent: '.' }),
        override('Skel', 0, { parent: 'Rig' }),
        node('PhysicalBone2D', { bone2d_index: 0 }, { name: 'Bone', parent: 'Rig/Skel' })
      );
      expectNoDiagnostic(instancedAncestor, { ruleName: 'physicalbone2d-missing-skeleton-parent' });
      expectNoDiagnostic(overrideAncestor, { ruleName: 'physicalbone2d-missing-skeleton-parent' });
    });

    it('passes when the direct parent is a Skeleton2D', () => {
      expectNoDiagnostic(
        scene(
          node('Skeleton2D', {}, { name: 'Root' }),
          node('PhysicalBone2D', { bone2d_index: 0 }, { parent: '.' })
        ),
        { ruleName: 'physicalbone2d-missing-skeleton-parent' }
      );
    });

    it('passes when a Skeleton2D is reached through a chain of PhysicalBone2D ancestors', () => {
      expectNoDiagnostic(
        scene(
          node('Skeleton2D', {}, { name: 'Root' }),
          node('PhysicalBone2D', { bone2d_index: 0 }, { name: 'Upper', parent: '.' }),
          node('PhysicalBone2D', { bone2d_index: 1 }, { name: 'Lower', parent: 'Upper' })
        ),
        { ruleName: 'physicalbone2d-missing-skeleton-parent' }
      );
    });

    it('warns when the PhysicalBone2D chain never reaches a Skeleton2D', () => {
      const diagnostics = lint(
        scene(
          node('Node2D', {}, { name: 'Root' }),
          node('PhysicalBone2D', { bone2d_index: 0 }, { name: 'Upper', parent: '.' }),
          node('PhysicalBone2D', { bone2d_index: 1 }, { name: 'Lower', parent: 'Upper' })
        )
      );
      const lower = diagnostics.find(
        (d) => d.ruleName === 'physicalbone2d-missing-skeleton-parent' && d.nodeName === 'Lower'
      );
      expect(lower).toBeDefined();
      expect(lower?.severity).toBe('warning');
    });
  });

  describe('bone index assignment (physicalbone2d-missing-bone-index)', () => {
    it('warns when bone2d_index is left at the default -1 under a Skeleton2D', () => {
      expectDiagnostic(
        scene(node('Skeleton2D', {}, { name: 'Root' }), node('PhysicalBone2D', {}, { parent: '.' })),
        { ruleName: 'physicalbone2d-missing-bone-index', severity: 'warning' }
      );
    });

    it('warns when bone2d_index is explicitly -1', () => {
      expectDiagnostic(
        scene(
          node('Skeleton2D', {}, { name: 'Root' }),
          node('PhysicalBone2D', { bone2d_index: -1 }, { parent: '.' })
        ),
        { ruleName: 'physicalbone2d-missing-bone-index' }
      );
    });

    it('passes when bone2d_index is assigned', () => {
      expectNoDiagnostic(
        scene(node('Skeleton2D', {}, { name: 'Root' }), node('PhysicalBone2D', { bone2d_index: 0 }, { parent: '.' })),
        { ruleName: 'physicalbone2d-missing-bone-index' }
      );
    });

    it('does not ALSO warn about the bone index when there is no Skeleton2D ancestor at all', () => {
      // physical_bone_2d.cpp:112-116 only checks bone2d_index once parent_skeleton
      // was found; without an ancestor the missing-skeleton-parent warning alone fires.
      const diagnostics = lint(
        `[gd_scene format=3]\n\n[node name="Root" type="Node2D"]\n\n[node name="Bone" type="PhysicalBone2D" parent="."]\n`
      );
      const own = diagnostics.filter((d) => d.nodeType === 'PhysicalBone2D');
      expect(own.map((d) => d.ruleName)).toEqual(['physicalbone2d-missing-skeleton-parent']);
    });
  });

  describe('Joint2D child when chained (physicalbone2d-missing-joint-child)', () => {
    it('warns when a PhysicalBone2D is parented under another PhysicalBone2D with no Joint2D child', () => {
      expectDiagnostic(
        scene(
          node('Skeleton2D', {}, { name: 'Root' }),
          node('PhysicalBone2D', { bone2d_index: 0 }, { name: 'Upper', parent: '.' }),
          node('PhysicalBone2D', { bone2d_index: 1 }, { name: 'Lower', parent: 'Upper' })
        ),
        { ruleName: 'physicalbone2d-missing-joint-child', severity: 'warning' }
      );
    });

    it('passes when the chained PhysicalBone2D has a PinJoint2D child', () => {
      expectNoDiagnostic(
        scene(
          node('Skeleton2D', {}, { name: 'Root' }),
          node('PhysicalBone2D', { bone2d_index: 0 }, { name: 'Upper', parent: '.' }),
          node('PhysicalBone2D', { bone2d_index: 1 }, { name: 'Lower', parent: 'Upper' }),
          node('PinJoint2D', {}, { parent: 'Upper/Lower' })
        ),
        { ruleName: 'physicalbone2d-missing-joint-child' }
      );
    });

    it('does not require a Joint2D child for a top-level PhysicalBone2D (parent is the Skeleton2D)', () => {
      expectNoDiagnostic(
        scene(node('Skeleton2D', {}, { name: 'Root' }), node('PhysicalBone2D', { bone2d_index: 0 }, { parent: '.' })),
        { ruleName: 'physicalbone2d-missing-joint-child' }
      );
    });
  });

  it('lints the shipped fixture clean — zero errors, zero PhysicalBone2D diagnostics at all', () => {
    const diagnostics = lint(readFileSync(FIXTURE, 'utf8'));
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(diagnostics.filter((d) => d.nodeType === 'PhysicalBone2D')).toEqual([]);
  });
});
