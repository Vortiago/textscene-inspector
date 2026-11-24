import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createReflectionAtlas, createSkyLayers } from './octmapArrays';
import { drawDownsample, drawFastFilter } from './octmapPasses';
import { bakeAtlasLayers, SkyLayerBaker } from './skyLayers';
import { reflectionAtlasLayout } from '../../godot/rendering/environment/reflectionProbe';
import { nodeTestRenderer } from '../../testing/nodeTestRenderer';
import type { SkyBake } from './types';
import { bakeSkyLayers } from './skyLayers.testkit';

vi.mock('./octmapPasses', async (actual) => {
  const passes = await actual<typeof import('./octmapPasses')>();
  return {
    ...passes,
    drawDownsample: vi.fn(passes.drawDownsample),
    drawFastFilter: vi.fn(passes.drawFastFilter),
  };
});

const IMPORTANCE_SAMPLED: SkyBake = { radianceFilter: 'importance-sample', radianceSize: 32 };
const FAST: SkyBake = { radianceFilter: 'fast', radianceSize: 256 };
/** The GPU gate's fast bake, at a size no real-time sky has: its octmap is as wide as the fast chain. */
const FAST_AT_GATE_SIZE = { radianceFilter: 'fast', radianceSize: 64 } as unknown as SkyBake;

/** The radiance pass, the downsampler, and the fast filter's four scatters of a 2 by 2 block. */
const FAST_BAKE_PASSES = 6;

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
  vi.mocked(drawDownsample).mockClear();
  vi.mocked(drawFastFilter).mockClear();
});

/** The quality and the path of each fast filter draw, and the widths of its six images. */
const fastFilterDraws = () =>
  vi.mocked(drawFastFilter).mock.calls.map(([, , , { quality, isTextureArray }, sizes]) => ({
    quality,
    sizes,
    isTextureArray,
  }));

