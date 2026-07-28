import { describe, expect, it } from 'vitest';
import { resolveParticleCurves, resolveParticleGradient } from './sceneResources';
import { CPUParticles2DParam, CPU_PARTICLES_2D_PARAM_COUNT, type ParticleParam } from './types';
import type { TscnInternalResource } from '../../../parser/types';

const CURVE: TscnInternalResource = {
  type: 'Curve',
  id: 1,
  data: { id: '4', _data: '[Vector2(0, 1), 0.0, 0.0, 0, 0, Vector2(1, 0), 0.0, 0.0, 0, 0]' },
};

const GRADIENT: TscnInternalResource = {
  type: 'Gradient',
  id: 2,
  data: {
    id: '2',
    offsets: 'PackedFloat32Array(0, 1)',
    colors: 'PackedColorArray(1, 0, 0, 1, 0, 0, 1, 1)',
  },
};

function params(overrides: Partial<Record<CPUParticles2DParam, string>> = {}): ParticleParam[] {
  return Array.from({ length: CPU_PARTICLES_2D_PARAM_COUNT }, (_, i) => {
    const curve = overrides[i as CPUParticles2DParam];
    return curve ? { min: 0, max: 1, curve } : { min: 0, max: 1 };
  });
}

describe('resolveParticleCurves', () => {
  it('decodes the Curve a parameter slot names (happy path)', () => {
    const curves = resolveParticleCurves(
      params({ [CPUParticles2DParam.Scale]: 'SubResource("4")' }),
      [CURVE]
    );
    expect(curves[CPUParticles2DParam.Scale]?.points).toHaveLength(2);
  });

  it('leaves every unreferenced slot null and keeps the array full length', () => {
    const curves = resolveParticleCurves(
      params({ [CPUParticles2DParam.Scale]: 'SubResource("4")' }),
      [CURVE]
    );
    expect(curves).toHaveLength(CPU_PARTICLES_2D_PARAM_COUNT);
    expect(curves.filter((c) => c !== null)).toHaveLength(1);
  });

  it('yields null for a reference the scene does not define (error path)', () => {
    const curves = resolveParticleCurves(
      params({ [CPUParticles2DParam.Damping]: 'SubResource("missing")' }),
      [CURVE]
    );
    expect(curves[CPUParticles2DParam.Damping]).toBeNull();
  });

  it('yields an all-null array for an empty resource table (edge case)', () => {
    const curves = resolveParticleCurves(params(), []);
    expect(curves.every((c) => c === null)).toBe(true);
  });
});

describe('resolveParticleGradient', () => {
  it('decodes a Gradient sub-resource (happy path)', () => {
    const gradient = resolveParticleGradient('SubResource("2")', [GRADIENT]);
    expect(gradient?.stops).toHaveLength(2);
    expect(gradient?.stops[0]!.color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('returns null when the reference names a non-Gradient resource (error path)', () => {
    expect(resolveParticleGradient('SubResource("4")', [CURVE])).toBeNull();
  });

  it('returns null for an absent reference (edge case)', () => {
    expect(resolveParticleGradient(undefined, [GRADIENT])).toBeNull();
  });
});
