/**
 * The `SKY` kind: a Sky with the sky material it draws, from any origin. The Sky follows its
 * `sky_material` with the `MATERIAL` kind, so a material file is legal there. No THREE.
 */

import type { ResourceKind } from '../reading';
import { MATERIAL } from '../materials/material/kind';
import { decodeSky } from './decode';
import type { AuthoredSky } from './types';

/**
 * One value for each Sky resource while its text holds, whichever Environment or camera reads it,
 * as Godot keeps one radiance for each Sky RID (`sky.h:251`): viewports that draw one sky share its
 * bake. A material this previewer cannot draw as a sky declines the Sky.
 */
export const SKY: ResourceKind<AuthoredSky> = {
  name: 'Sky',
  accepts: (type) => type === 'Sky',
  decode: ({ properties }, follow) => {
    const material = follow.read(MATERIAL, properties.sky_material).value;
    if (material?.form !== 'sky') return null;
    return decodeSky(properties, material.properties);
  },
};