describe('bakeSkyLayers', () => {
  it("holds Godot's eight layers in one array as wide as the radiance's octmap", async () => {
    const { renderer } = await nodeTestRenderer();

    const { target } = bakeSkyLayers(renderer, radianceCube(renderer), IMPORTANCE_SAMPLED);

    expect([target.width, target.height, target.depth]).toEqual([80, 80, 8]);
  });

  it('never draws a pass into the octmap it reads, at a radiance as wide as the fast chain (edge case)', async () => {
    const { renderer } = await nodeTestRenderer();

    bakeSkyLayers(renderer, radianceCube(renderer), FAST_AT_GATE_SIZE);

    const downsamples = vi.mocked(drawDownsample).mock.calls;
    expect(downsamples.length).toBeGreaterThan(0);
    expect(downsamples.filter(([, source, target]) => source === target.texture)).toEqual([]);
  });

  it('holds the seven layers of a real-time sky (edge case)', async () => {
    const { renderer } = await nodeTestRenderer();

    expect(bakeSkyLayers(renderer, radianceCube(renderer), FAST).target.depth).toBe(7);
  });

  it("draws every mip of Godot's chain into each layer, from mip 0", async () => {
    const { renderer } = await nodeTestRenderer();
    const copies = vi.spyOn(renderer, 'copyTextureToTexture');

    const { target } = bakeSkyLayers(renderer, radianceCube(renderer), IMPORTANCE_SAMPLED);

    const drawn = copies.mock.calls
      .filter(([, destination]) => destination === target.texture)
      .map(([, , , position, , mip]) => `${(position as THREE.Vector3).z}@${mip}`);
    const expected = [0, 1, 2, 3, 4, 5, 6, 7].flatMap((layer) =>
      [0, 1, 2, 3].map((mip) => `${layer}@${mip}`)
    );
    expect(drawn).toEqual(expected);
  });

  it.each([
    ['an importance-sampled', IMPORTANCE_SAMPLED, 4],
    ['a real-time', FAST, 7],
  ])("holds only the mips %s sky's layers draw", async (_kind, bake, mips) => {
    const { renderer } = await nodeTestRenderer();

    const { texture } = bakeSkyLayers(renderer, radianceCube(renderer), bake).target;

    expect(texture.mipmaps).toHaveLength(mips);
  });

  it.each([
    ['importance-sampling', IMPORTANCE_SAMPLED, 3],
    ['fast', FAST, 5],
  ])('holds only the mips the %s filter reads in its chain', async (_kind, bake, mips) => {
    const { renderer } = await nodeTestRenderer();
    const chains: THREE.WebGLRenderTarget[] = [];
    const initRenderTarget = renderer.initRenderTarget.bind(renderer);
    vi.spyOn(renderer, 'initRenderTarget').mockImplementation((target) => {
      if (!(target instanceof THREE.WebGLArrayRenderTarget) && target.texture.mipmaps.length > 0)
        chains.push(target);
      initRenderTarget(target);
    });

    bakeSkyLayers(renderer, radianceCube(renderer), bake);

    expect(chains.map((chain) => chain.texture.mipmaps.length)).toEqual([mips]);
  });

  it('filters with linear reads between mips, clamped to the edge', async () => {
    const { renderer } = await nodeTestRenderer();

    const { texture } = bakeSkyLayers(renderer, radianceCube(renderer), IMPORTANCE_SAMPLED).target;

    expect([texture.minFilter, texture.magFilter, texture.wrapS, texture.wrapT]).toEqual([
      THREE.LinearMipmapLinearFilter,
      THREE.LinearFilter,
      THREE.ClampToEdgeWrapping,
      THREE.ClampToEdgeWrapping,
    ]);
  });

  it("picks the nearest mip for a surface's read in a project that asks for it, as Godot's samplers do", async () => {
    const { renderer } = await nodeTestRenderer();
    const sampling = { anisotropicFilteringLevel: 2, useNearestMipmapFilter: true };

    const { texture } = bakeSkyLayers(renderer, radianceCube(renderer), IMPORTANCE_SAMPLED, {
      sampling,
    }).target;

    expect(texture.minFilter).toBe(THREE.LinearMipmapNearestFilter);
  });

  it("filters a real-time sky's layers 1 to 6 in one fast filter draw on the texture array path", async () => {
    const { renderer } = await nodeTestRenderer();

    bakeSkyLayers(renderer, radianceCube(renderer), FAST);

    expect(fastFilterDraws()).toEqual([{ quality: 'low', sizes: Array(6).fill(640), isTextureArray: true }]);
  });

  it("stores each of a real-time sky's six filtered images in its layer", async () => {
    const { renderer } = await nodeTestRenderer();
    const layers = createSkyLayers(FAST);
    const baker = new SkyLayerBaker(renderer, layers, FAST.radianceFilter);

    expect(layersStoredBy(renderer, layers.target, () => baker.bakeEveryLayer(() => {}))).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ]);
  });

  it("filters a real-time sky with Godot's high-quality taps in a project that asks for them", async () => {
    const { renderer } = await nodeTestRenderer();

    bakeSkyLayers(renderer, radianceCube(renderer), FAST, { fastFilterQuality: 'high' });

    expect(fastFilterDraws().map(({ quality }) => quality)).toEqual(['high']);
  });

  it('draws with passes of its own on each renderer (edge case)', async () => {
    const { renderer: first } = await nodeTestRenderer();
    const { renderer: second } = await nodeTestRenderer();

    const firstPasses = passesDrawnBy(first, () => bakeSkyLayers(first, radianceCube(first), FAST));
    const secondPasses = passesDrawnBy(second, () => bakeSkyLayers(second, radianceCube(second), FAST));

    expect(firstPasses.size).toBe(FAST_BAKE_PASSES);
    expect([...firstPasses].filter((pass) => secondPasses.has(pass))).toEqual([]);
  });

  it('leaves the renderer on the target it had', async () => {
    const { renderer } = await nodeTestRenderer();
    const target = new THREE.WebGLRenderTarget(4, 4);
    renderer.setRenderTarget(target);

    bakeSkyLayers(renderer, radianceCube(renderer), IMPORTANCE_SAMPLED);

    expect(renderer.getRenderTarget()).toBe(target);
  });

  it('frees the array it made when a pass fails (error case)', async () => {
    const { renderer } = await nodeTestRenderer();
    const radiance = radianceCube(renderer);
    const disposed = vi.spyOn(THREE.WebGLArrayRenderTarget.prototype, 'dispose');
    vi.spyOn(renderer, 'copyTextureToTexture').mockImplementation(() => {
      throw new Error('lost context');
    });

    expect(() => bakeSkyLayers(renderer, radiance, IMPORTANCE_SAMPLED)).toThrow('lost context');
    expect(disposed).toHaveBeenCalledOnce();
  });
});

/** The layers of `target` that `run` copies a mip 0 into, in order. */
function layersStoredBy(
  renderer: THREE.WebGLRenderer,
  target: THREE.WebGLArrayRenderTarget,
  run: () => void
) {
  const copies = vi.spyOn(renderer, 'copyTextureToTexture');
  run();
  return copies.mock.calls
    .filter(([, destination, , , , mip]) => destination === target.texture && mip === 0)
    .map(([, , , position]) => (position as THREE.Vector3).z);
}

