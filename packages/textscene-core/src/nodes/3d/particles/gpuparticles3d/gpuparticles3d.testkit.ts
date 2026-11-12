/** The GPUParticles3D tests' shared emitters. */

import type { TscnInternalResource, TscnNode } from '../../../../parser/types';
import { makeNode } from '../../../../parser/testing/parserKit';
import './index';

export const BOX: TscnInternalResource = {
  id: 'Box',
  type: 'BoxMesh',
  data: { size: 'Vector3(0.2, 0.2, 0.2)' },
};

export const SPHERE: TscnInternalResource = { id: 'Sphere', type: 'SphereMesh', data: {} };

/** A process material that sends the particles along +x at one unit a second, with no gravity. */
export const ALONG_X: TscnInternalResource = {
  id: 'Process',
  type: 'ParticleProcessMaterial',
  data: {
    direction: 'Vector3(1, 0, 0)',
    spread: '0',
    gravity: 'Vector3(0, 0, 0)',
    initial_velocity_min: '1',
    initial_velocity_max: '1',
  },
};

/** Four particles, one born each half second: after 1.6 s all four fly, half a second of flight apart. */
export const ROW_OF_FOUR: Readonly<Record<string, string>> = {
  amount: '4',
  lifetime: '2.0',
  preprocess: '1.6',
  use_fixed_seed: 'true',
  seed: '7',
  process_material: 'SubResource("Process")',
  draw_pass_1: 'SubResource("Box")',
};

export function emitterNode(properties: Record<string, string>, name = 'Row'): TscnNode {
  return makeNode(name, 'GPUParticles3D', { rawProperties: properties });
}
