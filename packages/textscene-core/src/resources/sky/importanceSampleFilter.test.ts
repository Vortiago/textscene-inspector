import { describe, expect, it } from 'vitest';
import { layerSamples, skyOctmapLayout } from '../../godot/skyReflection';
import { importanceSampleFilter } from './importanceSampleFilter';

describe('importanceSampleFilter', () => {
  it("reads the chain of the sky's radiance size", () => {
    expect(importanceSampleFilter(64).chainSizes).toEqual(skyOctmapLayout(64).downsampledSizes);
  });

  it("packs the layer's samples as the shader reads them: each direction, then its mip", () => {
    const filter = importanceSampleFilter(256);
    const [first] = layerSamples(skyOctmapLayout(256), 3);

    filter.selectLayer(3);

    const { samples, sampleCount } = filter.pass.uniforms;
    expect(sampleCount!.value).toBe(layerSamples(skyOctmapLayout(256), 3).length);
    expect(Array.from((samples!.value as Float32Array).slice(0, 4))).toEqual(
      Array.from(Float32Array.from([...first!.direction, first!.lod]))
    );
  });

  it('refuses a layer past the last (error case)', () => {
    expect(() => importanceSampleFilter(256).selectLayer(8)).toThrow('expected a layer from 0 to 7, got 8');
  });

  it('makes one filter per radiance size, and reuses it (edge case)', () => {
    expect(importanceSampleFilter(128)).toBe(importanceSampleFilter(128));
    expect(importanceSampleFilter(128)).not.toBe(importanceSampleFilter(32));
  });

  it("reads a smaller sky's samples from sharper mips, as its texels cover more of the sphere", () => {
    const lodOf = (radianceSize: number) => {
      const filter = importanceSampleFilter(radianceSize);
      filter.selectLayer(3);
      return (filter.pass.uniforms.samples!.value as Float32Array)[3]!;
    };

    expect(lodOf(32)).toBeLessThan(lodOf(256));
  });
});
