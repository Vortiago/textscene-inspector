import { describe, expect, it } from 'vitest';
import { FAST_FILTER_COEFFICIENTS } from '../../godot/rendering/environment/skyFastFilterCoefficients';
import { FAST_FILTER_CHAIN_SIZES } from '../../godot/rendering/environment/skyReflection';
import { fastFilterIntoLayers, fastFilterIntoMips } from './fastFilter';
import { testRenderer } from '../../testing/recordingWebGL';

const tapWeights = (layer: number) => fastFilterIntoLayers.layerUniforms(layer).weight as Float32Array;

describe('fastFilterIntoLayers', () => {
  it("reads Godot's 160-wide chain", () => {
    expect(fastFilterIntoLayers.chainSizes).toBe(FAST_FILTER_CHAIN_SIZES);
  });

  it("gives layer n the table's level n - 1, flattened as the shader reads it", () => {
    expect(Array.from(tapWeights(2))).toEqual(
      Array.from(Float32Array.from(FAST_FILTER_COEFFICIENTS[1]!.weight.flat()))
    );
  });

  it("gives layer n Godot's mip level n - 1", () => {
    expect(fastFilterIntoLayers.layerUniforms(3).mipLevel).toBe(2);
  });

  it('refuses layer 7, which a real-time sky lacks (error case)', () => {
    expect(() => fastFilterIntoLayers.layerUniforms(7)).toThrow('expected a layer from 1 to 6, got 7');
  });

  it('refuses layer 0, which is the radiance itself (error case)', () => {
    expect(() => fastFilterIntoLayers.layerUniforms(0)).toThrow('expected a layer from 1 to 6, got 0');
  });

  it("filters a 2 by 2 block of texels as one, as Godot's texture array path does", async () => {
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

describe('fastFilterIntoMips', () => {
  it('filters each texel of a mip on its own, with the lod offset of the path without arrays', async () => {
    const { renderer } = await testRenderer();

    expect(fastFilterIntoMips.passFor(renderer).fragmentShader).not.toContain('#define USE_TEXTURE_ARRAY');
  });

  it('draws with a pass of its own, beside the texture array one', async () => {
    const { renderer } = await testRenderer();

    expect(fastFilterIntoMips.passFor(renderer)).not.toBe(fastFilterIntoLayers.passFor(renderer));
  });

  it("gives layer n the same taps and mip level as Godot's texture array path", () => {
    expect(fastFilterIntoMips.layerUniforms(4)).toEqual(fastFilterIntoLayers.layerUniforms(4));
  });
});
