/** The projector checks the 3D lights share, under each class's arm. */
import { describe, it, expect } from 'vitest';
import type { RawNode } from '../../../../parser/types.js';
import { hasProjector, projectorArm, projectorWithoutShadowDiagnostic } from './linterChecks.js';

const arm = projectorArm('omnilight3d');

function light(rawProperties: Record<string, string>): RawNode {
  return { rawProperties, name: 'Lamp', type: 'OmniLight3D', children: [] };
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
    expect(
      projectorWithoutShadowDiagnostic(light({ light_projector: 'ExtResource("1")' }), arm)
    ).toMatchObject({
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

describe('hasProjector', () => {
  it('finds a projector reference', () => {
    expect(hasProjector(light({ light_projector: 'SubResource("G")' }))).toBe(true);
  });

  it('finds none without the key (edge case)', () => {
    expect(hasProjector(light({}))).toBe(false);
  });

  it('finds none in a malformed value, which Godot never sets (error case)', () => {
    expect(hasProjector(light({ light_projector: 'not-a-reference' }))).toBe(false);
  });
});