describe('SkyLayerBaker', () => {
  const drawNothing = () => {};

  it('stores layer 0 alone for a bake of the first layer, as an incremental sky does', async () => {
    const { renderer } = await nodeTestRenderer();
    const layers = createSkyLayers(IMPORTANCE_SAMPLED);
    const baker = new SkyLayerBaker(renderer, layers, IMPORTANCE_SAMPLED.radianceFilter);
    expect(layersStoredBy(renderer, layers.target, () => baker.bakeFirstLayer(drawNothing))).toEqual([0]);
  });

  it('stores only the layer it filters', async () => {
    const { renderer } = await nodeTestRenderer();
    const layers = createSkyLayers(IMPORTANCE_SAMPLED);
    const baker = new SkyLayerBaker(renderer, layers, IMPORTANCE_SAMPLED.radianceFilter);
    baker.bakeFirstLayer(drawNothing);
    expect(layersStoredBy(renderer, layers.target, () => baker.filterLayer(3))).toEqual([3]);
  });

  it('keeps its targets from one bake to the next (edge case)', async () => {
    const { renderer } = await nodeTestRenderer();
    const layers = createSkyLayers(IMPORTANCE_SAMPLED);
    const baker = new SkyLayerBaker(renderer, layers, IMPORTANCE_SAMPLED.radianceFilter);
    const targets: THREE.WebGLRenderTarget[] = [];
    const draw = (octmap: THREE.WebGLRenderTarget) => void targets.push(octmap);
    baker.bakeEveryLayer(draw);
    baker.bakeEveryLayer(draw);
    expect(targets[0]).toBe(targets[1]);
  });
});

describe('bakeAtlasLayers', () => {
  /** The layer and the mip of each draw into `atlas`'s target. */
  function drawsInto(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget) {
    const set = vi.spyOn(renderer, 'setRenderTarget');
    return () => set.mock.calls.filter(([drawn]) => drawn === target).map(([, layer, mip]) => [layer, mip]);
  }

  it("copies the capture's octmap into mip 0 of the probe's layer", async () => {
    const { renderer } = await nodeTestRenderer();
    const atlas = createReflectionAtlas(reflectionAtlasLayout(false), 3);
    const copies = vi.spyOn(renderer, 'copyTextureToTexture');

    bakeAtlasLayers(renderer, radianceCube(renderer), atlas, 2, 'importance-sample');

    const intoAtlas = copies.mock.calls.filter(([, destination]) => destination === atlas.target.texture);
    expect(intoAtlas.map(([, , , position, , mip]) => [(position as THREE.Vector3).z, mip ?? 0])).toEqual([
      [2, 0],
    ]);
  });

  it("draws each filtered layer into its own mip of the probe's layer", async () => {
    const { renderer } = await nodeTestRenderer();
    const atlas = createReflectionAtlas(reflectionAtlasLayout(false), 3);
    const draws = drawsInto(renderer, atlas.target);

    bakeAtlasLayers(renderer, radianceCube(renderer), atlas, 2, 'importance-sample');

    expect(draws()).toEqual([1, 2, 3, 4, 5, 6, 7].map((mip) => [2, mip]));
  });

  it("filters an update-always probe's layers 1 to 6 in one fast filter draw on the path without arrays", async () => {
    const { renderer } = await nodeTestRenderer();
    const layout = reflectionAtlasLayout(true);
    const atlas = createReflectionAtlas(layout, 1);

    bakeAtlasLayers(renderer, radianceCube(renderer), atlas, 0, 'fast');

    const sizes = layout.layerSizes.slice(1, 7);
    expect(fastFilterDraws()).toEqual([{ quality: 'low', sizes, isTextureArray: false }]);
  });

  it("copies an update-always probe's six filtered images into mips 1 to 6 of its layer", async () => {
    const { renderer } = await nodeTestRenderer();
    const atlas = createReflectionAtlas(reflectionAtlasLayout(true), 2);
    const copies = vi.spyOn(renderer, 'copyTextureToTexture');

    bakeAtlasLayers(renderer, radianceCube(renderer), atlas, 1, 'fast');

    const intoAtlas = copies.mock.calls.filter(([, destination]) => destination === atlas.target.texture);
    const places = intoAtlas.map(([, , , position, , mip]) => [(position as THREE.Vector3).z, mip ?? 0]);
    expect(places).toEqual([0, 1, 2, 3, 4, 5, 6].map((mip) => [1, mip]));
  });

  it("filters an update-always probe with Godot's high-quality taps in a project that asks for them", async () => {
    const { renderer } = await nodeTestRenderer();
    const atlas = createReflectionAtlas(reflectionAtlasLayout(true), 1);

    bakeAtlasLayers(renderer, radianceCube(renderer), atlas, 0, 'fast', 'high');

    expect(fastFilterDraws().map(({ quality }) => quality)).toEqual(['high']);
  });

  it('leaves the renderer on the target it had', async () => {
    const { renderer } = await nodeTestRenderer();
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
    const { renderer } = await nodeTestRenderer();
    const atlas = createReflectionAtlas(reflectionAtlasLayout(false), 2);

    expect(() => bakeAtlasLayers(renderer, radianceCube(renderer), atlas, 2, 'importance-sample')).toThrow(
      'expected an atlas layer from 0 to 1, got 2'
    );
  });
});
