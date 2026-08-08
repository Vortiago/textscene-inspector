/**
 * Tests for OccluderInstance3D's semantic linter rule (strict-parser format
 * checks live in linterParser.test.ts and are asserted through
 * validatorRegistry there).
 *
 * Calls `occluderInstance3DConfigurationWarningsRule.check(...)` directly with
 * a hand-built `RuleContext` rather than going through `Linter` or
 * `ruleRegistry`: both run every rule the GLOBAL registry singleton happens to
 * hold, which during a concurrent wave is whatever sibling slices another test
 * file has imported. The exported rule object reaches only this slice.
 */

import { describe, expect, it } from 'vitest';
import type { RuleContext } from '../../../linter/types';
import type { TscnNode, TscnScene } from '../../../parser/types';
import { StrictTscnParser } from '../../../linter/StrictTscnParser';
import { readFixture } from '../../../linter/testing/fixtureCheck';
import { occluderInstance3DConfigurationWarningsRule } from './linter';

/** Depth-first search for the first node of a type, over a parsed scene tree. */
function findByType(nodes: TscnNode[], type: string): TscnNode | undefined {
  for (const node of nodes) {
    if (node.type === type) return node;
    const found = findByType(node.children ?? [], type);
    if (found) return found;
  }
  return undefined;
}

function makeContext(properties: Record<string, string>): RuleContext {
  const node: TscnNode = {
    name: 'MyOccluderInstance3D',
    type: 'OccluderInstance3D',
    children: [],
    properties,
  };
  const scene: TscnScene = { nodes: [node], externalResources: [], internalResources: [] };
  return { scene, node, properties: node.properties };
}

const RULE = occluderInstance3DConfigurationWarningsRule;

describe('OccluderInstance3D semantic rules', () => {
  describe('empty bake mask (occluder_instance_3d.cpp:700-702)', () => {
    it('stays quiet when bake_mask is absent (Godot default: all layers)', () => {
      expect(RULE.check(makeContext({ occluder: 'SubResource("Occ_1")' }))).toEqual([]);
    });

    it('stays quiet when bake_mask has at least one bit set', () => {
      expect(
        RULE.check(makeContext({ occluder: 'SubResource("Occ_1")', bake_mask: '3' }))
      ).toEqual([]);
    });

    it('warns when bake_mask is explicitly 0', () => {
      const diagnostics = RULE.check(
        makeContext({ occluder: 'SubResource("Occ_1")', bake_mask: '0' })
      );
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('warning');
      expect(diagnostics[0]?.ruleName).toBe('occluderinstance3d-empty-bake-mask');
      expect(diagnostics[0]?.message).toContain('Bake Mask');
    });
  });

  describe('missing occluder (occluder_instance_3d.cpp:704-705)', () => {
    it('warns when occluder is absent', () => {
      const diagnostics = RULE.check(makeContext({}));
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]?.severity).toBe('warning');
      expect(diagnostics[0]?.ruleName).toBe('occluderinstance3d-missing-occluder');
      expect(diagnostics[0]?.message).toContain('occluder');
    });

    it('stays quiet when occluder is set', () => {
      expect(RULE.check(makeContext({ occluder: 'SubResource("Occ_1")' }))).toEqual([]);
    });
  });

  it('reports both warnings at once when both conditions hold', () => {
    const diagnostics = RULE.check(makeContext({ bake_mask: '0' }));
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.map((d) => d.ruleName).sort()).toEqual(
      ['occluderinstance3d-empty-bake-mask', 'occluderinstance3d-missing-occluder'].sort()
    );
  });

  it('stays quiet on the committed fixture, which the rule is part of the clean claim for', () => {
    // Parsed through StrictTscnParser rather than a hand-built context, because
    // the thing under test here is the fixture's real property bag.
    const { scene } = new StrictTscnParser().parse(readFixture('unit-occluder-instance-3d.tscn'));
    if (!scene) throw new Error('fixture failed to parse');
    const occluderInstance = findByType(scene.nodes, 'OccluderInstance3D');
    expect(
      occluderInstance,
      'unit-occluder-instance-3d.tscn no longer contains an OccluderInstance3D'
    ).toBeDefined();
    expect(
      RULE.check({
        scene,
        node: occluderInstance!,
        properties: occluderInstance!.properties,
      })
    ).toEqual([]);
  });

  it('applies only to OccluderInstance3D', () => {
    expect(RULE.meta.applicableNodeTypes).toEqual(['OccluderInstance3D']);
    expect(RULE.meta.emits).toEqual([
      {
        ruleName: 'occluderinstance3d-empty-bake-mask',
        severity: 'warning',
        grounding: { kind: 'configuration-warning' },
      },
      {
        ruleName: 'occluderinstance3d-missing-occluder',
        severity: 'warning',
        grounding: { kind: 'configuration-warning' },
      },
    ]);
  });
});
