import { describe, expect, it } from 'vitest';
import { positionalShadowDeclaration } from './positionalShadowDeclaration';

describe('positionalShadowDeclaration', () => {
  it('declares the authored normal bias and blur', () => {
    // `soft_shadow_scale` is `shadow_blur` times the Soft Low radius of 2.
    expect(positionalShadowDeclaration({ shadow_normal_bias: 2.5, shadow_blur: 0.5 })).toEqual({
      normalBias: 2.5,
      softShadowScale: 1,
    });
  });

  it('takes Godot’s class defaults for the properties the scene leaves out (edge case)', () => {
    // `light_3d.cpp:491` and `:489` set both to 1.
    expect(positionalShadowDeclaration({})).toEqual({ normalBias: 1, softShadowScale: 2 });
  });

  it('keeps a zero normal bias rather than the default (edge case)', () => {
    expect(positionalShadowDeclaration({ shadow_normal_bias: 0 }).normalBias).toBe(0);
  });

  it('passes a non-finite blur through (error case)', () => {
    expect(positionalShadowDeclaration({ shadow_blur: Number.NaN }).softShadowScale).toBeNaN();
  });
});
