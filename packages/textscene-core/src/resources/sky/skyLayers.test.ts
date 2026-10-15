import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  SKY_LAYER_GROUPS,
  SKY_LAYER_GROUP_NAMES,
  bakeAtlasLayers,
  bakeSkyLayers,
  byGroup,
  createReflectionAtlas,
  disposeSkyLayers,
} from './skyLayers';
import { reflectionAtlasLayout } from '../../godot/rendering/environment/reflectionProbe';
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

/** The materials `renderer` draws with while `bake` runs, each read at its draw as the quad is reused. */
function passesDrawnBy(renderer: THREE.WebGLRenderer, bake: () => void): Set<THREE.Material> {
  const passes = new Set<THREE.Material>();
  const render = renderer.render.bind(renderer);
  vi.spyOn(renderer, 'render').mockImplementation((drawn, camera) => {
    passes.add((drawn as THREE.Mesh).material as THREE.Material);
    render(drawn, camera);
  });
  bake();
  return passes;
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
    const selected = vi.spyOn(fastFilter, 'layerUniforms');

    bakeSkyLayers(renderer, radianceCube(renderer), FAST);

    expect(selected.mock.calls.map(([layer]) => layer)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('draws with passes of its own on each renderer (edge case)', async () => {
    const { renderer: first } = await testRenderer();
    const { renderer: second } = await testRenderer();

    const firstPasses = passesDrawnBy(first, () => bakeSkyLayers(first, radianceCube(first), FAST));
    const secondPasses = passesDrawnBy(second, () => bakeSkyLayers(second, radianceCube(second), FAST));

    expect(firstPasses.size).toBe(3);
    expect([...firstPasses].filter((pass) => secondPasses.has(pass))).toEqual([]);
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

describe('createReflectionAtlas', () => {
  it('holds an octmap layer per probe, as wide as the layout', () => {
    const atlas = createReflectionAtlas(reflectionAtlasLayout(false), 3);

    expect([atlas.target.width, atlas.target.height, atlas.target.depth]).toEqual([768, 768, 3]);
  });

  it("holds every mip down to one texel past Godot's layers, so the texture is complete (edge case)", () => {
    expect(createReflectionAtlas(reflectionAtlasLayout(false), 1).target.texture.mipmaps).toHaveLength(10);
  });

  it('holds one layer for an atlas of no probes, as a texture array needs a layer (edge case)', () => {
    expect(createReflectionAtlas(reflectionAtlasLayout(true), 0).target.depth).toBe(1);
  });
});

describe('bakeAtlasLayers', () => {
  /** The layer and the mip of each draw into `atlas`'s target. */
  function drawsInto(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget) {
    const set = vi.spyOn(renderer, 'setRenderTarget');
    return () => set.mock.calls.filter(([drawn]) => drawn === target).map(([, layer, mip]) => [layer, mip]);
  }

  it("draws the capture into mip 0 of the probe's layer, and each filtered layer into its own mip", async () => {
    const { renderer } = await testRenderer();
    const atlas = createReflectionAtlas(reflectionAtlasLayout(false), 3);
    const draws = drawsInto(renderer, atlas.target);

    bakeAtlasLayers(renderer, radianceCube(renderer), atlas, 2, 'importance-sample');

    expect(draws()).toEqual([0, 1, 2, 3, 4, 5, 6, 7].map((mip) => [2, mip]));
  });

  it("filters an update-always probe's layers 1 to 6 with the fast filter", async () => {
    const { renderer } = await testRenderer();
    const atlas = createReflectionAtlas(reflectionAtlasLayout(true), 1);
    const selected = vi.spyOn(fastFilter, 'layerUniforms');

    bakeAtlasLayers(renderer, radianceCube(renderer), atlas, 0, 'fast');

    expect(selected.mock.calls.map(([layer]) => layer)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('leaves the renderer on the target it had', async () => {
    const { renderer } = await testRenderer();
    const target = new THREE.WebGLRenderTarget(4, 4);
    renderer.setRenderTarget(target);

    bakeAtlasLayers(
      renderer,
      radianceCube(renderer),
      createReflectionAtlas(reflectionAtlasLayout(false), 1),
      0,
      'importance-sample'
    );

    expect(renderer.getRenderTarget()).toBe(target);
  });

  it('refuses a layer the atlas lacks (error case)', async () => {
    const { renderer } = await testRenderer();
    const atlas = createReflectionAtlas(reflectionAtlasLayout(false), 2);

    expect(() => bakeAtlasLayers(renderer, radianceCube(renderer), atlas, 2, 'importance-sample')).toThrow(
      'expected an atlas layer from 0 to 1, got 2'
    );
  });
});
