/**
 * Tests for ShaderGlobalsOverride's semantic rule.
 *
 * Godot gates the warning on `if (!active)` (shader_globals_override.cpp:281),
 * and `_activate()` (:231) makes the first node into the group the active one —
 * so the winner is silent and every later node warns.
 */

import { describe, it, expect } from 'vitest';
import { lint, node, scene, expectDiagnostic, expectNoDiagnostic } from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

/** A root plus `count` ShaderGlobalsOverride children, named Override1..N. */
function overrides(count: number): string {
  return scene(
    node('Node', {}, { name: 'Root' }),
    ...Array.from({ length: count }, (_, i) =>
      node('ShaderGlobalsOverride', {}, { name: `Override${i + 1}`, parent: '.' })
    )
  );
}

describe('ShaderGlobalsOverride Linter', () => {
  describe('multiple nodes in scene', () => {
    it('warns on the second node, which Godot leaves inactive', () => {
      expectDiagnostic(overrides(2), {
        ruleName: 'shaderglobalsoverride-multiple-in-scene',
        severity: 'warning',
        nodeType: 'ShaderGlobalsOverride',
        contains: ['Override2', 'not the first'],
      });
    });

    it('stays silent on the first, which is the one that activates', () => {
      const warned = lint(overrides(3))
        .filter((d) => d.ruleName === 'shaderglobalsoverride-multiple-in-scene')
        .map((d) => d.nodeName);
      expect(warned).toEqual(['Override2', 'Override3']);
    });

    it('does not warn when only one node is in the scene', () => {
      expectNoDiagnostic(scene(node('ShaderGlobalsOverride', {}, { name: 'Root' })), {
        ruleName: 'shaderglobalsoverride-multiple-in-scene',
      });
    });

    it('reads tree order, not sibling order, for the winner', () => {
      // `firstNodeOfType` is depth-first, which is what `Node::Comparator` sorts
      // the group by — a nested override declared above a root-level one is
      // still second if it comes second in the tree walk.
      const content = scene(
        node('Node', {}, { name: 'Root' }),
        node('ShaderGlobalsOverride', {}, { name: 'Outer', parent: '.' }),
        node('Node', {}, { name: 'Branch', parent: '.' }),
        node('ShaderGlobalsOverride', {}, { name: 'Inner', parent: 'Branch' })
      );
      const warned = lint(content)
        .filter((d) => d.ruleName === 'shaderglobalsoverride-multiple-in-scene')
        .map((d) => d.nodeName);
      expect(warned).toEqual(['Inner']);
    });
  });
});
