/** A `ShadowSampling` for tests that read a quad's material, every field neutral unless overridden. */

import { createShadowPoseUniforms, type ShadowSampling } from '../shadowMap/shadowSampling';
import { createShadowMapTexture } from '../shadowMap/shadowMapTexture';
import { Light2DShadowFilter } from '../../../godot/scene/light2d';

export function shadowSampling(overrides: Partial<ShadowSampling> = {}): ShadowSampling {
  return {
    map: createShadowMapTexture(8, 'repeat'),
    filter: Light2DShadowFilter.PCF5,
    smooth: 0,
    pose: createShadowPoseUniforms(),
    shadowColor: { r: 0, g: 0, b: 0, a: 0 },
    ...overrides,
  };
}
