import { describe, expect, it } from 'vitest';
import { typedCollectionPrefix } from './typedCollection.js';

describe('typedCollectionPrefix', () => {
  it('gives the prefix of a typed array the class declares', () => {
    expect(typedCollectionPrefix('LightmapGIData', 'lightmap_textures')).toBe('Array[TextureLayered]');
  });

  it('finds a typed array an ancestor declares, as a FontFile inherits Font.fallbacks', () => {
    expect(typedCollectionPrefix('FontFile', 'fallbacks')).toBe('Array[Font]');
  });

  it('gives no prefix for an untyped property', () => {
    expect(typedCollectionPrefix('ArrayMesh', '_surfaces')).toBeUndefined();
  });

  it('gives no prefix for a class ClassDB does not know (edge case)', () => {
    expect(typedCollectionPrefix('NoSuchClass', 'fallbacks')).toBeUndefined();
  });
});
