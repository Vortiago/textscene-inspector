/**
 * The resource rule pass: every `[sub_resource]` and a `.tres` body meets the rules for its class,
 * and a rule that throws or reports an undeclared arm becomes its own `rule-crashed` error.
 */

import { describe, expect, it } from 'vitest';
import { lint } from './testing/testkit.js';
import { FILE_DIAGNOSTICS } from './fileDiagnostics.js';
import { resourceRuleRegistry } from './ResourceRuleRegistry.js';
import type { RuleArm } from './types.js';

const MARKED_ARM: RuleArm = {
  severity: 'warning',
  ruleName: 'test-marked',
  grounding: { kind: 'engine', at: 'test.cpp:1' },
};

const UNDECLARED_ARM: RuleArm = { ...MARKED_ARM, ruleName: 'test-undeclared' };

resourceRuleRegistry.register({
  meta: { name: 'test-marked', description: '', resourceType: 'TestMarked', emits: [MARKED_ARM] },
  check: (data) => (data.marked ? [{ arm: MARKED_ARM, message: 'marked', property: 'marked' }] : []),
});
const ABSENT_ARM: RuleArm = { ...MARKED_ARM, ruleName: 'test-absent' };

resourceRuleRegistry.register({
  meta: { name: 'test-absent', description: '', resourceType: 'TestAbsent', emits: [ABSENT_ARM] },
  check: () => [{ arm: ABSENT_ARM, message: 'absent', property: 'absent' }],
});
resourceRuleRegistry.register({
  meta: { name: 'test-throws', description: '', resourceType: 'TestThrows', emits: [] },
  check: () => {
    throw new Error('boom');
  },
});
resourceRuleRegistry.register({
  meta: { name: 'test-undeclared', description: '', resourceType: 'TestUndeclared', emits: [] },
  check: () => [{ arm: UNDECLARED_ARM, message: 'undeclared', property: 'x' }],
});

function sceneWith(type: string, body: string): string {
  return `[gd_scene format=3]\n\n[sub_resource type="${type}" id="Res_1"]\n${body}\n\n[node name="Root" type="Node"]\n`;
}

function reported(content: string, ruleName: string) {
  return lint(content).filter((d) => d.ruleName === ruleName);
}

describe('resource rules', () => {
  it('reports on the property line of a sub-resource no node holds', () => {
    const [diagnostic] = reported(sceneWith('TestMarked', 'other = 1\nmarked = true'), 'test-marked');
    expect(diagnostic).toBeAtTier('warning');
    expect(diagnostic).toMatchObject({ nodeName: 'Res_1', nodeType: 'TestMarked', location: { line: 5 } });
  });

  it('reports on the heading when the section omits the property', () => {
    expect(reported(sceneWith('TestAbsent', ''), 'test-absent')).toMatchObject([
      { location: { line: 3, column: 1 } },
    ]);
  });

  it('reports on the body of a .tres of that class', () => {
    const tres = '[gd_resource type="TestMarked" format=3]\n\n[resource]\nmarked = true\n';
    expect(reported(tres, 'test-marked')).toMatchObject([{ location: { line: 4 } }]);
  });

  it('reports nothing for a section of another class', () => {
    expect(reported(sceneWith('TestOther', 'marked = true'), 'test-marked')).toEqual([]);
  });

  it('turns a throw into a rule-crashed error on the heading', () => {
    const [diagnostic] = reported(sceneWith('TestThrows', ''), FILE_DIAGNOSTICS.ruleCrashed.ruleName);
    expect(diagnostic).toBeAtTier('error');
    expect(diagnostic!.message).toContain("'test-throws'");
    expect(diagnostic!.location).toEqual({ line: 3, column: 1 });
  });

  it('refuses an arm the rule does not declare', () => {
    const [diagnostic] = reported(sceneWith('TestUndeclared', ''), FILE_DIAGNOSTICS.ruleCrashed.ruleName);
    expect(diagnostic!.message).toContain("'test-undeclared', which its emits does not declare");
    expect(reported(sceneWith('TestUndeclared', ''), 'test-undeclared')).toEqual([]);
  });
});
