import { describe, expect, it } from 'vitest';
import { reflectionAtlasLayout } from './reflectionProbe';
import {
  MOST_LAYER_SAMPLES,
  halvingSizes,
  layerSamples,
  paddedOctmap,
  skyOctmapLayout,
} from './skyReflection';

describe('skyOctmapLayout', () => {
  it('pads the default 256 sky to 640 texels with 64 on each side', () => {
    const layout = skyOctmapLayout(256);
    expect(layout.size).toBe(640);
    expect(layout.borderSize).toBeCloseTo(0.8, 10);
    expect(layout.downsampledSizes).toEqual([320, 160, 80, 40, 20, 10]);
  });

  it('gives each of the eight layers the full width, as each is a layer of an array', () => {
    expect(skyOctmapLayout(256).layerSizes).toEqual([640, 640, 640, 640, 640, 640, 640, 640]);
  });

  it('ends the downsampled chain at 10 texels at the smallest radiance size (edge case)', () => {
    expect(skyOctmapLayout(32).downsampledSizes).toEqual([40, 20, 10]);
  });
});

describe('paddedOctmap', () => {
  it('doubles the capture and pads it on each side', () => {
    expect(paddedOctmap(256, 64)).toEqual({ size: 640, borderSize: 0.8 });
  });

  it('fills the whole octmap with no padding (edge case)', () => {
    expect(paddedOctmap(16, 0)).toEqual({ size: 32, borderSize: 1 });
  });
});

describe('halvingSizes', () => {
  it('halves each width from the first', () => {
    expect(halvingSizes(640, 4)).toEqual([640, 320, 160, 80]);
  });

  it('stops at one texel (edge case)', () => {
    expect(halvingSizes(4, 5)).toEqual([4, 2, 1, 1, 1]);
  });

  it('gives no width for no mips (edge case)', () => {
    expect(halvingSizes(640, 0)).toEqual([]);
  });
});

describe('layerSamples', () => {
  const samples = layerSamples(skyOctmapLayout(256), 7);

  it('keeps the half of its 128 samples that falls above the horizon, in float32 as the GPU', () => {
    expect(samples).toHaveLength(64);
    samples.forEach(({ direction: [, , z] }) => expect(z).toBeGreaterThan(0));
  });

  it('gives each sample a unit direction', () => {
    samples.forEach(({ direction }) => expect(Math.hypot(...direction)).toBeCloseTo(1, 6));
  });

  it('reads each sample at a mip past the last one, which the sampler clamps (edge case)', () => {
    samples.forEach(({ lod }) => expect(lod).toBeCloseTo(5.82, 2));
  });

  it('samples a smoother layer nearer its normal and from sharper mips, all above the horizon', () => {
    const smoother = layerSamples(skyOctmapLayout(256), 4);
    const mean = (layer: typeof samples, of: (sample: (typeof samples)[number]) => number) =>
      layer.reduce((sum, sample) => sum + of(sample), 0) / layer.length;
    const cosine = ({ direction: [, , z] }: (typeof samples)[number]) => z;
    const lod = (sample: (typeof samples)[number]) => sample.lod;

    expect(smoother).toHaveLength(64);
    expect(mean(smoother, cosine)).toBeGreaterThan(mean(samples, cosine));
    expect(mean(smoother, lod)).toBeLessThan(mean(samples, lod));
  });

  it('refuses a layer the layout does not have', () => {
    expect(() => layerSamples(skyOctmapLayout(256), 8)).toThrow('expected a layer from 0 to 7, got 8');
  });
});

describe('layerSamples in a reflection atlas', () => {
  const atlas = reflectionAtlasLayout(false);
  const lods = (layout: typeof atlas, layer: number) => layerSamples(layout, layer).map(({ lod }) => lod);

  it('reads a mip finer for each halving of the layer it fills, as each atlas layer is a mip', () => {
    const fullWidth = { ...atlas, layerSizes: atlas.layerSizes.map(() => atlas.size) };
    const finer = lods(fullWidth, 3).map((lod) => lod - 3);
    lods(atlas, 3).forEach((lod, sample) => expect(lod).toBeCloseTo(finer[sample]!, 9));
  });

  it("filters the seven-layer atlas's last layer at roughness 1, as the roughest sky layer", () => {
    expect(layerSamples(reflectionAtlasLayout(true), 6)).toHaveLength(
      layerSamples(skyOctmapLayout(256), 7).length
    );
  });
});

describe('MOST_LAYER_SAMPLES', () => {
  it("is the roughest layer's sample count, which no layer's survivors exceed", () => {
    expect(MOST_LAYER_SAMPLES).toBe(128);
    for (let layer = 1; layer <= 7; layer += 1) {
      expect(layerSamples(skyOctmapLayout(256), layer).length).toBeLessThanOrEqual(MOST_LAYER_SAMPLES);
    }
  });
});
