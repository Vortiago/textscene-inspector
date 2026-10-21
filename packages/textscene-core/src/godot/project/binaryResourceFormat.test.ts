/** Which paths hold a binary scene, the one binary resource the previewer cannot read. */
import { describe, it, expect } from 'vitest';
import { isBinaryScenePath } from './binaryResourceFormat.js';

describe('isBinaryScenePath', () => {
  it('names a .scn a binary scene, whatever type the reference states', () => {
    expect(isBinaryScenePath('res://stage/grid_map.scn', undefined)).toBe(true);
  });

  it('names a PackedScene saved as a .res a binary scene', () => {
    expect(isBinaryScenePath('res://stage/grid_map.res', 'PackedScene')).toBe(true);
  });

  it('leaves out a .res that holds another type, and a text scene (error case)', () => {
    expect(isBinaryScenePath('res://meshes/floor.res', 'ArrayMesh')).toBe(false);
    expect(isBinaryScenePath('res://stage/grid_map.tscn', 'PackedScene')).toBe(false);
  });

  it('compares the extension case-insensitively, as recognize_path does (edge case)', () => {
    expect(isBinaryScenePath('res://stage/GRID_MAP.SCN', undefined)).toBe(true);
    expect(isBinaryScenePath('res://stage/grid_map.Res', 'PackedScene')).toBe(true);
  });
});
