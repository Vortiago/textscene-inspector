import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ScopedReference } from '../../resources/reading';
import { elementsOf, samplerValues } from './samplerValues';

const reference = (ref: string) => ({ ref }) as unknown as ScopedReference;

describe('elementsOf', () => {
  it('reports a single texture under the sampler name', () => {
    const stars = reference('ExtResource("1")');
    expect(elementsOf('stars', stars)).toEqual([['stars', stars]]);
  });

  it('reports each element of a sampler array under its index, an empty one as null', () => {
    const first = reference('ExtResource("1")');
    expect(elementsOf('layers', [first, null])).toEqual([
      ['layers[0]', first],
      ['layers[1]', null],
    ]);
  });
});

describe('samplerValues', () => {
  it('gives a sampler array every element in order, null where none loaded', () => {
    const second = new THREE.Texture();
    const loaded = new Map([['layers[1]', second]]);
    const references = { layers: [reference('a'), reference('b')] };
    expect(samplerValues(references, loaded)).toEqual({ layers: [null, second] });
  });

  it('leaves out a single sampler whose texture has not loaded (edge case)', () => {
    expect(samplerValues({ stars: reference('a') }, new Map())).toEqual({});
  });
});
