import { describe, expect, it } from 'vitest';
import { downsampleTaps, layerSamples, skyOctmapLayout } from './skyReflection';

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

describe('downsampleTaps', () => {
  it('blends four taps whose weights sum to 1', () => {
    const taps = downsampleTaps(3, 5, 20, 0.1);
    expect(taps).toHaveLength(4);
    expect(taps.reduce((sum, tap) => sum + tap.weight, 0)).toBeCloseTo(1, 10);
  });

  it('places the taps 0.75 of a source texel either side of the texel centre', () => {
    const [first, , , last] = downsampleTaps(0, 0, 10, 0.1);
    expect(first!.u).toBeCloseTo((0.5 - 0.375) / 10, 10);
    expect(last!.v).toBeCloseTo((0.5 + 0.375) / 10, 10);
  });

  it('weighs the tap nearest the equator most, as its texel covers the most of the sphere', () => {
    const [nearCentre, , , farFromCentre] = downsampleTaps(5, 5, 10, 0.1).map((tap) => tap.weight);
    expect(farFromCentre!).toBeGreaterThan(nearCentre!);
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
