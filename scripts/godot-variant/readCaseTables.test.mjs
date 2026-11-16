import { describe, expect, it } from 'vitest';
import { caseRuns, caseTables } from './readCaseTables.mjs';

describe('caseRuns', () => {
  it('joins codes one apart with one delta into a run', () => {
    expect(
      caseRuns([
        [0x61, 0x41],
        [0x62, 0x42],
        [0x63, 0x43],
      ])
    ).toEqual([[0x61, 3, 1, -32]]);
  });

  it('joins codes two apart, as the alternating Latin pairs are', () => {
    expect(
      caseRuns([
        [0x101, 0x100],
        [0x103, 0x102],
        [0x105, 0x104],
      ])
    ).toEqual([[0x101, 3, 2, -1]]);
  });

  it('starts a new run where the delta changes', () => {
    expect(
      caseRuns([
        [0x61, 0x41],
        [0xb5, 0x39c],
      ])
    ).toEqual([
      [0x61, 1, 1, -32],
      [0xb5, 1, 1, 0x39c - 0xb5],
    ]);
  });
});

describe('caseTables', () => {
  it('reads both tables of ucaps.h', () => {
    const source = `static const int caps_table[LTU_LEN][2] = {
	{ 0x0061, 0x0041 },
	{ 0x0062, 0x0042 },
};
static const int reverse_caps_table[UTL_LEN][2] = {
	{ 0x0041, 0x0061 },
};`;
    expect(caseTables(source)).toEqual({ upper: [[0x61, 2, 1, -32]], lower: [[0x41, 1, 1, 32]] });
  });

  it('refuses a source without the tables', () => {
    expect(() => caseTables('int x;')).toThrow(/caps_table/);
  });
});
