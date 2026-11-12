import { describe, expect, it } from 'vitest';
import { withUnsweptSlice } from './wiring.mjs';

const LIST = `/** The slices the guard cannot see. */
export const UNSWEPT_SLICES: readonly string[] = [
  '2d/bone2d',
  '3d/xr/xrnode3d',
  'physics/3d/area3d',
];
`;

describe('withUnsweptSlice', () => {
  it('adds the line of a slice where the sorted list keeps it', () => {
    expect(withUnsweptSlice(LIST, '3d/lightmapprobe')).toBe(
      LIST.replace("  '3d/xr/xrnode3d',\n", "  '3d/lightmapprobe',\n  '3d/xr/xrnode3d',\n")
    );
  });

  it('adds a slice that sorts after every line before the closing bracket (edge case)', () => {
    expect(withUnsweptSlice(LIST, 'windows/window')).toBe(LIST.replace('];', "  'windows/window',\n];"));
  });

  it('adds a slice that sorts before every line after the opening bracket (edge case)', () => {
    expect(withUnsweptSlice(LIST, '2d/audiolistener2d')).toBe(
      LIST.replace("  '2d/bone2d',\n", "  '2d/audiolistener2d',\n  '2d/bone2d',\n")
    );
  });

  it('answers undefined for a slice the list already names', () => {
    expect(withUnsweptSlice(LIST, '2d/bone2d')).toBeUndefined();
  });

  it('refuses a source without the list (error case)', () => {
    expect(() => withUnsweptSlice('export const OTHER = [];\n', '2d/bone2d')).toThrow(
      /expected the UNSWEPT_SLICES list, got/
    );
  });
});
