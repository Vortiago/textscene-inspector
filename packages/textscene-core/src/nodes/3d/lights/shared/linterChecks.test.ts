/** The projector-without-shadow warning OmniLight3D and SpotLight3D share, under each class's arm. */
import { describe, it, expect } from 'vitest';
import type { TscnNode } from '../../../../parser/types.js';
import { projectorArm, projectorWithoutShadowDiagnostic } from './linterChecks.js';

const arm = projectorArm('omnilight3d');

function light(properties: Record<string, string>): TscnNode {
  return { name: 'Lamp', type: 'OmniLight3D', properties, children: [] };
}

describe('projectorArm', () => {
  it('declares the ported configuration warning under the prefix', () => {
    expect(arm).toEqual({
      severity: 'warning',
      ruleName: 'omnilight3d-projector-without-shadow',
      grounding: { kind: 'configuration-warning' },
    });
  });
});

describe('projectorWithoutShadowDiagnostic', () => {
  it('reports a projector without shadows through the arm', () => {
    expect(projectorWithoutShadowDiagnostic(light({ light_projector: 'ExtResource("1")' }), arm)).toMatchObject({
      severity: 'warning',
      ruleName: 'omnilight3d-projector-without-shadow',
      nodeName: 'Lamp',
    });
  });

  it('reports nothing when shadows are on', () => {
    const lit = light({ light_projector: 'ExtResource("1")', shadow_enabled: 'true' });
    expect(projectorWithoutShadowDiagnostic(lit, arm)).toBeNull();
  });
});
