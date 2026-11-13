import { describe, expect, it } from 'vitest';
import { placeholderCircles } from './scenePlaceholder';
import { PLACEHOLDER_TEST_GRID as grid, placeholderColorOf } from './scenePlaceholder.testkit';
import type { SceneTileCell } from './sceneTileCells';

describe('placeholderColor', () => {
  // Printed by Godot 4.6.3 from `[source_id, alternative_tile].hash()` through RandomNumberGenerator
  // (which wraps RandomPCG) and `Color.from_hsv(..., 0.8)`: the bytes of the first word are the HSV.
  it.each([
    [0, 1, { r: 0.42940139770508, g: 0.57966333627701, b: 0.935546875 }],
    [3, 7, { r: 0.38654708862305, g: 0.72419166564941, b: 0.814453125 }],
    // A cell with the transpose bit set: the colour hashes the raw alternative.
    [2, 536870913, { r: 0.34402847290039, g: 0.6640625, b: 0.228271484375 }],
    [5, -1, { r: 0.6484375, g: 0.0101318359375, b: 0.50382137298584 }],
  ])('colours source %i alternative %i as Godot does', (source, alternative, expected) => {
    const color = placeholderColorOf(source, alternative);
    expect(color.r).toBeCloseTo(expected.r, 6);
    expect(color.g).toBeCloseTo(expected.g, 6);
    expect(color.b).toBeCloseTo(expected.b, 6);
    expect(color.a).toBe(0.8);
  });
});

describe('placeholderCircles', () => {
  const tile = (x: number, y: number): SceneTileCell => ({
    cell: { coords: { x, y }, sourceId: 3, atlasCoords: { x: 0, y: 0 }, alternativeId: 7 },
    tile: { scene: null, displayPlaceholder: false },
  });

  it('puts a disc of a quarter of the shorter side at each cell centre', () => {
    const [circle] = placeholderCircles(grid, [tile(2, 1)]);
    expect(circle!.center).toEqual({ x: 160, y: 48 });
    expect(circle!.radius).toBe(8);
  });

  it('draws nothing for no tiles', () => {
    expect(placeholderCircles(grid, [])).toEqual([]);
  });
});
