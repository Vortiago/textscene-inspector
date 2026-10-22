/**
 * NoiseTexture3D texels against Godot 4.6.3: each expected byte is measured with
 * `godot --headless --script` calling `get_image_3d` and `get_seamless_image_3d` on a default
 * FastNoiseLite, one slice after another, each slice's rows from the top.
 */
import { describe, expect, it } from 'vitest';
import { decodeFastNoiseLite } from '../../noise/fastnoiselite/decode';
import { type Gradient } from '../gradienttexture2d/types';
import { decodeNoiseTexture3D } from './decode';
import { noiseTexture3DTexels, type NoiseTexture3DInput } from './texels';
import { GradientInterpolationMode } from '../../../godot/scene/gradientTexture';

function input(properties: Record<string, string>, colorRamp: Gradient | null = null): NoiseTexture3DInput {
  return { tex: decodeNoiseTexture3D(properties), noise: decodeFastNoiseLite({}), colorRamp };
}

const SIZE = { width: '4', height: '3', depth: '5' };

describe('noiseTexture3DTexels', () => {
  it('normalises the field over the whole volume, as get_image_3d does', () => {
    expect(Array.from(noiseTexture3DTexels(input(SIZE)))).toEqual([
      29, 58, 80, 100, 21, 48, 70, 87, 0, 27, 52, 77, 75, 105, 130, 152, 64, 94, 120, 139, 40, 70, 97, 123,
      112, 144, 176, 203, 96, 130, 161, 186, 67, 102, 132, 160, 132, 166, 206, 239, 113, 150, 186, 218, 80,
      119, 154, 185, 136, 171, 216, 255, 117, 154, 195, 231, 82, 124, 163, 198,
    ]);
  });

  it('blends the seams across x, y and depth, as get_seamless_image_3d does', () => {
    const texels = noiseTexture3DTexels(input({ ...SIZE, seamless: 'true', seamless_blend_skirt: '0.5' }));
    expect(Array.from(texels)).toEqual([
      135, 152, 169, 152, 114, 134, 155, 138, 145, 164, 179, 160, 152, 174, 192, 170, 130, 151, 174, 153, 166,
      189, 204, 179, 158, 187, 210, 181, 139, 165, 191, 164, 171, 201, 223, 191, 130, 154, 177, 154, 114, 139,
      165, 140, 139, 165, 188, 163, 158, 184, 204, 178, 136, 160, 183, 160, 173, 200, 217, 187,
    ]);
  });

  it('keeps the source slice and its skirt for a seamless texture one slice deep (edge case)', () => {
    // Godot blends no depth seam at depth 1 and returns both source slices (noise.h:217-247).
    const texels = noiseTexture3DTexels(input({ width: '6', height: '4', depth: '1', seamless: 'true' }));
    expect(texels.length).toBe(6 * 4 * 2);
  });

  it('inverts each texel', () => {
    const plain = noiseTexture3DTexels(input(SIZE));
    const inverted = noiseTexture3DTexels(input({ ...SIZE, invert: 'true' }));
    expect(inverted[0]).toBe(255 - plain[0]!);
  });

  it('keeps the red channel of the colour ramp, which the fog density reads', () => {
    // Measured through Godot's own `Gradient.sample` and RGBA8 `set_pixel`: gray 87 ramps to 86.
    const ramp: Gradient = {
      stops: [
        { offset: 0, color: { r: 0, g: 1, b: 1, a: 1 } },
        { offset: 1, color: { r: 1, g: 0, b: 0, a: 1 } },
      ],
      interpolationMode: GradientInterpolationMode.LINEAR,
    };
    const texels = noiseTexture3DTexels(input(SIZE, ramp));
    expect(Array.from(texels.subarray(0, 12))).toEqual([29, 58, 80, 100, 21, 48, 70, 86, 0, 27, 52, 77]);
  });
});
