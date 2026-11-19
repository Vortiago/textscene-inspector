/** The shown sky's layer slot, as every reader receives it through `skyRadianceUniforms`. */

import type * as THREE from 'three';
import { SKY_RADIANCE_UNIFORMS, skyRadianceUniforms } from './skyRadiance';

export const skyLayersSlot = skyRadianceUniforms()[SKY_RADIANCE_UNIFORMS.layers]!
  .value as THREE.DataArrayTexture;

/** Where `SkyRadiance.show` writes whether surfaces reflect the sky: the `y` of the second `vec4`. */
export const REFLECTION_SLOT = 5;
