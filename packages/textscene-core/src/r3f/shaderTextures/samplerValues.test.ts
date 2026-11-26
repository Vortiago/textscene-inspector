import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ScopedReference } from '../../resources/reading';
import { elementsOf, isEverySampledTextureSettled, samplerValues } from './samplerValues';

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

describe('isEverySampledTextureSettled', () => {
  const albedo = reference('ExtResource("1")');
  const normal = reference('ExtResource("2")');
  const samplers = { texture_albedo: {} };
  const loaded = { isArriving: false };

  it('waits for a slot that has not reported', () => {
    expect(isEverySampledTextureSettled({ texture_albedo: albedo }, samplers, new Map())).toBe(false);
  });

  it('waits for a texture still on its way', () => {
    const states = new Map([['texture_albedo', { isArriving: true }]]);
    expect(isEverySampledTextureSettled({ texture_albedo: albedo }, samplers, states)).toBe(false);
  });

  it('ends the wait once each declared sampler has settled', () => {
    const states = new Map([['texture_albedo', loaded]]);
    expect(isEverySampledTextureSettled({ texture_albedo: albedo }, samplers, states)).toBe(true);
  });

  it('ignores a texture no sampler declares, which never reports', () => {
    const states = new Map([['texture_albedo', loaded]]);
    const references = { texture_albedo: albedo, texture_normal: normal };
    expect(isEverySampledTextureSettled(references, samplers, states)).toBe(true);
  });

  it('waits for each element of a sampler array by its own key', () => {
    const references = { texture_albedo: [albedo, null, normal] };
    const states = new Map([['texture_albedo[0]', loaded]]);
    expect(isEverySampledTextureSettled(references, samplers, states)).toBe(false);
    states.set('texture_albedo[2]', loaded);
    expect(isEverySampledTextureSettled(references, samplers, states)).toBe(true);
  });
});
