/**
 * Parity: SpotLight3D attenuation vs Godot.
 * - spot_attenuation is the DISTANCE falloff exponent (default 1) → three.js
 *   decay. It was hardcoded to 2 (inverse-square), dimming lights too fast.
 * - spot_angle_attenuation is the CONE-EDGE falloff exponent (default 1):
 *   higher = sharper edge → smaller three.js penumbra (monotonic).
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SpotLight3D } from './Component';
import { parseSpotLight3D } from './parser';
import type { TscnNode } from '../../../../parser/types';

function makeNode(raw: Record<string, string> = {}): TscnNode {
  const heading = { type: 'node', attributes: { type: 'SpotLight3D', name: 'Spot' } };
  return {
    name: 'Spot',
    type: 'SpotLight3D',
    children: [],
    properties: parseSpotLight3D(heading, raw),
  };
}

async function spot(raw: Record<string, string> = {}): Promise<{ decay: number; penumbra: number }> {
  const r = await ReactThreeTestRenderer.create(<SpotLight3D node={makeNode(raw)} />);
  return r.scene.findByType('SpotLight').instance as THREE.SpotLight;
}

describe('SpotLight3D attenuation parity', () => {
  it('decay defaults to spot_attenuation (1), not a hardcoded 2', async () => {
    expect((await spot()).decay).toBe(1);
  });

  it('decay follows spot_attenuation', async () => {
    expect((await spot({ spot_attenuation: '2' })).decay).toBe(2);
  });

  it('higher spot_angle_attenuation → sharper edge (smaller penumbra)', async () => {
    const soft = (await spot({ spot_angle_attenuation: '0.5' })).penumbra;
    const sharp = (await spot({ spot_angle_attenuation: '8' })).penumbra;
    expect(sharp).toBeLessThan(soft);
    expect(sharp).toBeGreaterThanOrEqual(0);
  });
});
