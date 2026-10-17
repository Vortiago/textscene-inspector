import { describe, expect, it } from 'vitest';
import { COLLISION_POLYGON_2D_BUILD_MODE_NAMES } from './collisionPolygon2d.js';

describe('COLLISION_POLYGON_2D_BUILD_MODE_NAMES', () => {
  it('names both build modes with their BUILD_ prefix (collision_polygon_2d.h:41-44)', () => {
    expect(COLLISION_POLYGON_2D_BUILD_MODE_NAMES).toEqual({
      0: 'BUILD_SOLIDS',
      1: 'BUILD_SEGMENTS',
    });
  });
});
