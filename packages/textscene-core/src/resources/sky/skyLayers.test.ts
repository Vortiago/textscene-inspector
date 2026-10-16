import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { bakeAtlasLayers, bakeSkyLayers, createReflectionAtlas, disposeSkyLayers } from './skyLayers';
import { reflectionAtlasLayout } from '../../godot/rendering/environment/reflectionProbe';
import { fastFilter } from './fastFilter';
import { testRenderer } from '../../testing/recordingWebGL';
import type { SkyBake } from './types';

const IMPORTANCE_SAMPLED: SkyBake = { radianceFilter: 'importance-sample', radianceSize: 32 };
const FAST: SkyBake = { radianceFilter: 'fast', radianceSize: 256 };
/** The GPU gate's fast bake, at a size no real-time sky has: its octmap is as wide as the fast chain. */
const FAST_AT_GATE_SIZE = { radianceFilter: 'fast', radianceSize: 64 } as unknown as SkyBake;

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

describe('bakeSkyLayers', () => {
  it("holds Godot's eight layers in one array as wide as the radiance's octmap", async () => {
    const { renderer } = await testRenderer();

    const { target } = bakeSkyLayers(renderer, radianceCube(renderer), IMPORTANCE_SAMPLED);

    expect([target.width, target.height, target.depth]).toEqual([80, 80, 8]);
  });

  it('never draws a pass into the octmap it reads, at a radiance as wide as the fast chain (edge case)', async () => {
    const { renderer } = await testRenderer();
    const feedbackDraws: THREE.Texture[] = [];
    const render = renderer.render.bind(renderer);
    vi.spyOn(renderer, 'render').mockImplementation((drawn, camera) => {
      const read = ((drawn as THREE.Mesh).material as THREE.ShaderMaterial).uniforms['source']?.value;
      const drawnInto = renderer.getRenderTarget()?.texture;
      if (read && read === drawnInto) feedbackDraws.push(read);
      render(drawn, camera);
    });

    bakeSkyLayers(renderer, radianceCube(renderer), FAST_AT_GATE_SIZE);

    expect(feedbackDraws).toEqual([]);
  });

  it('holds the seven layers of a real-time sky (edge case)', async () => {
    const { renderer } = await testRenderer();

    expect(bakeSkyLayers(renderer, radianceCube(renderer), FAST).target.depth).toBe(7);
  });

  it("draws every mip of Godot's chain into each layer, from mip 0", async () => {
    const { renderer } = await testRenderer();
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

  it('filters with linear reads between mips, clamped to the edge', async () => {
    const { renderer } = await testRenderer();

    const { texture } = bakeSkyLayers(renderer, radianceCube(renderer), IMPORTANCE_SAMPLED).target;

    expect([texture.minFilter, texture.magFilter, texture.wrapS, texture.wrapT]).toEqual([
      THREE.LinearMipmapLinearFilter,
      THREE.LinearFilter,
      THREE.ClampToEdgeWrapping,
      THREE.ClampToEdgeWrapping,
    ]);
  });

  it('filters each of the layers 1 to 6 of a real-time sky with the fast filter (edge case)', async () => {
    const { renderer } = await testRenderer();
    const selected = vi.spyOn(fastFilter, 'layerUniforms');

    bakeSkyLayers(renderer, radianceCube(renderer), FAST);

    expect(selected.mock.calls.map(([layer]) => layer)).toEqual([1, 2, 3, 4, 5, 6]);
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

  it('frees the array it made when a pass fails (error case)', async () => {
    const { renderer } = await testRenderer();
    const radiance = radianceCube(renderer);
    const disposed = vi.spyOn(THREE.WebGLArrayRenderTarget.prototype, 'dispose');
    vi.spyOn(renderer, 'copyTextureToTexture').mockImplementation(() => {
      throw new Error('lost context');
    });

    expect(() => bakeSkyLayers(renderer, radiance, IMPORTANCE_SAMPLED)).toThrow('lost context');
    expect(disposed).toHaveBeenCalledOnce();
  });
});

describe('disposeSkyLayers', () => {
  it('frees the array', async () => {
    const { renderer } = await testRenderer();
    const layers = bakeSkyLayers(renderer, radianceCube(renderer), IMPORTANCE_SAMPLED);
    const disposed = vi.spyOn(layers.target, 'dispose');

    disposeSkyLayers(layers);

    expect(disposed).toHaveBeenCalledOnce();
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

  it('magnifies linearly, as a read below mip 0 does in Godot', () => {
    expect(createReflectionAtlas(reflectionAtlasLayout(false), 1).target.texture.magFilter).toBe(
      THREE.LinearFilter
    );
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

  it("copies the capture's octmap into mip 0 of the probe's layer", async () => {
    const { renderer } = await testRenderer();
    const atlas = createReflectionAtlas(reflectionAtlasLayout(false), 3);
    const copies = vi.spyOn(renderer, 'copyTextureToTexture');

    bakeAtlasLayers(renderer, radianceCube(renderer), atlas, 2, 'importance-sample');

    const intoAtlas = copies.mock.calls.filter(([, destination]) => destination === atlas.target.texture);
    expect(intoAtlas.map(([, , , position, , mip]) => [(position as THREE.Vector3).z, mip ?? 0])).toEqual([
      [2, 0],
    ]);
  });

  it("draws each filtered layer into its own mip of the probe's layer", async () => {
    const { renderer } = await testRenderer();
    const atlas = createReflectionAtlas(reflectionAtlasLayout(false), 3);
    const draws = drawsInto(renderer, atlas.target);

    bakeAtlasLayers(renderer, radianceCube(renderer), atlas, 2, 'importance-sample');

    expect(draws()).toEqual([1, 2, 3, 4, 5, 6, 7].map((mip) => [2, mip]));
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
