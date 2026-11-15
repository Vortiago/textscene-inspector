/**
 * The `MATERIAL` kind: every Material class, from a scene or from a file. A StandardMaterial3D
 * decodes to its data, with each gated texture slot and its `next_pass` as a reference in the
 * material's own file, and a sky material to its properties. Any other Material class is declined,
 * the same from either arrival. No THREE.
 */

import { descendsFromClass } from '../../../godot/classdb/classBaseTypes';
import { optionalReference, type Follow, type HeldResource, type ResourceKind } from '../../reading';
import { decodeSkyMaterial } from '../../sky/decode';
import { decodeStandardMaterial3D } from '../standardmaterial3d/decode';
import type { TextureSlot } from '../standardmaterial3d/types';
import type { Material, SkyMaterial, StandardMaterial } from './types';

export const MATERIAL: ResourceKind<Material> = {
  name: 'Material',
  accepts: (type) => descendsFromClass(type, 'Material'),
  decode: (held, follow) =>
    held.type === 'StandardMaterial3D'
      ? standardMaterial(held, follow)
      : (skyMaterial(held, follow) ?? { form: 'declined', type: held.type }),
};

function standardMaterial({ properties }: HeldResource, follow: Follow): StandardMaterial {
  const data = decodeStandardMaterial3D(properties);
  // The decode's gated table, never the raw property bag: Godot samples a gated slot only inside
  // its `if (features[…])` branch (`scene/resources/material.cpp:1090,1745`).
  const slots = Object.entries(data.textureSlots) as [TextureSlot, string][];
  return {
    form: 'standard',
    data,
    textures: Object.fromEntries(slots.map(([slot, ref]) => [slot, follow.reference(ref)])),
    nextPass: optionalReference(follow, data.nextPass),
  };
}

/** The sky material `held` is, or null for any other class. */
function skyMaterial({ type, properties }: HeldResource, follow: Follow): SkyMaterial | null {
  const decoded = decodeSkyMaterial(type, properties);
  if (!decoded) return null;
  const panorama = decoded.kind === 'panorama' ? optionalReference(follow, decoded.panorama) : null;
  return { form: 'sky', type, properties: decoded, panorama };
}
