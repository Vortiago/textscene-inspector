import type * as THREE from 'three';
import type { ScopedReference } from '../../resources/reading';
import type { ShaderTextureReference } from '../../resources/materials/shadermaterial/types';
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

/** Where a shader's texture slots stand: one still arriving, one that never draws, or all settled. */
export type TexturesOutcome = 'arriving' | 'missing' | 'settled';

/** Where the slots of `keys` stand; a slot that has not reported is still arriving. */
export function texturesOutcome(
  keys: readonly string[],
  states: ReadonlyMap<string, { readonly isArriving: boolean; readonly isMissing: boolean }>
): TexturesOutcome {
  const reported = keys.map((key) => states.get(key));
  if (reported.some((state) => state === undefined || state.isArriving)) return 'arriving';
  return reported.some((state) => state!.isMissing) ? 'missing' : 'settled';
}
