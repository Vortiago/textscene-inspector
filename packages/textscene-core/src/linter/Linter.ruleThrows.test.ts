/**
 * A rule that throws loses its own diagnostic, not the file's.
 *
 * `./Linter.js` directly rather than the barrel, so the registry holds only
 * the rule below and nothing else can throw or report.
 */

import { describe, expect, it } from 'vitest';
import { Linter } from './Linter.js';
import { ruleRegistry } from './RuleRegistry.js';
import type { LintRule } from './types.js';

const FIXTURE = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Probe" type="ThrowingProbe" parent="."]
`;

const throwing: LintRule = {
  meta: {
    name: 'throwing-probe-rule',
    description: 'throws on ThrowingProbe',
    category: 'validation',
    applicableNodeTypes: ['ThrowingProbe'],
  },
  check: () => {
    throw new Error('boom');
  },
};

const counting: LintRule = {
  meta: {
    name: 'counting-probe-rule',
    description: 'reports on every node',
    category: 'validation',
  },
  check: ({ node }) => [
    { severity: 'warning', message: 'seen', nodeName: node.name, nodeType: node.type, ruleName: 'counting-probe-rule' },
  ],
};

describe('a rule that throws', () => {
  ruleRegistry.register(throwing);
  ruleRegistry.register(counting);
  const diagnostics = new Linter().lint(FIXTURE);

  it('is reported once, as an error naming the rule, on the node it ran on', () => {
    const crashes = diagnostics.filter((d) => d.ruleName === 'rule-crashed');
    expect(crashes).toHaveLength(1);
    expect(crashes[0]?.severity).toBe('error');
    expect(crashes[0]?.nodeName).toBe('Probe');
    expect(crashes[0]?.nodeType).toBe('ThrowingProbe');
    expect(crashes[0]?.message).toContain('throwing-probe-rule');
    expect(crashes[0]?.message).toContain('boom');
  });

  it('leaves every other rule reporting on every node', () => {
    const seen = diagnostics.filter((d) => d.ruleName === 'counting-probe-rule').map((d) => d.nodeName);
    expect(seen.sort()).toEqual(['Probe', 'Root']);
  });
});
