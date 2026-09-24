/**
 * The two texture ceilings agree. An image within the per-axis upload ceiling on both axes is
 * always one Godot can build, so a caller that checks the axes of an uploaded image needs no
 * separate pixel check for it.
 */
import { describe, expect, it } from 'vitest';
import { IMAGE_MAX_PIXELS, MAX_TEXTURE_EXTENT } from './texture';

describe('texture ceilings', () => {
  it('fits a texture at the ceiling on both axes exactly into Image::MAX_PIXELS', () => {
    expect(MAX_TEXTURE_EXTENT * MAX_TEXTURE_EXTENT).toBe(IMAGE_MAX_PIXELS);
  });

  it('refuses one pixel more than a full-size texture as an Image', () => {
    expect(MAX_TEXTURE_EXTENT * (MAX_TEXTURE_EXTENT + 1)).toBeGreaterThan(IMAGE_MAX_PIXELS);
  });
});
