/**
 * NoiseTexture3D decode: Godot's defaults, the setters' refusals, and the refs kept raw for the
 * resolver to look up in the owning file's table.
 */
import { describe, expect, it } from 'vitest';
import { decodeNoiseTexture3D } from './decode';

describe('decodeNoiseTexture3D', () => {
  it("applies Godot's defaults to an empty resource", () => {
    expect(decodeNoiseTexture3D({})).toEqual({
      width: 64,
      height: 64,
      depth: 64,
      invert: false,
      normalize: true,
      seamless: false,
      seamlessBlendSkirt: 0.1,
      noise: null,
      colorRamp: null,
    });
  });

  it('reads an authored texture and keeps its refs raw', () => {
    expect(
      decodeNoiseTexture3D({
        width: '32',
        height: '16',
        depth: '8',
        invert: 'true',
        seamless: 'true',
        seamless_blend_skirt: '0.5',
        noise: 'SubResource("FastNoiseLite_a")',
        color_ramp: 'SubResource("Gradient_b")',
      })
    ).toMatchObject({
      width: 32,
      height: 16,
      depth: 8,
      invert: true,
      seamless: true,
      seamlessBlendSkirt: 0.5,
      noise: 'SubResource("FastNoiseLite_a")',
      colorRamp: 'SubResource("Gradient_b")',
    });
  });

  it('keeps the default depth for a depth the setter refuses (edge case)', () => {
    expect(decodeNoiseTexture3D({ depth: '0' }).depth).toBe(64);
  });

  it('keeps the default skirt for one under the 0.05 the setter accepts (edge case)', () => {
    expect(decodeNoiseTexture3D({ seamless_blend_skirt: '0.01' }).seamlessBlendSkirt).toBe(0.1);
  });
});
