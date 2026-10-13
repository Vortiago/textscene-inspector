/**
 * What a light tells the volumetric fog that its three.js light cannot carry: its fog energy, and a
 * spot's cone exponent, which three's penumbra only approximates.
 */

import { userDataDeclaration } from '../userDataDeclaration.js';

export interface FogLightDeclaration {
  /** `light_volumetric_fog_energy`: how strongly the medium scatters this light. */
  energy: number;
  /** `spot_angle_attenuation`, for a spot light only. */
  spotAngleAttenuation?: number;
}

const declaration = userDataDeclaration<FogLightDeclaration>(
  'volumetricFogLight',
  ({ energy, spotAngleAttenuation }) =>
    typeof energy === 'number' &&
    (spotAngleAttenuation === undefined || typeof spotAngleAttenuation === 'number')
);

/** The `userData` entry that declares a light's part in the fog, to merge into its `userData`. */
export const fogLightUserData = declaration.userData;

/** The light's declaration, or null for a light that made none, such as a GLB light. */
export const readFogLightDeclaration = declaration.read;
