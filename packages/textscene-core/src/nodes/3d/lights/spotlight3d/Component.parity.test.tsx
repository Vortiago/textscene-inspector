/**
 * SpotLight3D attenuation against Godot: spot_attenuation, the distance falloff exponent, is three's
 * decay. The inverse of spot_angle_attenuation is the cone exponent, which the penumbra carries.
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
    rawProperties: {},
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

  it('carries the inverse of spot_angle_attenuation as the cone exponent', async () => {
    const light = await spot({ spot_angle_attenuation: '2' });
    const cosine = Math.cos(light.angle * (1 - light.penumbra));
    expect(-cosine / Math.sqrt(1 - cosine * cosine)).toBeCloseTo(0.5, 10);
  });
});
