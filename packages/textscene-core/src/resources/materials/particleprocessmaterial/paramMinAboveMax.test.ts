/**
 * The crossed `_min`/`_max` warning, reported on the ParticleProcessMaterial section whatever holds it.
 * Expected loads measured on Godot 4.6.3: `angle_min = 5` then `angle_max = 2` loads as 2 and 2.
 */

import { describe, expect, it } from 'vitest';
import {
  expectDiagnostic,
  expectNoDiagnostic,
  lint,
  node,
  scene,
  subResource,
} from '../../../linter/testing/testkit';
import './index.linter';

const RULE = 'particleprocessmaterial-param-min-above-max';

function sceneWithMaterial(properties: Record<string, string>): string {
  return scene(subResource('ParticleProcessMaterial', properties), node('Node3D'));
}

describe('particleprocessmaterial-param-min-above-max', () => {
  it('warns on a min above its max and names the bound that loads moved', () => {
    expectDiagnostic(sceneWithMaterial({ angle_min: '5.0', angle_max: '2.0' }), {
      ruleName: RULE,
      severity: 'warning',
      contains: ["'angle_min' 5", "'angle_max' 2", "'angle_min' loads as 2"],
    });
  });

  it('puts the warning on the line of the key that loads moved', () => {
    const [diagnostic] = lint(sceneWithMaterial({ angle_max: '2.0', angle_min: '5.0' })).filter(
      (d) => d.ruleName === RULE
    );
    expect(diagnostic).toMatchObject({ nodeType: 'ParticleProcessMaterial', location: { line: 4 } });
    expect(diagnostic!.message).toContain("'angle_max' loads as 5");
  });

  it('reads a pair that only the material declares', () => {
    expectDiagnostic(
      sceneWithMaterial({
        turbulence_initial_displacement_min: '3',
        turbulence_initial_displacement_max: '-3',
      }),
      {
        ruleName: RULE,
      }
    );
  });

  it('warns on a material held in a .tres', () => {
    expectDiagnostic(
      '[gd_resource type="ParticleProcessMaterial" format=3]\n\n[resource]\nscale_min = 4.0\nscale_max = 1.0\n',
      { ruleName: RULE, severity: 'warning' }
    );
  });

  it('accepts a pair at or below its max', () => {
    expectNoDiagnostic(sceneWithMaterial({ angle_min: '-30', angle_max: '30' }), { ruleName: RULE });
    expectNoDiagnostic(sceneWithMaterial({ angle_min: '30', angle_max: '30' }), { ruleName: RULE });
  });

  it('accepts a lone key, which moves only the default (edge)', () => {
    expectNoDiagnostic(sceneWithMaterial({ scale_min: '5' }), { ruleName: RULE });
  });
});
