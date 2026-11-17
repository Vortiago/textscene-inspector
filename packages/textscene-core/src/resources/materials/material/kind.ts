/**
 * The `MATERIAL` kind: every Material class, from a scene or from a file. A StandardMaterial3D
 * decodes to its data, with each gated texture slot and its `next_pass` as a reference in the
 * material's own file, and a sky material to its properties. Any other Material class is declined,
 * the same from either arrival. No THREE.
 */

import { descendsFromClass } from '../../../godot/classdb/classBaseTypes';
import {
  optionalReference,
  referenceKey,
  type Follow,
  type HeldResource,
  type ResourceKind,
  type ScopedReference,
} from '../../reading';
import { parseResourceReference } from '../../SubResourceResolver';
import { resourceRef } from '../../../godot/variant/resourceRef';
import { arrayLiteralBody } from '../../../godot/variant/variantParser';
import { dropTrailingComma, splitTopLevel } from '../../../godot/string/string';
import { ShaderMode, shaderModeOf } from '../../../godot/rendering/shaderLanguage';
import { decodeSkyMaterial } from '../../sky/decode';
import type { ShaderTextureReference } from '../../sky/types';
import { SHADER_CODE } from '../shadermaterial/shaderCode';
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
  if (type === 'ShaderMaterial') return shaderSkyMaterial(properties, follow);
  const decoded = decodeSkyMaterial(type, properties);
  if (!decoded) return null;
  const panorama = decoded.kind === 'panorama' ? optionalReference(follow, decoded.panorama) : null;
  return { form: 'sky', type, properties: decoded, panorama };
}

const SHADER_PARAMETER = 'shader_parameter/';

/** A ShaderMaterial whose shader is a sky shader, or null for any other shader or none. */
function shaderSkyMaterial(properties: Readonly<Record<string, string>>, follow: Follow): SkyMaterial | null {
  const { shader } = properties;
  if (shader === undefined) return null;
  const code = follow.read(SHADER_CODE, shader).value;
  if (code === undefined || code === null || shaderModeOf(code) !== ShaderMode.SKY) return null;
  const parameters: Record<string, string> = {};
  const textures: Record<string, ShaderTextureReference> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!key.startsWith(SHADER_PARAMETER)) continue;
    const name = key.slice(SHADER_PARAMETER.length);
    const texture = shaderTextureReference(value, follow);
    if (texture) textures[name] = texture;
    else parameters[name] = value;
  }
  return {
    form: 'sky',
    type: 'ShaderMaterial',
    properties: { kind: 'shader', code, file: shaderAddress(follow.reference(shader)), parameters, textures },
    panorama: null,
  };
}

/** A shader's address: a path, `path::id` in another file, or the reference for the scene's own. */
function shaderAddress(reference: ScopedReference): string {
  const isScenesOwn =
    reference.origin === undefined && parseResourceReference(reference.ref ?? '')?.type === 'SubResource';
  return isScenesOwn ? reference.ref! : referenceKey(reference);
}

/** A resource, or an array of resources and nulls that holds one resource at least, as a sampler takes. */
function shaderTextureReference(value: string, follow: Follow): ShaderTextureReference | null {
  if (resourceRef(value)) return follow.reference(value);
  const body = arrayLiteralBody(value);
  if (body === null) return null;
  const elements = dropTrailingComma(splitTopLevel(body));
  const isTextureArray =
    elements.some((element) => resourceRef(element)) &&
    elements.every((element) => element === 'null' || resourceRef(element));
  if (!isTextureArray) return null;
  return elements.map((element) => (element === 'null' ? null : follow.reference(element)));
}
