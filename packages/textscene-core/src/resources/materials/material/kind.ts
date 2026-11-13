/**
 * The `MATERIAL` kind: every Material class, from a scene or from a file. A StandardMaterial3D
 * decodes to its data, with each gated texture slot and its `next_pass` as a reference in the
 * material's own file. Any other Material class is declined, the same from either arrival. No THREE.
 */

import { descendsFromClass } from '../../../godot/classdb/classBaseTypes';
import type { ResourceKind } from '../../reading';
import { decodeStandardMaterial3D } from '../standardmaterial3d/decode';
import type { TextureSlot } from '../standardmaterial3d/types';
import type { Material } from './types';

export const MATERIAL: ResourceKind<Material> = {
  name: 'Material',
  accepts: (type) => descendsFromClass(type, 'Material'),
  decode: ({ type, properties }, follow) => {
    if (type !== 'StandardMaterial3D') return { form: 'declined', type };
    const data = decodeStandardMaterial3D(properties);
    // The decode's gated table, never the raw property bag: Godot samples a gated slot only inside
    // its `if (features[…])` branch (`scene/resources/material.cpp:1090,1745`).
    const slots = Object.entries(data.textureSlots) as [TextureSlot, string][];
    return {
      form: 'standard',
      data,
      textures: Object.fromEntries(slots.map(([slot, ref]) => [slot, follow.reference(ref)])),
      nextPass: follow.reference(data.nextPass),
    };
  },
};
