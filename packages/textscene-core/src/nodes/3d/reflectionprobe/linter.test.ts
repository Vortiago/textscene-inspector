/**
 * ReflectionProbe semantic rule: the one cross-field condition it has.
 *
 * Driven through the rule's own `check`, over a scene parsed by
 * `StrictTscnParser`, rather than through `Linter`: the barrel is mid-wave and
 * `Linter`-based helpers would pull it in. Applicability is the registry's job
 * (`RuleRegistry.getRulesForNodeType`), so these cases hand `check` a
 * ReflectionProbe node directly and assert only what it reports.
 */

import { describe, expect, it } from 'vitest';
import { StrictTscnParser } from '../../../linter/StrictTscnParser';
import { ruleRegistry } from '../../../linter/RuleRegistry';
import type { Diagnostic, RuleContext } from '../../../linter/types';
import './linterParser';
import { reflectionProbeAmbientModeRule } from './linter';

/** Diagnostics the rule reports for a `[node type="ReflectionProbe"]` carrying `properties`. */
function checkProbe(properties: string): Diagnostic[] {
  const source = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="MyReflectionProbe" type="ReflectionProbe" parent="."]
${properties}`;
  const { scene } = new StrictTscnParser().parse(source);
  const node = scene?.nodes[0]?.children[0];
  expect(node?.type, 'the fixture text must yield a ReflectionProbe node').toBe('ReflectionProbe');
  const context: RuleContext = { scene: scene!, node: node!, properties: node!.properties };
  return reflectionProbeAmbientModeRule.check(context);
}

describe('ReflectionProbe semantic rules', () => {
  it('registers the rule so the linter actually runs it', () => {
    expect(ruleRegistry.getRulesForNodeType('ReflectionProbe').map((rule) => rule.meta.name)).toContain(
      'valid-reflectionprobe-ambient-mode'
    );
  });

  it('warns when ambient_color is set but ambient_mode is AMBIENT_DISABLED', () => {
    const diagnostics = checkProbe('ambient_mode = 0\nambient_color = Color(1, 0, 0, 1)\n');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.severity).toBe('warning');
    expect(diagnostics[0]?.ruleName).toBe('reflectionprobe-ambient-color-no-effect');
    expect(diagnostics[0]?.message).toContain('ambient_color');
    expect(diagnostics[0]?.message).toContain('no effect');
  });

  it('warns when ambient_color_energy is set and ambient_mode is absent (defaults to AMBIENT_ENVIRONMENT)', () => {
    const diagnostics = checkProbe('ambient_color_energy = 2.0\n');
    expect(diagnostics.map((d) => d.ruleName)).toEqual(['reflectionprobe-ambient-color-no-effect']);
  });

  it('warns twice when both ambient_color and ambient_color_energy are set under a non-COLOR mode', () => {
    const diagnostics = checkProbe('ambient_mode = 1\nambient_color = Color(1, 0, 0, 1)\nambient_color_energy = 2.0\n');
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.every((d) => d.severity === 'warning')).toBe(true);
  });

  it('is silent when ambient_mode is AMBIENT_COLOR', () => {
    expect(checkProbe('ambient_mode = 2\nambient_color = Color(1, 0, 0, 1)\nambient_color_energy = 2.0\n')).toEqual([]);
  });

  it('is silent when neither ambient_color nor ambient_color_energy is set', () => {
    expect(checkProbe('ambient_mode = 0\n')).toEqual([]);
  });

  it('is silent on a probe that sets no ambient properties at all', () => {
    expect(checkProbe('intensity = 0.5\n')).toEqual([]);
  });
});
