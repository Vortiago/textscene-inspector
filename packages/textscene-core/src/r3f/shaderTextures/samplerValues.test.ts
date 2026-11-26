import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ScopedReference } from '../../resources/reading';
import { elementsOf, samplerValues, texturesOutcome } from './samplerValues';

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

describe('texturesOutcome', () => {
  const loaded = { isArriving: false, isMissing: false };
  const missing = { isArriving: false, isMissing: true };

  it('is arriving for a slot that has not reported', () => {
    expect(texturesOutcome(['texture_albedo'], new Map())).toBe('arriving');
  });

  it('is arriving for a texture still on its way, even beside one that never draws', () => {
    const states = new Map([
      ['texture_albedo', { isArriving: true, isMissing: false }],
      ['texture_normal', missing],
    ]);
    expect(texturesOutcome(['texture_albedo', 'texture_normal'], states)).toBe('arriving');
  });

  it('is settled once each slot has its texture', () => {
    expect(texturesOutcome(['texture_albedo'], new Map([['texture_albedo', loaded]]))).toBe('settled');
  });

  it('is missing once a slot settles on a texture that never draws', () => {
    expect(texturesOutcome(['texture_albedo'], new Map([['texture_albedo', missing]]))).toBe('missing');
  });

  it('is settled for a shader with no slot', () => {
    expect(texturesOutcome([], new Map())).toBe('settled');
  });
});
