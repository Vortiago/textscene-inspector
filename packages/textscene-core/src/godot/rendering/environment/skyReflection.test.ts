import { describe, expect, it } from 'vitest';
import { halvingSizes, paddedOctmap, skyOctmapLayout } from './skyReflection';

describe('skyOctmapLayout', () => {
  it.each([
    [32, 80, 4],
    [64, 160, 5],
    [128, 320, 6],
    [256, 640, 7],
  ])(
    "lays out a radiance of %i as Godot's array: %i texels wide, %i mips, 0.8 inside the border",
    (radianceSize, size, mips) => {
      const layout = skyOctmapLayout(radianceSize, 8);
      expect([layout.size, layout.downsampledSizes.length + 1, layout.borderSize]).toEqual([
        size,
        mips,
        expect.closeTo(0.8, 10),
      ]);
    }
  );

  it("halves each of a layer's other mips down to 10 texels", () => {
    expect(skyOctmapLayout(256, 8).downsampledSizes).toEqual([320, 160, 80, 40, 20, 10]);
  });

  it("counts a read's derivative mip in texels of the radiance size", () => {
    expect(skyOctmapLayout(128, 8).pixelSize).toBe(1 / 128);
  });

  it('gives a real-time sky its seven layers (edge case)', () => {
    expect(skyOctmapLayout(256, 7).layerSizes).toHaveLength(7);
  });

  it('gives each of the eight layers the full width, as each is a layer of an array', () => {
    expect(skyOctmapLayout(256, 8).layerSizes).toEqual([640, 640, 640, 640, 640, 640, 640, 640]);
  });

  it('ends the downsampled chain at 10 texels at the smallest radiance size (edge case)', () => {
    expect(skyOctmapLayout(32, 8).downsampledSizes).toEqual([40, 20, 10]);
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
