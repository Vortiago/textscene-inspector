/**
 * A tile layer's atlas sources are batched into one mesh each, so they need a
 * deterministic order WITHIN the layer's draw position. That nudge must stay
 * inside the band the layer was given: a fixed step overshoots as soon as the
 * band narrows, and the tiles leapfrog the row in front of them.
 *
 * Measured on the vendored isometric dungeon, where it inverts a door against
 * the wall beside it: the layer decomposes into 36 y-sort rows and shares its
 * parent's fine range with 7 siblings, leaving 0.05/8/42 ≈ 0.000149 between
 * adjacent rows — while a fixed `Z_INDEX_STEP/1024` nudge reaches 0.00039 at
 * the door's atlas source, 2.6x the whole gap.
 */
import { describe, expect, it } from 'vitest';
import { tileSourceZ } from './tileSourceZ';

describe('tileSourceZ', () => {
  it('orders sources by index', () => {
    const band = 0.001;
    const zs = [0, 1, 2, 3, 4].map((i) => tileSourceZ(i, 5, band));
    expect(zs).toEqual([...zs].sort((a, b) => a - b));
    expect(new Set(zs).size).toBe(5);
  });

  it('keeps every source inside the band', () => {
    // The band is the gap to the NEXT draw position; touching it would put the
    // last source level with whatever draws next.
    const band = 0.00014881;
    for (const i of [0, 1, 2, 3, 4]) {
      const z = tileSourceZ(i, 5, band);
      expect(z).toBeGreaterThanOrEqual(0);
      expect(z).toBeLessThan(band);
    }
  });

  it('leaves the first source ON zero so a layer keeps its sibling tie', () => {
    // The band is usually SHARED with siblings, not private to the layer. Godot
    // breaks a tie at equal z by tree order and three does the same, so lifting
    // source 0 off zero would push the whole layer in front of a sibling that
    // should draw over it.
    expect(tileSourceZ(0, 1, 0.002)).toBe(0);
    expect(tileSourceZ(0, 5, 0.002)).toBe(0);
  });

  it('stays inside the band when the caller counts only the sources it draws', () => {
    // The regression this guards: `sourceIndex` used to come from the tileset's
    // FULL source list while `sourceCount` counted only the sources a group
    // actually drew, so a group using one source out of five asked for
    // tileSourceZ(4, 1, band) and landed 2.5 bands forward. Both arguments must
    // describe the same set — every pairing below is one a caller can produce.
    const band = 0.001;
    for (const count of [1, 2, 3, 4, 5]) {
      for (let i = 0; i < count; i++) {
        const z = tileSourceZ(i, count, band);
        expect(z).toBeGreaterThanOrEqual(0);
        expect(z).toBeLessThan(band);
      }
    }
  });

  it('returns 0 rather than dividing by zero when nothing is drawn', () => {
    expect(tileSourceZ(0, 0, 0.002)).toBe(0);
  });

  it('cannot overtake the next row, at the dungeon spacing that broke the doors', () => {
    // Door: row 6 of 41, atlas source 4. Wall: row 7, atlas source 2. The door
    // is correctly one row further back and must stay there.
    const slotWidth = 0.05 / 8;
    const rows = 41;
    const band = slotWidth / (rows + 1);
    const rowZ = (rank: number) => ((rank + 1) / (rows + 1)) * slotWidth;

    // Both rows draw from all five sources, so the drawn-order index IS the
    // tileset index here.
    const door = rowZ(6) + tileSourceZ(4, 5, band);
    const wall = rowZ(7) + tileSourceZ(2, 5, band);
    expect(door).toBeLessThan(wall);
  });

});
