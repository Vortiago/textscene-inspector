/**
 * Resolving a NoiseTexture2D from `scenes/demos/3d/procedural_materials/materials/ice.tres`:
 * a seamless ramped albedo and an `as_normal_map` normal texture, each naming
 * sub-resources of that file. Sizes shrink from 1024x1024, about a second per
 * texture, since the pipeline is the same at any size. The build runs as a worker
 * job, here through the in-thread runner, which runs the same job.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { parseTresFile } from '../../../parser/parsedResource';
import type { TscnInternalResource } from '../../../parser/types';
import { WorkerJobRunner } from '../../../workers/WorkerJobRunner';
import { resetProceduralTextures, type JobRunner } from '../proceduralBuilds';
import { resolveNoiseTexture2D } from './resolveNoiseTexture';
import { textureView } from '../textureView';
import { godotTextureFilterState, samplesMipChain } from '../godotTextureFilter';

const ICE = `[gd_resource type="StandardMaterial3D" format=3]

[sub_resource type="Gradient" id="Gradient_16ij7"]
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

[resource]
albedo_texture = SubResource("NoiseTexture2D_m8iqd")
normal_texture = SubResource("NoiseTexture2D_gyhec")
`;

const ice = parseTresFile(ICE);
const runner = new WorkerJobRunner();

/** The file with the albedo's `generate_mipmaps` off, which changes no pixel of its base. */
function withoutMipmaps() {
  return parseTresFile(
    ICE.replace(
      'seamless = true\n\n[sub_resource type="FastNoiseLite" id="FastNoiseLite_5tmlw"]',
      'seamless = true\ngenerate_mipmaps = false\n\n[sub_resource type="FastNoiseLite" id="FastNoiseLite_5tmlw"]'
    )
  );
}

const ALBEDO = 'SubResource("NoiseTexture2D_m8iqd")';
const NORMAL = 'SubResource("NoiseTexture2D_gyhec")';

/** Builds the texture `ref` names, and its cache key. */
async function built(ref: string, resources: readonly TscnInternalResource[] = ice.subResources) {
  const lookup = resolveNoiseTexture2D(ref, resources);
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

describe('resolveNoiseTexture2D — the ice.tres shape', () => {
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
    expect(resolveNoiseTexture2D(ALBEDO, ice.subResources)).toEqual({ status: 'ready', texture, key });
  });

  it('reuses the texture after a re-parse of an unchanged file', async () => {
    const { texture } = await built(ALBEDO);
    const reparsed = resolveNoiseTexture2D(ALBEDO, parseTresFile(ICE).subResources);
    expect(reparsed?.status === 'ready' && reparsed.texture).toBe(texture);
  });

  it('carries the chain of its size', async () => {
    const { texture } = await built(ALBEDO);
    expect(texture.mipmaps).toHaveLength(6);
  });

  it('carries no chain with generate_mipmaps off', async () => {
    const { texture } = await built(ALBEDO, withoutMipmaps().subResources);
    expect(texture.mipmaps).toHaveLength(0);
  });

  it('keys the texture without a chain apart from the one the job builds', () => {
    const chained = resolveNoiseTexture2D(ALBEDO, ice.subResources);
    const unchained = resolveNoiseTexture2D(ALBEDO, withoutMipmaps().subResources);
    expect(unchained?.key).toBe(`${chained?.key}:without-mipmaps`);
  });

  it('drops the chain without sampling again when generate_mipmaps goes off', async () => {
    const { texture } = await built(ALBEDO);
    const run = vi.fn(runner.run.bind(runner)) as JobRunner['run'];
    const lookup = resolveNoiseTexture2D(ALBEDO, withoutMipmaps().subResources);
    if (lookup?.status !== 'pending') throw new Error(`expected a pending build, got ${lookup?.status}`);

    const unchained = await lookup.start({ run }).settled;

    expect(run).not.toHaveBeenCalled();
    expect([unchained?.mipmaps.length, (unchained as THREE.DataTexture).image.data]).toEqual([
      0,
      texture.image.data,
    ]);
  });

  it('is ready at once, with the chain, when generate_mipmaps goes on', async () => {
    const { texture } = await built(ALBEDO, withoutMipmaps().subResources);
    const lookup = resolveNoiseTexture2D(ALBEDO, ice.subResources);
    expect(lookup?.status === 'ready' && lookup.texture.mipmaps).toHaveLength(6);
    expect(lookup?.status === 'ready' && lookup.texture).not.toBe(texture);
  });

  it('builds again after an edit to its noise', () => {
    const edited = parseTresFile(
      ICE.replace(
        'frequency = 0.003\nfractal_type = 2\nfractal_lacunarity = 2.5',
        'frequency = 0.004\nfractal_type = 2\nfractal_lacunarity = 2.5'
      )
    );
    const before = resolveNoiseTexture2D(ALBEDO, ice.subResources);
    const after = resolveNoiseTexture2D(ALBEDO, edited.subResources);
    expect(after?.key).not.toBe(before?.key);
  });

  it('keys on content, not on the sub-resource id', () => {
    const renamed = parseTresFile(ICE.replaceAll('NoiseTexture2D_m8iqd', 'NoiseTexture2D_renamed'));
    expect(resolveNoiseTexture2D('SubResource("NoiseTexture2D_renamed")', renamed.subResources)?.key).toBe(
      resolveNoiseTexture2D(ALBEDO, ice.subResources)?.key
    );
  });

  it('declines every reference that is not an inline NoiseTexture2D', () => {
    expect(resolveNoiseTexture2D(undefined, ice.subResources)).toBeNull();
    expect(resolveNoiseTexture2D('ExtResource("1")', ice.subResources)).toBeNull();
    expect(resolveNoiseTexture2D('res://noise.png', ice.subResources)).toBeNull();
    // A Gradient sub-resource is not a texture, and the gradient slice declines it
    // too, so the dispatch falls through to the async path.
    expect(resolveNoiseTexture2D('SubResource("Gradient_16ij7")', ice.subResources)).toBeNull();
    expect(resolveNoiseTexture2D('SubResource("nope")', ice.subResources)).toBeNull();
  });

  it('declines a texture whose noise reference is missing or of another Noise type', () => {
    const broken = parseTresFile(`[gd_resource type="StandardMaterial3D" format=3]

[sub_resource type="NoiseTexture2D" id="no_noise"]
width = 8
height = 8

[sub_resource type="FastNoiseLite" id="n"]

[sub_resource type="NoiseTexture2D" id="dangling"]
noise = SubResource("missing")

[resource]
`);
    expect(resolveNoiseTexture2D('SubResource("no_noise")', broken.subResources)).toBeNull();
    expect(resolveNoiseTexture2D('SubResource("dangling")', broken.subResources)).toBeNull();
  });

  it("declines a texture wider than the previewer's texture ceiling, before any build", () => {
    const oversized = parseTresFile(`[gd_resource type="StandardMaterial3D" format=3]

[sub_resource type="FastNoiseLite" id="n"]

[sub_resource type="NoiseTexture2D" id="wide"]
width = 2000000000
height = 512
noise = SubResource("n")

[resource]
albedo_texture = SubResource("wide")
`);
    expect(resolveNoiseTexture2D('SubResource("wide")', oversized.subResources)).toBeNull();
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
