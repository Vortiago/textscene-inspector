import { describe, expect, it } from 'vitest';
import type { ParsedResource } from '../../parser/parsedResource';
import { materialPathInFile } from './materialPathInFile';

const FILE: ParsedResource = {
  resourceType: 'BoxMesh',
  properties: {},
  extResources: [{ id: '1_mat', type: 'StandardMaterial3D', path: 'res://red.tres' }],
  subResources: [
    { id: 'Own', type: 'StandardMaterial3D', data: {} },
    { id: 'Noise', type: 'NoiseTexture2D', data: {} },
  ],
};

describe('materialPathInFile', () => {
  it('resolves an ExtResource to its file and a SubResource to a path into this file', () => {
    expect(materialPathInFile('ExtResource("1_mat")', FILE, 'res://box.tres')).toBe('res://red.tres');
    expect(materialPathInFile('SubResource("Own")', FILE, 'res://box.tres')).toBe('res://box.tres::Own');
  });

  it('resolves nothing for an undeclared id or no reference (error path)', () => {
    expect(materialPathInFile('ExtResource("9")', FILE, 'res://box.tres')).toBeNull();
    expect(materialPathInFile(undefined, FILE, 'res://box.tres')).toBeNull();
  });

  it('resolves nothing for a sub-resource no material builder reads (edge case)', () => {
    expect(materialPathInFile('SubResource("Noise")', FILE, 'res://box.tres')).toBeNull();
  });
});
