import { describe, expect, it } from 'vitest';
import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearMipmapNearestFilter,
  NearestFilter,
  NearestMipmapLinearFilter,
  NearestMipmapNearestFilter,
  RepeatWrapping,
} from 'three';
import { GODOT_SAMPLING, samplerState } from './samplerState.js';

const settings = (filter: string, repeat = 'repeat_disable') => ({ filter, repeat });

// `samplers_rd_allocate` (`material_storage.cpp:2454`) builds each Vulkan sampler. A Vulkan sampler
// reads every mip level, so a filter without mipmaps picks the nearest level, as GL's *_MIPMAP_NEAREST.
describe('samplerState', () => {
  it.each([
    ['filter_nearest', NearestFilter, NearestMipmapNearestFilter],
    ['filter_linear', LinearFilter, LinearMipmapNearestFilter],
    ['filter_nearest_mipmap', NearestFilter, NearestMipmapLinearFilter],
    ['filter_linear_mipmap', LinearFilter, LinearMipmapLinearFilter],
    ['filter_nearest_mipmap_anisotropic', NearestFilter, NearestMipmapLinearFilter],
    ['filter_linear_mipmap_anisotropic', LinearFilter, LinearMipmapLinearFilter],
  ])('gives %s its magnification and minification filters', (filter, magFilter, minFilter) => {
    const state = samplerState(settings(filter), 3, GODOT_SAMPLING);
    expect([state.magFilter, state.minFilter]).toEqual([magFilter, minFilter]);
  });

  it('reads the one level of a texture with no mipmaps with the magnification filter', () => {
    expect(samplerState(settings('filter_linear_mipmap'), 1, GODOT_SAMPLING).minFilter).toBe(LinearFilter);
  });

  it('picks the nearest mip level where the project asks for it', () => {
    const sampling = { ...GODOT_SAMPLING, useNearestMipmapFilter: true };
    expect(samplerState(settings('filter_linear_mipmap'), 3, sampling).minFilter).toBe(
      LinearMipmapNearestFilter
    );
  });

  it('gives an anisotropic filter the project anisotropy, 4x by default', () => {
    expect(samplerState(settings('filter_linear_mipmap_anisotropic'), 3, GODOT_SAMPLING).anisotropy).toBe(4);
    expect(samplerState(settings('filter_linear_mipmap'), 3, GODOT_SAMPLING).anisotropy).toBe(1);
  });

  it.each([
    ['repeat_enable', RepeatWrapping],
    ['repeat_disable', ClampToEdgeWrapping],
  ])('wraps %s with %s', (repeat, wrap) => {
    expect(samplerState(settings('filter_linear', repeat), 1, GODOT_SAMPLING).wrap).toBe(wrap);
  });
});
