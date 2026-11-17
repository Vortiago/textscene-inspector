import type * as THREE from 'three';
import type { ScopedReference } from '../../resources/reading';
import type { ShaderTextureReference } from '../../resources/sky/types';
import type { SamplerValue } from '../../shaders/uniforms/samplerUniform';

/** Each element of a sampler's reference with the key its texture reports under: `name` or `name[index]`. */
export function elementsOf(
  name: string,
  reference: ShaderTextureReference
): [string, ScopedReference | null][] {
  if (!isReferenceArray(reference)) return [[name, reference]];
  return reference.map((element, index) => [`${name}[${index}]`, element]);
}

const isReferenceArray = (
  reference: ShaderTextureReference
): reference is readonly (ScopedReference | null)[] => Array.isArray(reference);

/** A sampler array takes every element, null where none loaded, so each element keeps its index. */
export function samplerValues(
  references: Readonly<Record<string, ShaderTextureReference>>,
  loaded: ReadonlyMap<string, THREE.Texture>
): Readonly<Record<string, SamplerValue>> {
  const values: Record<string, SamplerValue> = {};
  for (const [name, reference] of Object.entries(references)) {
    if (isReferenceArray(reference)) {
      values[name] = reference.map((_, index) => loaded.get(`${name}[${index}]`) ?? null);
      continue;
    }
    const texture = loaded.get(name);
    if (texture) values[name] = texture;
  }
  return values;
}
