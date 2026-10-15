import { describe, expect, it } from 'vitest';
import { reflectionAtlasLayout } from '../../godot/rendering/environment/reflectionProbe';
import { layerSamples, skyOctmapLayout } from '../../godot/rendering/environment/skyReflection';
import { importanceSampleFilter } from './importanceSampleFilter';

describe('importanceSampleFilter', () => {
  it("reads the chain of the sky's radiance size", () => {
    expect(importanceSampleFilter(skyOctmapLayout(64)).chainSizes).toEqual(
      skyOctmapLayout(64).downsampledSizes
    );
  });

  it("packs the layer's samples as the shader reads them: each direction, then its mip", () => {
    const filter = importanceSampleFilter(skyOctmapLayout(256));
    const [first] = layerSamples(skyOctmapLayout(256), 3);

    const { samples, sampleCount } = filter.layerUniforms(3);

    expect(sampleCount).toBe(layerSamples(skyOctmapLayout(256), 3).length);
    expect(Array.from((samples as Float32Array).slice(0, 4))).toEqual(
      Array.from(Float32Array.from([...first!.direction, first!.lod]))
    );
  });

  it('refuses a layer past the last (error case)', () => {
    expect(() => importanceSampleFilter(skyOctmapLayout(256)).layerUniforms(8)).toThrow(
      'expected a layer from 0 to 7, got 8'
    );
  });

  it("refuses a layer past a seven-layer atlas's last (error case)", () => {
    expect(() => importanceSampleFilter(reflectionAtlasLayout(true)).layerUniforms(7)).toThrow(
      'expected a layer from 0 to 6, got 7'
    );
  });

  it("reads the chain of a reflection atlas's layout", () => {
    expect(importanceSampleFilter(reflectionAtlasLayout(false)).chainSizes).toEqual([
      384, 192, 96, 48, 24, 12, 6,
    ]);
  });

  it('makes one filter per layout, and reuses it (edge case)', () => {
    expect(importanceSampleFilter(reflectionAtlasLayout(false))).toBe(
      importanceSampleFilter(reflectionAtlasLayout(false))
    );
  });

  it('makes one filter per radiance size, and reuses it (edge case)', () => {
    expect(importanceSampleFilter(skyOctmapLayout(128))).toBe(importanceSampleFilter(skyOctmapLayout(128)));
    expect(importanceSampleFilter(skyOctmapLayout(128))).not.toBe(
      importanceSampleFilter(skyOctmapLayout(32))
    );
  });

  it("reads a smaller sky's samples from sharper mips, as its texels cover more of the sphere", () => {
    const lodOf = (radianceSize: number) => {
      const { samples } = importanceSampleFilter(skyOctmapLayout(radianceSize)).layerUniforms(3);
      return (samples as Float32Array)[3]!;
    };

    expect(lodOf(32)).toBeLessThan(lodOf(256));
  });
});
