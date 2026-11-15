/**
 * Building a NoiseTexture2D from `scenes/demos/3d/procedural_materials/materials/ice.tres`:
 * a seamless ramped albedo and an `as_normal_map` normal texture, each naming
 * sub-resources of that file, here as a scene's tables. Sizes shrink from 1024x1024, about a second per
 * texture, since the pipeline is the same at any size. The build runs as a worker
 * job, here through the in-thread runner, which runs the same job.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { loadedValue } from '../../reading/reading.testkit';
import { TEXTURE_2D } from '../texture2d/kind';
import { WorkerJobRunner } from '../../../workers/WorkerJobRunner';
import { resetProceduralTextures, type JobRunner } from '../proceduralBuilds';
import { noiseTexture2D } from './resolveNoiseTexture';
import { textureView } from '../textureView';
import { godotTextureFilterState, samplesMipChain } from '../godotTextureFilter';

const ICE = `[sub_resource type="Gradient" id="Gradient_16ij7"]
colors = PackedColorArray(0.6, 0.8, 1, 1, 1, 1, 1, 1)

[sub_resource type="FastNoiseLite" id="FastNoiseLite_qbhty"]
frequency = 0.003
fractal_type = 2
fractal_lacunarity = 2.5

[sub_resource type="NoiseTexture2D" id="NoiseTexture2D_m8iqd"]
width = 32
height = 32
noise = SubResource("FastNoiseLite_qbhty")
color_ramp = SubResource("Gradient_16ij7")
seamless = true

[sub_resource type="FastNoiseLite" id="FastNoiseLite_5tmlw"]
frequency = 0.003
fractal_type = 2
fractal_octaves = 10
fractal_lacunarity = 1.342
fractal_gain = 0.776
fractal_weighted_strength = 0.04

[sub_resource type="NoiseTexture2D" id="NoiseTexture2D_gyhec"]
width = 32
height = 32
noise = SubResource("FastNoiseLite_5tmlw")
seamless = true
as_normal_map = true
bump_strength = 4.0
`;

const runner = new WorkerJobRunner();

/** The file with the albedo's `generate_mipmaps` off, which changes no pixel of its base. */
const WITHOUT_MIPMAPS = ICE.replace(
  'seamless = true\n\n[sub_resource type="FastNoiseLite" id="FastNoiseLite_5tmlw"]',
  'seamless = true\ngenerate_mipmaps = false\n\n[sub_resource type="FastNoiseLite" id="FastNoiseLite_5tmlw"]'
);

const ALBEDO = 'SubResource("NoiseTexture2D_m8iqd")';
const NORMAL = 'SubResource("NoiseTexture2D_gyhec")';

/** The build lookup of the NoiseTexture2D `ref` names in tables written as `sceneText`. */
function lookupOf(ref: string, sceneText = ICE) {
  const source = loadedValue(TEXTURE_2D, ref, sceneText);
  if (source.form !== 'noise') throw new Error(`expected a noise source, got ${source.form}`);
  return noiseTexture2D(source);
}

/** Builds the texture `ref` names, and its cache key. */
async function built(ref: string, sceneText = ICE) {
  const lookup = lookupOf(ref, sceneText);
  if (lookup?.status !== 'pending') throw new Error(`expected a pending build, got ${lookup?.status}`);
  const handle = lookup.start(runner);
  const texture = await handle.settled;
  handle.release();
  if (!(texture instanceof THREE.DataTexture)) throw new Error('expected the build to give a DataTexture');
  return { texture, key: lookup.key };
}

afterEach(() => {
  resetProceduralTextures();
});

