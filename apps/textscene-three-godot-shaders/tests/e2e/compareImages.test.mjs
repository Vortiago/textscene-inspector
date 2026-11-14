/** The image measurement of the end to end layer. */

import { describe, expect, it } from 'vitest';
import { compareImages } from './compareImages.mjs';

describe('compareImages', () => {
  it('counts a pixel over 2/255 and keeps the largest difference', () => {
    const godot = Uint8Array.from([10, 10, 10, 255, 10, 10, 10, 255]);
    const transpilation = Uint8Array.from([12, 10, 10, 255, 10, 17, 10, 255]);
    expect(compareImages(godot, transpilation)).toEqual({ pixels: 2, overTolerance: 1, maxSteps: 7 });
  });

  it('refuses images of different sizes', () => {
    expect(() => compareImages(new Uint8Array(4), new Uint8Array(8))).toThrow(/one size/);
  });
});
