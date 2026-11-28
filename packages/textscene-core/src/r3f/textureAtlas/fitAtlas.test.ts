import { describe, expect, it } from 'vitest';
import { packDecalAtlas } from '../../nodes/3d/decal/decalAtlasLayout';
import { buildAreaLightAtlas } from '../areaLight/atlasLayout';

const sizes = [
  [1, 5],
  [3, 3],
  [3, 3],
  [3, 1],
  [1, 5],
  [3, 4],
  [4, 2],
  [3, 3],
] as const;

describe.each([
  { name: 'decal', pack: packDecalAtlas, border: 32 },
  { name: 'area light', pack: buildAreaLightAtlas, border: 128 },
])('fitting the $name atlas', ({ pack, border }) => {
  it('keeps five textures when the first four need a taller skyline', () => {
    const images = sizes.map(([x, y]) => ({ width: x * border, height: y * border }));
    const limit = 8 * border;
    expect(pack(images.slice(0, 4)).height).toBe(2 * limit);
    expect(pack(images.slice(0, 5)).height).toBe(limit);

    expect(pack(images, limit).rects).toHaveLength(5);
  });
});
