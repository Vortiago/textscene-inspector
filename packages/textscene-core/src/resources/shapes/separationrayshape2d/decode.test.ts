/**
 * SeparationRayShape2D decode: the ray length. Its setter validates nothing
 * (`separation_ray_shape_2d.cpp:96`), so a zero or negative length is kept. Default 20 (`.h:38`).
 */

import { describe, expect, it } from 'vitest';
import { decodeSeparationRayShape2D } from './decode';

describe('decodeSeparationRayShape2D', () => {
  it('honours the length', () => {
    expect(decodeSeparationRayShape2D({ length: '45.5' })).toEqual({ length: 45.5 });
  });

  it('falls back to 20 when absent', () => {
    expect(decodeSeparationRayShape2D({})).toEqual({ length: 20 });
  });

  it('keeps a negative length as authored', () => {
    expect(decodeSeparationRayShape2D({ length: '-8' })).toEqual({ length: -8 });
  });
});
