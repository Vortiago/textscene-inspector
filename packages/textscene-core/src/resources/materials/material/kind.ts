/**
 * The `MATERIAL` kind: every Material class, from a scene or from a file. A StandardMaterial3D
 * decodes to its data, with each gated texture slot and its `next_pass` as a reference in the
 * material's own file, a sky material to its properties, and a ShaderMaterial to its shader's text.
 * Any other Material class is declined, the same from either arrival. No THREE.
 */

import { descendsFromClass } from '../../../godot/classdb/classBaseTypes';
import { optionalReference, type Follow, type HeldResource, type ResourceKind } from '../../reading';
import { ShaderMode, shaderModeOf } from '../../../godot/rendering/shaderLanguage';
import { decodeSkyMaterial } from '../../sky/decode';
import { decodeShaderText } from '../shadermaterial/decode';
import { decodeStandardMaterial3D } from '../standardmaterial3d/decode';
import type { TextureSlot } from '../standardmaterial3d/types';
import type { Material, SkyMaterial, StandardMaterial } from './types';

export const MATERIAL: ResourceKind<Material> = {
  name: 'Material',
  accepts: (type) => descendsFromClass(type, 'Material'),
  decode: (held, follow) => {
    if (held.type === 'StandardMaterial3D') return standardMaterial(held, follow);
    if (held.type === 'ShaderMaterial') return shaderMaterial(held.properties, follow);
    return skyMaterial(held, follow) ?? { form: 'declined', type: held.type };
  },
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

/** A ShaderMaterial as its shader's type draws it: a sky, a spatial surface, or declined for any other. */
function shaderMaterial(properties: Readonly<Record<string, string>>, follow: Follow): Material {
  const shader = decodeShaderText(properties, follow);
  if (!shader) return { form: 'declined', type: 'ShaderMaterial' };
  const mode = shaderModeOf(shader.code);
  if (mode === ShaderMode.SKY)
    return { form: 'sky', type: 'ShaderMaterial', properties: { kind: 'shader', ...shader }, panorama: null };
  if (mode === ShaderMode.SPATIAL) return { form: 'spatial-shader', shader };
  return { form: 'declined', type: 'ShaderMaterial' };
}

/** The sky material of a class the previewer builds a sky from, or null for any other class. */
function skyMaterial({ type, properties }: HeldResource, follow: Follow): SkyMaterial | null {
  const decoded = decodeSkyMaterial(type, properties);
  if (!decoded) return null;
  const panorama = decoded.kind === 'panorama' ? optionalReference(follow, decoded.panorama) : null;
  return { form: 'sky', type, properties: decoded, panorama };
}
