import { describe, it, expect } from 'vitest';
import { TILE_MAP_VISIBILITY_MODE_NAMES } from './tileMap.js';

describe('TileMap names', () => {
  it('names each visibility mode by its constant, for TileMap and TileMapLayer alike', () => {
    expect(TILE_MAP_VISIBILITY_MODE_NAMES).toEqual({ 0: 'DEFAULT', 1: 'FORCE_SHOW', 2: 'FORCE_HIDE' });
  });
});
