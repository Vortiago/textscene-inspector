import { describe, expect, it } from 'vitest';
import { reflectionAtlasLayout } from '../../godot/rendering/environment/reflectionProbe';
import { layerSamples, skyOctmapLayout } from '../../godot/rendering/environment/skyReflection';
import { importanceSampleFilter } from './importanceSampleFilter';
import { testRenderer } from '../../testing/recordingWebGL';

describe('importanceSampleFilter', () => {
  it("reads the chain of the sky's radiance size", () => {
    expect(importanceSampleFilter(skyOctmapLayout(64, 8)).chainSizes).toEqual(
      skyOctmapLayout(64, 8).downsampledSizes
    );
  });

  it("packs the layer's samples as the shader reads them: each direction, then its mip", () => {
    const filter = importanceSampleFilter(skyOctmapLayout(256, 8));
    const [first] = layerSamples(skyOctmapLayout(256, 8), 3);

    const { samples, sampleCount } = filter.layerUniforms(3);

    expect(sampleCount).toBe(layerSamples(skyOctmapLayout(256, 8), 3).length);
    expect(Array.from((samples as Float32Array).slice(0, 4))).toEqual(
      Array.from(Float32Array.from([...first!.direction, first!.lod]))
    );
  });

  it('refuses a layer past the last (error case)', () => {
    expect(() => importanceSampleFilter(skyOctmapLayout(256, 8)).layerUniforms(8)).toThrow(
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
    expect(importanceSampleFilter(skyOctmapLayout(128, 8))).toBe(
      importanceSampleFilter(skyOctmapLayout(128, 8))
    );
    expect(importanceSampleFilter(skyOctmapLayout(128, 8))).not.toBe(
      importanceSampleFilter(skyOctmapLayout(32, 8))
    );
  });

  it("reads a smaller sky's samples from sharper mips, as its texels cover more of the sphere", () => {
    const lodOf = (radianceSize: number) => {
      const { samples } = importanceSampleFilter(skyOctmapLayout(radianceSize, 8)).layerUniforms(3);
      return (samples as Float32Array)[3]!;
    };

    expect(lodOf(32)).toBeLessThan(lodOf(256));
  });

  it("draws every layout's layers with one pass on a renderer", async () => {
    const { renderer } = await testRenderer();

    expect(importanceSampleFilter(skyOctmapLayout(64, 8)).passFor(renderer)).toBe(
      importanceSampleFilter(reflectionAtlasLayout(true)).passFor(renderer)
    );
  });

  it('gives each renderer a pass of its own (edge case)', async () => {
    const { renderer: first } = await testRenderer();
    const { renderer: second } = await testRenderer();
    const filter = importanceSampleFilter(skyOctmapLayout(64, 8));

    expect(filter.passFor(first)).not.toBe(filter.passFor(second));
  });
});
