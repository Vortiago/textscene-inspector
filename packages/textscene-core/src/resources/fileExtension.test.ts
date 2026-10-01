import { describe, expect, it } from 'vitest';
import { fileExtension } from './fileExtension';

describe('fileExtension', () => {
  it('gives the extension dotted and lowercase', () => {
    expect(fileExtension('res://art/Tile.PNG')).toBe('.png');
  });

  it('takes the last extension of a double one', () => {
    expect(fileExtension('res://models/ship.glb.import')).toBe('.import');
  });

  it('is null for a path with no extension', () => {
    expect(fileExtension('res://art/tile')).toBeNull();
  });

  it('is null when the only dot is in a directory name', () => {
    expect(fileExtension('res://art.v2/tile')).toBeNull();
  });
});
