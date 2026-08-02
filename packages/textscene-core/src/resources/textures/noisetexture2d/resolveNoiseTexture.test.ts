/**
 * Resolving a NoiseTexture2D from a real material's shape, end to end at the
 * resolver level: `scenes/demos/3d/procedural_materials/materials/ice.tres` —
 * an albedo texture (noise + colour ramp, seamless) and a normal texture
 * (`as_normal_map` over a second generator) in one file, each referencing
 * sub-resources of that file.
 *
 * Sizes are shrunk from the shipped 1024x1024: the pipeline under test is the
 * same at any size, and the real thing costs about a second per texture.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { parseTresFile } from '../../../parser/parsedResource';
import { clearProceduralTextureCache } from '../proceduralTextureCache';
import { resolveNoiseTexture2D, resolveNoiseTexture2DFromResource } from './resolveNoiseTexture';

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

afterEach(() => {
  clearProceduralTextureCache();
});

describe('resolveNoiseTexture2D — the ice.tres shape', () => {
  it('resolves the albedo slot to a rasterised, ramp-coloured texture', () => {
    const resolved = resolveNoiseTexture2D('SubResource("NoiseTexture2D_m8iqd")', ice.subResources)!;
    expect(resolved.texture).toBeInstanceOf(THREE.DataTexture);
    expect(resolved.texture.image.width).toBe(32);
    expect(resolved.texture.colorSpace).toBe(THREE.SRGBColorSpace);

    // The ramp runs pale blue → white, so every pixel is bluish-white: blue is
    // the strongest channel and nothing is near black.
    const data = resolved.texture.image.data as Uint8Array;
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i + 2]).toBeGreaterThanOrEqual(data[i]!);
      expect(data[i]).toBeGreaterThan(100);
    }
  });

  it('resolves the normal slot to a non-sRGB normal map', () => {
    const resolved = resolveNoiseTexture2D('SubResource("NoiseTexture2D_gyhec")', ice.subResources)!;
    expect(resolved.texture.colorSpace).toBe(THREE.NoColorSpace);

    const data = resolved.texture.image.data as Uint8Array;
    for (let i = 0; i < data.length; i += 4) {
      // Unit normals packed around the midpoint, +Z dominant for a height field.
      const [nx, ny, nz] = [data[i]!, data[i + 1]!, data[i + 2]!].map((v) => v / 127.5 - 1);
      expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 1);
      expect(nz).toBeGreaterThan(0);
    }
  });

  it('gives the two slots different pixels — each has its own generator', () => {
    const albedo = resolveNoiseTexture2D('SubResource("NoiseTexture2D_m8iqd")', ice.subResources)!;
    const normal = resolveNoiseTexture2D('SubResource("NoiseTexture2D_gyhec")', ice.subResources)!;
    expect(albedo.key).not.toBe(normal.key);
    expect([...(albedo.texture.image.data as Uint8Array)]).not.toEqual([
      ...(normal.texture.image.data as Uint8Array),
    ]);
  });

  it('rasterises once per sub-resource and hands the same texture back', () => {
    const first = resolveNoiseTexture2D('SubResource("NoiseTexture2D_m8iqd")', ice.subResources)!;
    const second = resolveNoiseTexture2D('SubResource("NoiseTexture2D_m8iqd")', ice.subResources)!;
    expect(second.texture).toBe(first.texture);
    expect(second.key).toBe(first.key);
  });

  it('declines every reference that is not an inline NoiseTexture2D', () => {
    expect(resolveNoiseTexture2D(undefined, ice.subResources)).toBeNull();
    expect(resolveNoiseTexture2D('ExtResource("1")', ice.subResources)).toBeNull();
    expect(resolveNoiseTexture2D('res://noise.png', ice.subResources)).toBeNull();
    // A Gradient sub-resource is not a texture; the gradient slice's own
    // resolver declines it too, so the dispatch falls through to the async path.
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
});

describe('resolveNoiseTexture2DFromResource — a standalone NoiseTexture2D.tres', () => {
  const standalone = parseTresFile(`[gd_resource type="NoiseTexture2D" format=3]

[sub_resource type="FastNoiseLite" id="FastNoiseLite_1"]
frequency = 0.02

[resource]
width = 16
height = 16
noise = SubResource("FastNoiseLite_1")
`);

  it('rasterises the [resource] body against the file\'s own table', () => {
    const resolved = resolveNoiseTexture2DFromResource(standalone)!;
    expect(resolved.texture.image.width).toBe(16);
    expect(resolved.key).toContain('[resource]');
  });

  it('declines a file of another type', () => {
    expect(resolveNoiseTexture2DFromResource(ice)).toBeNull();
  });
});
