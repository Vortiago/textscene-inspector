/**
 * ReflectionProbe's cross-field rule, driven through its own `check` over a
 * `StrictTscnParser` scene, since `Linter` pulls in the whole barrel. The registry
 * owns applicability, so each case hands `check` a ReflectionProbe directly.
 */

import { describe, expect, it } from 'vitest';
import { StrictTscnParser } from '../../../linter/StrictTscnParser';
import { ruleRegistry } from '../../../linter/RuleRegistry';
import type { Diagnostic, RuleContext } from '../../../linter/types';
import './linterParser';
import { reflectionProbeValidationRule } from './linter';

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
  return reflectionProbeValidationRule.check(context);
}

describe('ReflectionProbe semantic rules', () => {
  it('registers the rule so the linter actually runs it', () => {
    expect(ruleRegistry.getRulesForNodeType('ReflectionProbe').map((rule) => rule.meta.name)).toContain(
      'valid-reflectionprobe-properties'
    );
  });

  it('reports when ambient_color is set but ambient_mode is AMBIENT_DISABLED', () => {
    const diagnostics = checkProbe('ambient_mode = 0\nambient_color = Color(1, 0, 0, 1)\n');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.severity).toBe('info');
    expect(diagnostics[0]?.ruleName).toBe('reflectionprobe-ambient-color-no-effect');
    expect(diagnostics[0]?.message).toContain('ambient_color');
    expect(diagnostics[0]?.message).toContain('no effect');
  });

  it('reports when ambient_color_energy is set and ambient_mode is absent (defaults to AMBIENT_ENVIRONMENT)', () => {
    const diagnostics = checkProbe('ambient_color_energy = 2.0\n');
    expect(diagnostics.map((d) => d.ruleName)).toEqual(['reflectionprobe-ambient-color-no-effect']);
  });

  it('reports twice when both ambient_color and ambient_color_energy are set under a non-COLOR mode', () => {
    const diagnostics = checkProbe('ambient_mode = 1\nambient_color = Color(1, 0, 0, 1)\nambient_color_energy = 2.0\n');
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.every((d) => d.severity === 'info')).toBe(true);
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

/**
 * Both setters clamp each `origin_offset` axis to `half_size - 0.01` against the size in
 * effect when the line is read (reflection_probe.cpp:102-110, :123-131). `set_size` floors
 * `half_size` at 0.01 and `set_origin_offset` does not. Values measured on 4.6.3.
 */
describe('ReflectionProbe origin_offset clamped by size', () => {
  it('warns that an offset outside the size loads clamped, keeping each sign', () => {
    expect(checkProbe('size = Vector3(2, 2, 2)\norigin_offset = Vector3(5, 0, -5)\n')).toEqual([
      expect.objectContaining({
        severity: 'warning',
        ruleName: 'reflectionprobe-origin-offset-clamped',
        message: expect.stringMatching(/Vector3\(5, 0, -5\) loads as Vector3\(0\.99, 0, -0\.99\)/),
      }),
    ]);
  });

  it('clamps an offset listed before size against the default size', () => {
    const diagnostics = checkProbe('origin_offset = Vector3(15, 0, 0)\nsize = Vector3(40, 40, 40)\n');
    expect(diagnostics.map((d) => d.message)).toEqual([expect.stringContaining('loads as Vector3(9.99, 0, 0)')]);
  });

  it('flips the sign against a zero size, since set_origin_offset has no 0.01 floor', () => {
    const diagnostics = checkProbe('size = Vector3(0, 2, 2)\norigin_offset = Vector3(1, 0, 0)\n');
    expect(diagnostics.map((d) => d.message)).toEqual([expect.stringContaining('loads as Vector3(-0.01, 0, 0)')]);
  });

  it('clamps to float residue when a zero size comes after the offset', () => {
    const diagnostics = checkProbe('origin_offset = Vector3(1, 0, 0)\nsize = Vector3(0, 2, 2)\n');
    expect(diagnostics.map((d) => d.message)).toEqual([expect.stringContaining('loads as Vector3(-2.2351741e-10, 0, 0)')]);
  });

  it('checks the offset against the default size when size is absent', () => {
    expect(checkProbe('origin_offset = Vector3(12, 0, 0)\n')).toHaveLength(1);
    expect(checkProbe('origin_offset = Vector3(9, 0, 0)\n')).toEqual([]);
  });

  it('says nothing for an offset the clamp returns unchanged in float storage', () => {
    expect(checkProbe('size = Vector3(2, 2, 2)\norigin_offset = Vector3(0.99, 0, 0)\n')).toEqual([]);
  });

  it('says nothing for an offset inside the size, or no offset at all', () => {
    expect(checkProbe('size = Vector3(2, 2, 2)\norigin_offset = Vector3(0.5, -0.5, 0)\n')).toEqual([]);
    expect(checkProbe('size = Vector3(0, 0, 0)\n')).toEqual([]);
  });

  it('says nothing for a nan component, which no comparison clamps', () => {
    expect(checkProbe('size = Vector3(2, 2, 2)\norigin_offset = Vector3(nan, 0, 0)\n')).toEqual([]);
  });

  it('says nothing about a malformed vector, which the format validator reports', () => {
    expect(checkProbe('size = Vector3(2, 2, 2)\norigin_offset = Vector3(5, 0)\n')).toEqual([]);
    expect(checkProbe('size = Vector3(2, 2)\norigin_offset = Vector3(5, 0, 0)\n')).toEqual([]);
  });
});
