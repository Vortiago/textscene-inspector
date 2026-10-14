import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  SKY_LAYER_GROUPS,
  SKY_LAYER_GROUP_NAMES,
  bakeSkyLayers,
  byGroup,
  disposeSkyLayers,
} from './skyLayers';
import { fastFilter } from './fastFilter';
import { testRenderer } from '../../testing/recordingWebGL';
import type { SkyBake } from './types';

const IMPORTANCE_SAMPLED: SkyBake = { radianceFilter: 'importance-sample', radianceSize: 32 };
const FAST: SkyBake = { radianceFilter: 'fast', radianceSize: 256 };

/** A radiance cube set up on `renderer`, as the sky's cube render leaves it. */
function radianceCube(renderer: THREE.WebGLRenderer): THREE.CubeTexture {
  const target = new THREE.WebGLCubeRenderTarget(32, { type: THREE.HalfFloatType });
  renderer.initRenderTarget(target);
  return target.texture;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('byGroup', () => {
  it("gives each group of layers `make`'s value", () => {
    expect(byGroup((group) => SKY_LAYER_GROUPS[group].firstLayer)).toEqual({ sharp: 1, rough: 4, last: 7 });
  });

  it('calls `make` once per group, in the order of the groups (edge case)', () => {
    const make = vi.fn((group: string) => group);

    byGroup(make);

    expect(make.mock.calls.map(([group]) => group)).toEqual([...SKY_LAYER_GROUP_NAMES]);
  });
});

describe('bakeSkyLayers', () => {
  it('bakes each group into a cube as wide as its first layer, a mip per layer', async () => {
    const { renderer } = await testRenderer();

    const layers = bakeSkyLayers(renderer, radianceCube(renderer), IMPORTANCE_SAMPLED);

    expect(
      SKY_LAYER_GROUP_NAMES.map((group) => [layers[group].width, layers[group].texture.minFilter])
    ).toEqual([
      [128, THREE.LinearMipmapLinearFilter],
      [32, THREE.LinearMipmapLinearFilter],
      [16, THREE.LinearFilter],
    ]);
  });

  it('filters each of the layers 1 to 7 of a real-time sky with the fast filter (edge case)', async () => {
    const { renderer } = await testRenderer();
    const selected = vi.spyOn(fastFilter, 'selectLayer');

    bakeSkyLayers(renderer, radianceCube(renderer), FAST);

    expect(selected.mock.calls.map(([layer]) => layer)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('leaves the renderer on the target it had', async () => {
    const { renderer } = await testRenderer();
    const target = new THREE.WebGLRenderTarget(4, 4);
    renderer.setRenderTarget(target);

    bakeSkyLayers(renderer, radianceCube(renderer), IMPORTANCE_SAMPLED);

    expect(renderer.getRenderTarget()).toBe(target);
  });

  it('frees the cubes it made when a pass fails (error case)', async () => {
    const { renderer } = await testRenderer();
    const radiance = radianceCube(renderer);
    const disposed = vi.spyOn(THREE.WebGLCubeRenderTarget.prototype, 'dispose');
    vi.spyOn(renderer, 'copyTextureToTexture').mockImplementation(() => {
      throw new Error('lost context');
    });

    expect(() => bakeSkyLayers(renderer, radiance, IMPORTANCE_SAMPLED)).toThrow('lost context');
    expect(disposed).toHaveBeenCalledTimes(SKY_LAYER_GROUP_NAMES.length);
  });
});

describe('disposeSkyLayers', () => {
  it('frees every cube', async () => {
    const { renderer } = await testRenderer();
    const layers = bakeSkyLayers(renderer, radianceCube(renderer), IMPORTANCE_SAMPLED);
    const disposed = SKY_LAYER_GROUP_NAMES.map((group) => vi.spyOn(layers[group], 'dispose'));

    disposeSkyLayers(layers);

    expect(disposed.map((dispose) => dispose.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it('frees cubes that were never drawn (edge case)', () => {
    const layers = byGroup(() => new THREE.WebGLCubeRenderTarget(1));

    expect(() => disposeSkyLayers(layers)).not.toThrow();
  });
});
