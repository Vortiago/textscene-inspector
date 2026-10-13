import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { sceneFogFor } from './sceneFog';
import type { EnvironmentSettings } from '../../resources/environment/types';

const depthFog: EnvironmentSettings['fog'] = { density: 0.02, color: { r: 1, g: 1, b: 1, a: 1 }, mode: 0 };
const volumetricFog: EnvironmentSettings['volumetricFog'] = {
  density: 0.05,
  albedo: { r: 1, g: 1, b: 1, a: 1 },
  emission: { r: 0, g: 0, b: 0, a: 1 },
  emissionEnergy: 1,
  anisotropy: 0.2,
  length: 64,
  detailSpread: 2,
  ambient: { inject: 0, color: { r: 0, g: 0, b: 0, a: 1 }, skyContribution: 1 },
  skyAffect: 1,
  temporalReprojection: true,
};

describe('sceneFogFor', () => {
  it('maps depth fog to exponential-squared fog of its density', () => {
    const fog = sceneFogFor({ fog: depthFog, volumetricFog: null });

    expect(fog).toBeInstanceOf(THREE.FogExp2);
    expect(fog!.density).toBe(0.02);
    expect(fog!.color.getHex()).toBe(0xffffff);
  });

  it('carries the fog program with a fog of density 0 for a volume alone', () => {
    const fog = sceneFogFor({ fog: null, volumetricFog });

    expect(fog!.density).toBe(0);
  });

  it('keeps the depth fog when both are on (edge case)', () => {
    expect(sceneFogFor({ fog: depthFog, volumetricFog })!.density).toBe(0.02);
  });

  it('is null without either fog', () => {
    expect(sceneFogFor({ fog: null, volumetricFog: null })).toBeNull();
  });
});
