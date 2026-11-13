/**
 * The `SKY` kind: a Sky with the sky material it draws, from any origin. The Sky follows its
 * `sky_material` with the `MATERIAL` kind, so a material file is legal there. No THREE.
 */

import type { ResourceKind, ScopedReference } from '../reading';
import { MATERIAL } from '../materials/material/kind';
import { decodeSky } from './decode';
import type { Sky } from './types';

export interface DecodedSky {
  readonly sky: Sky;
  /** A PanoramaSkyMaterial's `panorama`, in the material's own file. Null for any other sky. */
  readonly panorama: ScopedReference | null;
}

/**
 * One value for each Sky resource while its text holds, whichever Environment or camera reads it,
 * as Godot keeps one radiance for each Sky RID (`sky.h:251`): viewports that draw one sky share its
 * bake. A material this previewer cannot draw as a sky declines the Sky.
 */
export const SKY: ResourceKind<DecodedSky> = {
  name: 'Sky',
  accepts: (type) => type === 'Sky',
  decode: ({ properties }, follow) => {
    const material = follow.read(MATERIAL, properties.sky_material).value;
    if (material?.form !== 'sky') return null;
    return { sky: decodeSky(properties, material.properties), panorama: material.panorama };
  },
};
