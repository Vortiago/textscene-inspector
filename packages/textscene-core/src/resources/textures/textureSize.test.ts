/** The size a sized canvas consumer lays out by. */
import { describe, expect, it } from 'vitest';
import { sizeWithArea } from './textureSize';

describe('sizeWithArea', () => {
  it('is the size as a Vector2', () => {
    expect(sizeWithArea({ width: 24, height: 12 })).toEqual({ x: 24, y: 12 });
  });

  /** An icon of width 0 draws nothing (`button.cpp:369`). */
  it('is null for a size of no area, as an unset ViewportTexture reports', () => {
    expect(sizeWithArea({ width: 0, height: 0 })).toBeNull();
  });

  it('is null for no size', () => {
    expect(sizeWithArea(undefined)).toBeNull();
  });
});
