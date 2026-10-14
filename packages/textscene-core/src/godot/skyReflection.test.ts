import { describe, expect, it } from 'vitest';
import { MOST_LAYER_SAMPLES, layerSamples, skyOctmapLayout } from './skyReflection';

describe('skyOctmapLayout', () => {
  it('pads the default 256 sky to 640 texels with 64 on each side', () => {
    const layout = skyOctmapLayout(256);
    expect(layout.size).toBe(640);
    expect(layout.padding).toBeCloseTo(0.1, 10);
    expect(layout.downsampledSizes).toEqual([320, 160, 80, 40, 20, 10]);
  });

  it('ends the downsampled chain at 10 texels at the smallest radiance size (edge case)', () => {
    expect(skyOctmapLayout(32).downsampledSizes).toEqual([40, 20, 10]);
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
});

describe('MOST_LAYER_SAMPLES', () => {
  it("is the roughest layer's sample count, which no layer's survivors exceed", () => {
    expect(MOST_LAYER_SAMPLES).toBe(128);
    for (let layer = 1; layer <= 7; layer += 1) {
      expect(layerSamples(skyOctmapLayout(256), layer).length).toBeLessThanOrEqual(MOST_LAYER_SAMPLES);
    }
  });
});
