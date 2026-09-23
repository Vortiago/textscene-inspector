/**
 * GridMap cell-stream decoder, against real triplets from scenes/demos GridMaps
 * and exact-bit cases. cellData.ts states the layout.
 */
import { describe, it, expect } from 'vitest';
import { decodeGridMapCells, ORTHO_BASES } from './cellData';

describe('decodeGridMapCells', () => {
  it('decodes x/y/z and item/orientation from int triplets', () => {
    // 1,0,0 → x=1; 0,0,1048584 → cell 0x100008 = item 8, rot 16.
    const cells = decodeGridMapCells('1, 0, 0, 0, 0, 1048584');
    expect(cells).toHaveLength(2);
    expect(cells[0]).toEqual({ x: 1, y: 0, z: 0, item: 0, rot: 0 });
    expect(cells[1]).toEqual({ x: 0, y: 0, z: 0, item: 8, rot: 16 });
  });

  it('unpacks y from keyLo high-16 and z from keyHi low-16', () => {
    // 65536 = 0x10000 → x=0, y=1.  keyHi 1 → z=1.
    const cells = decodeGridMapCells('65536, 1, 0');
    expect(cells[0]).toEqual({ x: 0, y: 1, z: 1, item: 0, rot: 0 });
  });

  it('treats x/y/z as signed int16 (negative coordinates)', () => {
    // 65535 = 0xFFFF → -1 ; 65530 = 0xFFFA → -6 (real kinematic_character cell).
    expect(decodeGridMapCells('65535, 0, 0')[0]).toMatchObject({ x: -1 });
    expect(decodeGridMapCells('65530, 0, 0')[0]).toMatchObject({ x: -6 });
  });

  it('ignores a trailing partial triplet rather than emitting garbage', () => {
    expect(decodeGridMapCells('1, 0, 0, 99, 99')).toHaveLength(1);
  });

  it('returns no cells for an empty stream', () => {
    expect(decodeGridMapCells('')).toEqual([]);
  });
});

describe('ORTHO_BASES', () => {
  it('has Godot\'s 24 orthogonal orientations, index 0 = identity', () => {
    expect(ORTHO_BASES).toHaveLength(24);
    expect(ORTHO_BASES[0]).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('every basis is a valid 9-element row-major matrix', () => {
    for (const b of ORTHO_BASES) {
      expect(b).toHaveLength(9);
      // Orthonormal rows → each row is a unit axis vector (entries in {-1,0,1}).
      for (const v of b) expect([-1, 0, 1]).toContain(v);
    }
  });
});

describe('an element no int32 slot can hold', () => {
  it('drops the cell rather than drawing one at the origin', () => {
    // `toUint32(NaN)` is 0, so a NaN for an unstorable element would put a
    // phantom cell at (0,0,0).
    expect(decodeGridMapCells('inf, 0, 1')).toEqual([]);
  });

  it('keeps the cells around it', () => {
    // Fixed stride: the skip unit is the whole 3-int record, so a bad element
    // costs its own cell and no other.
    const cells = decodeGridMapCells('inf, 0, 1, 1, 0, 0');

    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({ x: 1, y: 0, z: 0 });
  });
});
