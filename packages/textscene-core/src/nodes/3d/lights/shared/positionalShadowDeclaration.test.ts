import { describe, expect, it } from 'vitest';
import { positionalShadowDeclaration } from './positionalShadowDeclaration';

describe('positionalShadowDeclaration', () => {
  it('declares the authored normal bias, and the blur as the kernel of a light without a size', () => {
    // `soft_shadow_scale` is `shadow_blur` times the Soft Low radius of 2.
    expect(positionalShadowDeclaration({ shadow_normal_bias: 2.5, shadow_blur: 0.5 })).toEqual({
      normalBias: 2.5,
      softShadowRadius: 1,
    });
  });

  it('declares the penumbra of a light with a size and a blur, scaled by the blur alone', () => {
    expect(positionalShadowDeclaration({ light_size: 0.5, shadow_blur: 2 }).softShadowRadius).toBe(-1);
  });

  it('filters a light with a size but no blur (edge case)', () => {
    expect(positionalShadowDeclaration({ light_size: 0.5, shadow_blur: 0 }).softShadowRadius).toBe(0);
  });

  it('takes Godot’s class defaults for the properties the scene leaves out (edge case)', () => {
    // `light_3d.cpp:491` and `:489` set both to 1, and `:478` the size to 0.
    expect(positionalShadowDeclaration({})).toEqual({ normalBias: 1, softShadowRadius: 2 });
  });

  it('keeps a zero normal bias rather than the default (edge case)', () => {
    expect(positionalShadowDeclaration({ shadow_normal_bias: 0 }).normalBias).toBe(0);
  });

  it('passes a non-finite blur through (error case)', () => {
    expect(positionalShadowDeclaration({ shadow_blur: Number.NaN }).softShadowRadius).toBeNaN();
  });
});
