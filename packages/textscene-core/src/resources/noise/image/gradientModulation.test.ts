/**
 * A grayscale noise field through a NoiseTexture's `color_ramp`, as Godot 4.6.3's
 * `_modulate_with_gradient` writes it (noise_texture_2d.cpp:183-198, noise_texture_3d.cpp:175-189).
 */
import { describe, expect, it } from 'vitest';
import { type Gradient } from '../../textures/gradienttexture2d/types';
import { modulateRedWithGradient, modulateWithGradient } from './gradientModulation';
import { GradientInterpolationMode } from '../../../godot/scene/gradientTexture';

/** Black to opaque red. */
const RAMP: Gradient = {
  stops: [
    { offset: 0, color: { r: 0, g: 0, b: 0, a: 1 } },
    { offset: 1, color: { r: 1, g: 0, b: 0, a: 1 } },
  ],
  interpolationMode: GradientInterpolationMode.LINEAR,
};

/** Black to a half-transparent white, so every channel differs from red. */
const GREY_RAMP: Gradient = {
  stops: [
    { offset: 0, color: { r: 0, g: 0.2, b: 0.4, a: 1 } },
    { offset: 1, color: { r: 1, g: 1, b: 1, a: 0.5 } },
  ],
  interpolationMode: GradientInterpolationMode.LINEAR,
};

describe('modulateWithGradient', () => {
  it("maps each pixel's luminance through the ramp", () => {
    // A grayscale pixel's luminance is its own value, so 0 takes the ramp's first colour and 255
    // its last.
    const rgba = modulateWithGradient(new Uint8Array([0, 255]), RAMP);
    expect([...rgba.slice(0, 4)]).toEqual([0, 0, 0, 255]);
    expect([...rgba.slice(4, 8)]).toEqual([255, 0, 0, 255]);
  });

  it('reads the luminance in float and truncates each channel, as Godot measures', () => {
    // Godot 4.6.3 ramps gray 87 to red 86 and gray 206 to red 205 (`color.h:106-108`,
    // `image.cpp:3577-3580`). A rounded ramp keeps 87 and 206.
    const rgba = modulateWithGradient(new Uint8Array([87, 206, 239]), RAMP);
    expect([rgba[0], rgba[4], rgba[8]]).toEqual([86, 205, 239]);
  });

  it('writes nothing for an empty field (edge case)', () => {
    expect(modulateWithGradient(new Uint8Array(0), RAMP)).toHaveLength(0);
  });
});

describe('modulateRedWithGradient', () => {
  it('writes the red channel modulateWithGradient writes, one byte per pixel', () => {
    const gray = new Uint8Array([0, 40, 87, 206, 255]);
    const rgba = modulateWithGradient(gray, GREY_RAMP);
    expect([...modulateRedWithGradient(gray, GREY_RAMP)]).toEqual([...rgba].filter((_, i) => i % 4 === 0));
  });

  it('writes nothing for an empty field (edge case)', () => {
    expect(modulateRedWithGradient(new Uint8Array(0), RAMP)).toHaveLength(0);
  });
});
