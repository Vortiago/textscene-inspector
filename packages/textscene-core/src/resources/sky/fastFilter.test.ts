import { describe, expect, it } from 'vitest';
import { FAST_FILTER_COEFFICIENTS } from '../../godot/rendering/environment/skyFastFilterCoefficients';
import { FAST_FILTER_CHAIN_SIZES } from '../../godot/rendering/environment/skyReflection';
import { fastFilter } from './fastFilter';

const tapWeights = () => fastFilter.pass.uniforms.weight!.value as Float32Array;

describe('fastFilter', () => {
  it("reads Godot's 160-wide chain", () => {
    expect(fastFilter.chainSizes).toBe(FAST_FILTER_CHAIN_SIZES);
  });

  it("gives layer n the table's level n - 1, flattened as the shader reads it", () => {
    fastFilter.selectLayer(2);

    expect(Array.from(tapWeights())).toEqual(
      Array.from(Float32Array.from(FAST_FILTER_COEFFICIENTS[1]!.weight.flat()))
    );
  });

  it('gives a layer past the last of a real-time sky the last level (edge case)', () => {
    fastFilter.selectLayer(6);
    const last = tapWeights();

    fastFilter.selectLayer(7);

    expect(tapWeights()).toBe(last);
  });

  it('refuses layer 0, which is the radiance itself (error case)', () => {
    expect(() => fastFilter.selectLayer(0)).toThrow("expected a level of the fast filter's table, got -1");
  });
});
