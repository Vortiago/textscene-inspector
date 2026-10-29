import { describe, it, expect } from 'vitest';
import { multiplyModulate, WHITE_MODULATE } from './canvasItemModulate';

describe('multiplyModulate', () => {
  it('multiplies RGBA component-wise', () => {
    expect(multiplyModulate({ r: 1, g: 1, b: 1, a: 1 }, { r: 0, g: 1, b: 1, a: 1 })).toEqual({
      r: 0,
      g: 1,
      b: 1,
      a: 1,
    });
  });

  it('treats white as the identity', () => {
    const c = { r: 0.5, g: 0.2, b: 0.8, a: 0.5 };
    expect(multiplyModulate(WHITE_MODULATE, c)).toEqual(c);
  });

  it('keeps a 0.9 channel on the half step 229.5 that Godot writes as 230', () => {
    expect(multiplyModulate(WHITE_MODULATE, { r: 0.9, g: 0.9, b: 0.9, a: 1 }).r).toBe(0.9);
  });

  it('composes hierarchically (a parent dims its children)', () => {
    expect(multiplyModulate({ r: 0.5, g: 0.5, b: 0.5, a: 1 }, { r: 0.5, g: 0.5, b: 0.5, a: 1 })).toEqual({
      r: 0.25,
      g: 0.25,
      b: 0.25,
      a: 1,
    });
  });

  it('multiplies alpha (transparent parent → transparent child)', () => {
    expect(multiplyModulate({ r: 1, g: 1, b: 1, a: 0.5 }, { r: 1, g: 1, b: 1, a: 0.5 }).a).toBe(0.25);
  });
});
