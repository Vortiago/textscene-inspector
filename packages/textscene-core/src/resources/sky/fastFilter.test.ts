import { describe, expect, it } from 'vitest';
import { FAST_FILTER_COEFFICIENTS } from '../../godot/rendering/environment/skyFastFilterCoefficients';
import { FAST_FILTER_CHAIN_SIZES } from '../../godot/rendering/environment/skyReflection';
import { fastFilter } from './fastFilter';
import { testRenderer } from '../../testing/recordingWebGL';

const tapWeights = (layer: number) => fastFilter.layerUniforms(layer).weight as Float32Array;

describe('fastFilter', () => {
  it("reads Godot's 160-wide chain", () => {
    expect(fastFilter.chainSizes).toBe(FAST_FILTER_CHAIN_SIZES);
  });

  it("gives layer n the table's level n - 1, flattened as the shader reads it", () => {
    expect(Array.from(tapWeights(2))).toEqual(
      Array.from(Float32Array.from(FAST_FILTER_COEFFICIENTS[1]!.weight.flat()))
    );
  });

  it('refuses layer 7, which a real-time sky lacks (error case)', () => {
    expect(() => fastFilter.layerUniforms(7)).toThrow("expected a level of the fast filter's table, got 6");
  });

  it('refuses layer 0, which is the radiance itself (error case)', () => {
    expect(() => fastFilter.layerUniforms(0)).toThrow("expected a level of the fast filter's table, got -1");
  });

  it('draws every layer with one pass on a renderer', async () => {
    const { renderer } = await testRenderer();

    expect(fastFilter.passFor(renderer)).toBe(fastFilter.passFor(renderer));
  });

  it('gives each renderer a pass of its own (edge case)', async () => {
    const { renderer: first } = await testRenderer();
    const { renderer: second } = await testRenderer();

    expect(fastFilter.passFor(first)).not.toBe(fastFilter.passFor(second));
  });
});
