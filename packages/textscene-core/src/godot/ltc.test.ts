import { describe, expect, it } from 'vitest';
import { LTC_SIZE, ltcTables } from './ltc';

/** The four floats of the texel at `column`, `row`. */
function texel(table: Float32Array, column: number, row: number): number[] {
  const offset = (row * LTC_SIZE + column) * 4;
  return Array.from(table.subarray(offset, offset + 4));
}

describe('ltcTables', () => {
  it("holds Godot's fit at a texel inside the table", () => {
    // Read off ltc_lut1.dds at column 10, row 32.
    const [a, b, c, d] = texel(ltcTables().lut1, 10, 32);

    expect(a).toBeCloseTo(0.03743, 5);
    expect(b).toBeCloseTo(0.03373, 5);
    expect(c).toBeCloseTo(0.0374, 4);
    expect(d).toBeCloseTo(-0.67034, 5);
  });

  it('holds a full Fresnel weight at the smoothest, head-on texel (edge case)', () => {
    expect(texel(ltcTables().lut2, 0, 0)).toEqual([1, 1, 0, 0]);
  });

  it('holds one RGBA texel per cell of each table', () => {
    const { lut1, lut2 } = ltcTables();

    expect(lut1.length).toBe(LTC_SIZE * LTC_SIZE * 4);
    expect(lut2.length).toBe(LTC_SIZE * LTC_SIZE * 4);
  });
});
