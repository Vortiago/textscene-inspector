import { describe, expect, it } from 'vitest';
import { FAST_FILTER_COEFFICIENTS } from '../../godot/rendering/environment/skyFastFilterCoefficients';
import { FAST_FILTER_CHAIN_SIZES } from '../../godot/rendering/environment/skyReflection';
import { FAST_FILTERS } from './fastFilter';
import * as THREE from 'three';
import { FAST_FILTER_HIGH_QUALITY_COEFFICIENTS } from '../../godot/rendering/environment/skyFastFilterHighQualityCoefficients';
import { testRenderer } from '../../testing/recordingWebGL';

const { intoLayers: fastFilterIntoLayers, intoMips: fastFilterIntoMips } = FAST_FILTERS.low;
const highQuality = FAST_FILTERS.high;

const tapWeights = (layer: number) => fastFilterIntoLayers.layerUniforms(layer).weight as Float32Array;

describe('the low-quality filter into layers', () => {
  it("reads Godot's 160-wide chain", () => {
    expect(fastFilterIntoLayers.chainSizes).toBe(FAST_FILTER_CHAIN_SIZES);
  });

  it("gives layer n the table's level n - 1, flattened as the shader reads it", () => {
    expect(Array.from(tapWeights(2))).toEqual(
      Array.from(Float32Array.from(FAST_FILTER_COEFFICIENTS[1]!.weight.flat()))
    );
  });

  it('refuses layer 7, which a real-time sky lacks (error case)', () => {
    expect(() => fastFilterIntoLayers.layerUniforms(7)).toThrow('expected a layer from 1 to 6, got 7');
  });

  it('refuses layer 0, which is the radiance itself (error case)', () => {
    expect(() => fastFilterIntoLayers.layerUniforms(0)).toThrow('expected a layer from 1 to 6, got 0');
  });

  it("compiles Godot's texture array path, which filters a 2 by 2 block of texels as one", async () => {
    const { renderer } = await testRenderer();

    expect(fastFilterIntoLayers.passFor(renderer).fragmentShader).toContain('#define USE_TEXTURE_ARRAY');
  });

  it('draws every layer with one pass on a renderer', async () => {
    const { renderer } = await testRenderer();

    expect(fastFilterIntoLayers.passFor(renderer)).toBe(fastFilterIntoLayers.passFor(renderer));
  });

  it('gives each renderer a pass of its own (edge case)', async () => {
    const { renderer: first } = await testRenderer();
    const { renderer: second } = await testRenderer();

    expect(fastFilterIntoLayers.passFor(first)).not.toBe(fastFilterIntoLayers.passFor(second));
  });
});

describe('the low-quality filter into mips', () => {
  it('compiles the path without arrays, which filters each texel of a mip with a lod offset', async () => {
    const { renderer } = await testRenderer();

    expect(fastFilterIntoMips.passFor(renderer).fragmentShader).not.toContain('#define USE_TEXTURE_ARRAY');
  });

  it('draws with a pass of its own, beside the texture array one', async () => {
    const { renderer } = await testRenderer();

    expect(fastFilterIntoMips.passFor(renderer)).not.toBe(fastFilterIntoLayers.passFor(renderer));
  });

  it("gives layer n Godot's mip level n - 1 for the lod step", () => {
    expect(fastFilterIntoMips.layerUniforms(3).mipLevel).toBe(2);
  });

  it("gives layer n the same taps as Godot's texture array path", () => {
    expect(fastFilterIntoMips.layerUniforms(4).weight).toBe(fastFilterIntoLayers.layerUniforms(4).weight);
  });
});

describe('the high-quality filter', () => {
  it("compiles Godot's polynomial taps into layers, on the texture array path", async () => {
    const { renderer } = await testRenderer();
    const shader = highQuality.intoLayers.passFor(renderer).fragmentShader;

    expect(shader).toContain('#define USE_HIGH_QUALITY');
    expect(shader).toContain('#define USE_TEXTURE_ARRAY');
  });

  it("compiles Godot's polynomial taps into mips, without arrays", async () => {
    const { renderer } = await testRenderer();
    const shader = highQuality.intoMips.passFor(renderer).fragmentShader;

    expect(shader).toContain('#define USE_HIGH_QUALITY');
    expect(shader).not.toContain('#define USE_TEXTURE_ARRAY');
  });

  it('draws with passes apart from the low-quality ones', async () => {
    const { renderer } = await testRenderer();

    expect(highQuality.intoLayers.passFor(renderer)).not.toBe(fastFilterIntoLayers.passFor(renderer));
  });

  it("reads Godot's 160-wide chain", () => {
    expect(highQuality.intoLayers.chainSizes).toBe(FAST_FILTER_CHAIN_SIZES);
  });

  it("gives layer n Godot's level n - 1, which picks the table's rows", () => {
    expect(highQuality.intoLayers.layerUniforms(5).mipLevel).toBe(4);
  });

  it('holds the table as a texture of 8 super-taps a frame, 3 frames a row', () => {
    const table = highQuality.intoLayers.layerUniforms(1).coefficients as THREE.DataTexture;

    expect([table.image.width, table.image.height]).toEqual([24, 90]);
  });

  it("writes the table's numbers in Godot's order", () => {
    const table = highQuality.intoLayers.layerUniforms(1).coefficients as THREE.DataTexture;

    expect(Array.from(table.image.data as Float32Array)).toEqual(
      Array.from(Float32Array.from(FAST_FILTER_HIGH_QUALITY_COEFFICIENTS))
    );
  });

  it('shares one table between every layer', () => {
    expect(highQuality.intoMips.layerUniforms(2).coefficients).toBe(
      highQuality.intoLayers.layerUniforms(6).coefficients
    );
  });

  it('refuses layer 7, which a real-time sky lacks (error case)', () => {
    expect(() => highQuality.intoMips.layerUniforms(7)).toThrow('expected a layer from 1 to 6, got 7');
  });
});
