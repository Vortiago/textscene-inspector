import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../parser/utils';
import { parseGridMap } from './parser';

function heading(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseGridMap', () => {
  it('parses name, parent, and transform (happy path)', () => {
    const result = parseGridMap(
      heading({ name: 'MyGridMap', type: 'GridMap', parent: '.' }),
      { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4)' }
    );
    expect(result.name).toBe('MyGridMap');
    expect(result.parent).toBe('.');
    expect(result.transform?.origin).toEqual({ x: 2, y: 3, z: 4 });
  });

  it('falls back to identity transform on a malformed transform (error path)', () => {
    const result = parseGridMap(
      heading({ name: 'Bad', type: 'GridMap' }),
      { transform: 'Transform3D(not, valid)' }
    );
    expect(result.transform?.basis_x).toEqual({ x: 1, y: 0, z: 0 });
    expect(result.transform?.origin).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('handles missing optional attributes (edge case)', () => {
    const result = parseGridMap(heading({}), {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.transform).toBeUndefined();
  });

  it('parses mesh_library, cell_size, and the cells stream from the data dict', () => {
    const result = parseGridMap(heading({ name: 'G', type: 'GridMap' }), {
      mesh_library: 'ExtResource("1_lib")',
      cell_size: 'Vector3(1, 1, 1)',
      data: '{\n"cells": PackedInt32Array(3, 0, 1048584, 12, 0, 1441800)\n}',
    });
    expect(result.meshLibrary).toBe('ExtResource("1_lib")');
    expect(result.cellSize).toEqual({ x: 1, y: 1, z: 1 });
    expect(result.cells).toBe('3, 0, 1048584, 12, 0, 1441800');
  });

  it('defaults cell_size to (2, 2, 2) and cells to empty when unset', () => {
    const result = parseGridMap(heading({ name: 'G', type: 'GridMap' }), {});
    expect(result.cellSize).toEqual({ x: 2, y: 2, z: 2 });
    expect(result.cells).toBe('');
    expect(result.meshLibrary).toBeUndefined();
  });
});
