/**
 * `Linter` puts a rule's diagnostic on the heading of the node the rule ran on: the rule reaches
 * the node through the tree, which carries no lines. It imports `./Linter.js`, not the barrel,
 * so the registry holds only the probes.
 */

import { describe, expect, it } from 'vitest';
import { Linter } from './Linter.js';
import { ruleRegistry } from './RuleRegistry.js';
import type { Diagnostic, LintRule } from './types.js';

/** Reports once on every `Probe`, with no location, as every registered rule does. */
const plain: LintRule = {
  meta: { name: 'plain-probe', description: 'reports on Probe', category: 'validation', applicableNodeTypes: ['Probe'] },
  check: ({ node }) => [
    { severity: 'warning', message: `seen ${node.name}`, nodeName: node.name, nodeType: node.type, ruleName: 'plain-probe' },
  ],
};

/** Places its own report, which the anchor must leave alone. */
const placed: LintRule = {
  meta: { name: 'placed-probe', description: 'reports on Placed', category: 'validation', applicableNodeTypes: ['Placed'] },
  check: ({ node }) => [
    {
      severity: 'info',
      message: 'placed',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'placed-probe',
      location: { line: 1, column: 7 },
    },
  ],
};

/** Hands back the same object for every node it runs on. */
const shared: Diagnostic = { severity: 'info', message: 'shared', nodeName: 'Reused', nodeType: 'Reused', ruleName: 'shared-probe' };
const reusing: LintRule = {
  meta: { name: 'shared-probe', description: 'reuses one report', category: 'validation', applicableNodeTypes: ['Reused'] },
  check: () => [shared],
};

const throwing: LintRule = {
  meta: { name: 'throwing-probe', description: 'throws on Thrower', category: 'validation', applicableNodeTypes: ['Thrower'] },
  check: () => {
    throw new Error('boom');
  },
};

ruleRegistry.register(plain);
ruleRegistry.register(placed);
ruleRegistry.register(reusing);
ruleRegistry.register(throwing);

function lint(content: string, ruleName: string): Diagnostic[] {
  return new Linter().lint(content).filter((d) => d.ruleName === ruleName);
}

describe("a rule's diagnostic", () => {
  it("goes on its node's heading, the root's and a child's alike", () => {
    const diagnostics = lint(
      `[gd_scene format=3]

[node name="Root" type="Probe"]
visible = false

[node name="Child" type="Probe" parent="."]
`,
      'plain-probe'
    );

    expect(diagnostics.map((d) => [d.nodeName, d.location])).toEqual([
      ['Root', { line: 3, column: 1 }],
      ['Child', { line: 6, column: 1 }],
    ]);
  });

  it('follows the node, not its name, where two nodes share one', () => {
    const diagnostics = lint(
      `[gd_scene format=3]

[node name="Root" type="Node"]

[node name="A" type="Node" parent="."]

[node name="Twin" type="Probe" parent="A"]

[node name="B" type="Node" parent="."]

[node name="Twin" type="Probe" parent="B"]
`,
      'plain-probe'
    );

    expect(diagnostics.map((d) => d.location?.line)).toEqual([7, 11]);
  });

  it('keeps a location the rule set itself', () => {
    const [diagnostic] = lint('[gd_scene format=3]\n\n[node name="Root" type="Placed"]\n', 'placed-probe');

    expect(diagnostic?.location).toEqual({ line: 1, column: 7 });
  });

  it('is copied, so one object a rule reuses lands on each node it ran on', () => {
    const diagnostics = lint(
      `[gd_scene format=3]

[node name="Root" type="Reused"]

[node name="Other" type="Reused" parent="."]
`,
      'shared-probe'
    );

    expect(diagnostics.map((d) => d.location?.line)).toEqual([3, 5]);
    expect(shared.location).toBeUndefined();
  });
});

describe('a rule that throws', () => {
  it('is reported on the heading of the node it ran on', () => {
    const [crash] = lint(
      '[gd_scene format=3]\n\n[node name="Root" type="Node"]\n\n[node name="T" type="Thrower" parent="."]\n',
      'rule-crashed'
    );

    expect(crash?.location).toEqual({ line: 5, column: 1 });
  });
});
