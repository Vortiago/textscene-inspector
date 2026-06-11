/**
 * Cell-placement math — Godot's map_to_local: grid coords → the CENTER of the
 * cell in local pixels (Godot 2D space, +Y down).
 */
import { describe, it, expect } from 'vitest';
import { mapToLocalPx } from './tilePlacement';
import { TILE_SHAPE_SQUARE } from './tileSetModel';

const squareGrid = {
  shape: TILE_SHAPE_SQUARE,
  layout: 0 as const,
  offsetAxis: 0 as const,
  tileSize: { x: 16, y: 16 },
};

describe('mapToLocalPx — square', () => {
  it('returns the cell center: (cell + 0.5) × tileSize', () => {
    expect(mapToLocalPx(squareGrid, { x: 2, y: 3 })).toEqual({ x: 40, y: 56 });
  });
});
