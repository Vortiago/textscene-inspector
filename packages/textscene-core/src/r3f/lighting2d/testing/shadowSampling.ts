/** A `ShadowSampling` for tests that read a quad's material, every field neutral unless overridden. */

import * as THREE from 'three';
import { createShadowPoseUniforms, type ShadowSampling } from '../shadowMap/shadowSampling';
import { Light2DShadowFilter } from '../../../godot/scene/light2d';

export function shadowSampling(overrides: Partial<ShadowSampling> = {}): ShadowSampling {
  return {
    map: new THREE.DataTexture(new Float32Array(8), 8, 1, THREE.RedFormat, THREE.FloatType),
    filter: Light2DShadowFilter.PCF5,
    smooth: 0,
    pose: createShadowPoseUniforms(),
    shadowColor: { r: 0, g: 0, b: 0, a: 0 },
    ...overrides,
  };
}
