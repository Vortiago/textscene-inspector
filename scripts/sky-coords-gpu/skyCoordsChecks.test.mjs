import { describe, expect, it } from 'vitest';
import { SKY_COORDS_CASES, skyCoordsFailures } from './skyCoordsChecks.mjs';

const godotCoords = SKY_COORDS_CASES.map(({ coords }) => coords);

describe('skyCoordsFailures', () => {
  it("passes Godot's coordinates", () => {
    expect(skyCoordsFailures(godotCoords)).toEqual([]);
  });

  it("fails the exact acos's V just above the horizon", () => {
    const exact = godotCoords.map((coords, index) => (index === 1 ? [0, 0.468169] : coords));
    expect(skyCoordsFailures(exact)).toEqual([
      'direction 0, 0.0998334, -0.9950042: expected coords 0, 0.469665, got 0, 0.468169',
    ]);
  });

  it('fails a case the page did not evaluate (error case)', () => {
    expect(skyCoordsFailures(godotCoords.slice(0, -1))).toHaveLength(1);
  });
});
