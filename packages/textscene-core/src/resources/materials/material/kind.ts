import { descendsFromClass } from '../../../godot/classdb/classBaseTypes';
import {
  optionalReference,
  type Follow,
  type HeldResource,
  type ResourceKind,
  type ScopedReference,
} from '../../reading';
import { ShaderMode, shaderModeOf } from '../../../godot/rendering/shaderLanguage';
import { resourceRef } from '../../../godot/variant/resourceRef';
import { skyMaterialText } from '../../sky/skyMaterialText';
import { decodeShaderText } from '../shadermaterial/decode';
import { decodeStandardMaterial3D } from '../standardmaterial3d/decode';
import type { TextureSlot } from '../standardmaterial3d/types';
import type { BaseMaterialProperties, Material, SkyMaterial, StandardMaterial } from './types';

export const MATERIAL: ResourceKind<Material> = {
  name: 'Material',
  accepts: (type) => descendsFromClass(type, 'Material'),
  decode: (held, follow) => {
    if (held.type === 'StandardMaterial3D') return standardMaterial(held, follow);
    if (held.type === 'ORMMaterial3D')
      return { form: 'orm', baseMaterial: baseMaterialProperties('ORMMaterial3D', held.properties, follow) };
    if (held.type === 'ShaderMaterial') return shaderMaterial(held.properties, follow);
    return skyMaterial(held, follow) ?? { form: 'declined', type: held.type };
  },
};

function standardMaterial({ properties }: HeldResource, follow: Follow): StandardMaterial {
  const data = decodeStandardMaterial3D(properties);
  const baseMaterial = baseMaterialProperties('StandardMaterial3D', properties, follow);
  // The decode's gated table, never the raw property bag: Godot samples a gated slot only inside
  // its `if (features[…])` branch (`scene/resources/material.cpp:1090,1745`).
  const slots = Object.entries(data.textureSlots) as [TextureSlot, string][];
  return {
    form: 'standard',
    data,
    baseMaterial,
    textures: Object.fromEntries(slots.map(([slot, ref]) => [slot, follow.reference(ref)])),
    nextPass: optionalReference(follow, data.nextPass),
  };
}

/** The properties of a BaseMaterial3D, split into Variant text and resources. */
function baseMaterialProperties(
  materialClass: BaseMaterialProperties['materialClass'],
  held: Readonly<Record<string, string>>,
  follow: Follow
): BaseMaterialProperties {
  return { materialClass, ...splitResources(held, follow) };
}

/** A property bag split into its Variant text and the resources it names. */
function splitResources(held: Readonly<Record<string, string>>, follow: Follow) {
  const properties: Record<string, string> = {};
  const resources: Record<string, ScopedReference> = {};
  for (const [name, value] of Object.entries(held)) {
    if (resourceRef(value)) resources[name] = follow.reference(value);
    else properties[name] = value;
  }
  return { properties, resources };
}

/** A ShaderMaterial as its shader's type draws it: a sky, a spatial surface, or declined for any other. */
function shaderMaterial(properties: Readonly<Record<string, string>>, follow: Follow): Material {
  const shader = decodeShaderText(properties, follow);
  if (!shader) return { form: 'declined', type: 'ShaderMaterial' };
  const mode = shaderModeOf(shader.code);
  if (mode === ShaderMode.SKY) return { form: 'sky', type: 'ShaderMaterial', properties: shader };
  if (mode === ShaderMode.SPATIAL) return { form: 'spatial-shader', shader };
  return { form: 'declined', type: 'ShaderMaterial' };
}

/** The sky material of a class whose shader Godot generates, or null for any other class. */
function skyMaterial({ type, properties }: HeldResource, follow: Follow): SkyMaterial | null {
  const shader = skyMaterialText(type, properties, splitResources(properties, follow).resources);
  return shader && { form: 'sky', type, properties: shader };
}