describe('noiseTexture2D — the ice.tres shape', () => {
  it('builds the albedo slot as a ramp-coloured texture', async () => {
    const { texture } = await built(ALBEDO);
    expect(texture.image.width).toBe(32);
    expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);

    // The ramp runs pale blue to white, so blue is the strongest channel and
    // nothing is near black.
    const data = texture.image.data as Uint8Array;
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i + 2]).toBeGreaterThanOrEqual(data[i]!);
      expect(data[i]).toBeGreaterThan(100);
    }
  });

  it('builds the normal slot as a non-sRGB normal map', async () => {
    const { texture } = await built(NORMAL);
    expect(texture.colorSpace).toBe(THREE.NoColorSpace);

    const data = texture.image.data as Uint8Array;
    for (let i = 0; i < data.length; i += 4) {
      // Unit normals packed around the midpoint, +Z dominant for a height field.
      const [nx = 0, ny = 0, nz = 0] = [data[i]!, data[i + 1]!, data[i + 2]!].map((v) => v / 127.5 - 1);
      expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 1);
      expect(nz).toBeGreaterThan(0);
    }
  });

  it('gives the two slots different pixels — each has its own generator', async () => {
    const albedo = await built(ALBEDO);
    const normal = await built(NORMAL);
    expect(albedo.key).not.toBe(normal.key);
    expect([...(albedo.texture.image.data as Uint8Array)]).not.toEqual([
      ...(normal.texture.image.data as Uint8Array),
    ]);
  });

  it('is ready with the same texture once built', async () => {
    const { texture, key } = await built(ALBEDO);
    expect(lookupOf(ALBEDO)).toEqual({
      status: 'ready',
      texture,
      key,
    });
  });

  it('reuses the texture after a re-parse of an unchanged file', async () => {
    const { texture } = await built(ALBEDO);
    const reparsed = lookupOf(ALBEDO);
    expect(reparsed?.status === 'ready' && reparsed.texture).toBe(texture);
  });

  it('carries the chain of its size', async () => {
    const { texture } = await built(ALBEDO);
    expect(texture.mipmaps).toHaveLength(6);
  });

  it('carries no chain with generate_mipmaps off', async () => {
    const { texture } = await built(ALBEDO, WITHOUT_MIPMAPS);
    expect(texture.mipmaps).toHaveLength(0);
  });

  it('keys the texture without a chain apart from the one the job builds', () => {
    const chained = lookupOf(ALBEDO);
    const unchained = lookupOf(ALBEDO, WITHOUT_MIPMAPS);
    expect(unchained?.key).toBe(`${chained?.key}:without-mipmaps`);
  });

  it('drops the chain without sampling again when generate_mipmaps goes off', async () => {
    const { texture } = await built(ALBEDO);
    const run = vi.fn(runner.run.bind(runner)) as JobRunner['run'];
    const lookup = lookupOf(ALBEDO, WITHOUT_MIPMAPS);
    if (lookup?.status !== 'pending') throw new Error(`expected a pending build, got ${lookup?.status}`);

    const unchained = await lookup.start({ run }).settled;

    expect(run).not.toHaveBeenCalled();
    expect([unchained?.mipmaps.length, (unchained as THREE.DataTexture).image.data]).toEqual([
      0,
      texture.image.data,
    ]);
  });

  it('is ready at once, with the chain, when generate_mipmaps goes on', async () => {
    const { texture } = await built(ALBEDO, WITHOUT_MIPMAPS);
    const lookup = lookupOf(ALBEDO);
    expect(lookup?.status === 'ready' && lookup.texture.mipmaps).toHaveLength(6);
    expect(lookup?.status === 'ready' && lookup.texture).not.toBe(texture);
  });

  it('builds again after an edit to its noise', () => {
    const edited = ICE.replace(
      'frequency = 0.003\nfractal_type = 2\nfractal_lacunarity = 2.5',
      'frequency = 0.004\nfractal_type = 2\nfractal_lacunarity = 2.5'
    );
    const before = lookupOf(ALBEDO);
    const after = lookupOf(ALBEDO, edited);
    expect(after?.key).not.toBe(before?.key);
  });

  it('keys on content, not on the sub-resource id', () => {
    const renamed = ICE.replaceAll('NoiseTexture2D_m8iqd', 'NoiseTexture2D_renamed');
    expect(lookupOf('SubResource("NoiseTexture2D_renamed")', renamed)?.key).toBe(lookupOf(ALBEDO)?.key);
  });

  it("declines a texture wider than the previewer's texture ceiling, before any build", () => {
    const oversized = `[sub_resource type="FastNoiseLite" id="n"]

[sub_resource type="NoiseTexture2D" id="wide"]
width = 2000000000
height = 512
noise = SubResource("n")
`;
    expect(lookupOf('SubResource("wide")', oversized)).toBeNull();
  });
});

describe('a NoiseTexture2D in a 3D texture slot', () => {
  const filterState = (filter?: number) =>
    filter === undefined ? undefined : godotTextureFilterState(filter);

  const bound = async (filter?: number) => {
    const { texture } = await built(ALBEDO);
    return textureView(texture, { colorSpace: THREE.SRGBColorSpace, filter: filterState(filter) });
  };

  it('samples between its levels under the default texture_filter (LINEAR_WITH_MIPMAPS)', async () => {
    const texture = await bound();
    expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
    expect(samplesMipChain(texture)).toBe(true);
  });

  it.each([2, 3, 4, 5])(
    'samples between its levels under the mipmapped texture_filter %i',
    async (filter) => {
      const texture = await bound(filter);
      expect(samplesMipChain(texture)).toBe(true);
      expect(texture.generateMipmaps).toBe(false);
      expect(texture.minFilter).toBe(godotTextureFilterState(filter).minFilter);
    }
  );

  it.each([0, 1])('samples its base level only under texture_filter %i', async (filter) => {
    const texture = await bound(filter);
    expect(samplesMipChain(texture)).toBe(false);
    expect(texture.minFilter).toBe(godotTextureFilterState(filter).minFilter);
  });

  it.each([0, 1])(
    'uploads no levels under texture_filter %i, and the shared texture keeps its chain',
    async (filter) => {
      const { texture: shared } = await built(ALBEDO);
      const texture = textureView(shared, { colorSpace: THREE.SRGBColorSpace, filter: filterState(filter) });
      expect([texture.mipmaps.length, shared.mipmaps.length]).toEqual([0, 6]);
    }
  );
});
