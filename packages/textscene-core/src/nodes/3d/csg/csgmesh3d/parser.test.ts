import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { parseCSGMesh3D } from './parser';

describe('parseCSGMesh3D', () => {
  it('keeps the raw mesh reference for the component to resolve', () => {
    const result = parseCSGMesh3D(heading('CSGMesh3D', { name: 'M' }), {
      mesh: 'SubResource("BoxMesh_csg")',
    });
    expect(result.mesh).toBe('SubResource("BoxMesh_csg")');
  });

  it('parses material and operation through the shared CSG tail', () => {
    const result = parseCSGMesh3D(heading('CSGMesh3D', { name: 'M' }), {
      mesh: 'SubResource("CapsuleMesh_csg")',
      material: 'SubResource("StandardMaterial3D_1")',
      operation: '2',
    });
    expect(result.material).toBe('SubResource("StandardMaterial3D_1")');
    expect(result.operation).toBe(2);
  });

  it('defaults flip_faces to false and reads it when written', () => {
    expect(parseCSGMesh3D(heading('CSGMesh3D', { name: 'M' }), {}).flipFaces).toBe(false);
    expect(
      parseCSGMesh3D(heading('CSGMesh3D', { name: 'M' }), { flip_faces: 'true' }).flipFaces
    ).toBe(true);
  });

  it('leaves mesh undefined when unwritten', () => {
    // Godot builds an empty brush for a CSGMesh3D with no mesh (csg_shape.cpp:1126),
    // so "absent" is a renderable state rather than an error.
    expect(parseCSGMesh3D(heading('CSGMesh3D', { name: 'M' }), {}).mesh).toBeUndefined();
  });

  it('parses name, parent, and transform (happy path)', () => {
    const result = parseCSGMesh3D(heading('CSGMesh3D', { name: 'M', parent: '.' }), {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4)',
    });
    expect(result.name).toBe('M');
    expect(result.parent).toBe('.');
    expect(result.transform?.origin).toEqual({ x: 2, y: 3, z: 4 });
  });

  it('falls back to identity transform on a malformed transform (error path)', () => {
    const result = parseCSGMesh3D(heading('CSGMesh3D', { name: 'Bad' }), {
      transform: 'Transform3D(not, valid)',
    });
    expect(result.transform?.basis_x).toEqual({ x: 1, y: 0, z: 0 });
    expect(result.transform?.origin).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('handles missing optional attributes (edge case)', () => {
    const result = parseCSGMesh3D({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.transform).toBeUndefined();
  });
});
