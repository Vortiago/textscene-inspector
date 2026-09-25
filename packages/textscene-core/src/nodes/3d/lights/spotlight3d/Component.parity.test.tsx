/**
 * SpotLight3D attenuation against Godot: spot_attenuation, the distance falloff
 * exponent (default 1), maps to three.js decay. spot_angle_attenuation, the
 * cone-edge exponent (default 1), maps monotonically to a smaller penumbra.
 */
import { describe, it, expect } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SpotLight3D } from './Component';
import { parseSpotLight3D } from './parser';
import type { TscnNode } from '../../../../parser/types';
import { instanceAs } from '../../testing/reactThreeTestInstance';

function makeNode(raw: Record<string, string> = {}): TscnNode {
  const heading = { type: 'node', attributes: { type: 'SpotLight3D', name: 'Spot' } };
  return {
    name: 'Spot',
    type: 'SpotLight3D',
    children: [],
    properties: parseSpotLight3D(heading, raw),
  };
}

async function spot(raw: Record<string, string> = {}): Promise<THREE.SpotLight> {
  const r = await ReactThreeTestRenderer.create(<SpotLight3D node={makeNode(raw)} />);
  return instanceAs<THREE.SpotLight>(r.scene.findByType('SpotLight'));
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
