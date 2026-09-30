/** The projector-without-shadow warning OmniLight3D and SpotLight3D share, under each class's arm. */
import { describe, it, expect } from 'vitest';
import type { TscnNode } from '../../../../parser/types.js';
import { projectorArms, projectorWithoutShadowDiagnostic } from './linterChecks.js';

const arms = projectorArms('omnilight3d');

function light(properties: Record<string, string>): TscnNode {
  return { name: 'Lamp', type: 'OmniLight3D', properties, children: [] };
}

describe('projectorArms', () => {
  it('declares the ported configuration warning under the prefix', () => {
    expect(arms).toEqual({
      projectorWithoutShadow: {
        severity: 'warning',
        ruleName: 'omnilight3d-projector-without-shadow',
        grounding: { kind: 'configuration-warning' },
      },
    });
  });
});

describe('projectorWithoutShadowDiagnostic', () => {
  it('reports a projector without shadows through the arm', () => {
    expect(projectorWithoutShadowDiagnostic(light({ light_projector: 'ExtResource("1")' }), arms)).toMatchObject({
      severity: 'warning',
      ruleName: 'omnilight3d-projector-without-shadow',
      nodeName: 'Lamp',
    });
  });

  it('reports nothing when shadows are on', () => {
    const lit = light({ light_projector: 'ExtResource("1")', shadow_enabled: 'true' });
    expect(projectorWithoutShadowDiagnostic(lit, arms)).toBeNull();
  });
});
