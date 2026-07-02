import { describe, expect, it } from 'vitest';
import { parseCSGBox3D } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

describe('parseCSGBox3D', () => {
  it('parses size from Vector3', () => {
    const props = parseCSGBox3D(heading('CSGBox3D', { name: 'Floor' }), {
      size: 'Vector3(3, 0.2, 12)',
    });
    expect(props.size).toEqual({ x: 3, y: 0.2, z: 12 });
  });

  it('defaults size to Godot default (2,2,2) when absent', () => {
    const props = parseCSGBox3D(heading('CSGBox3D', { name: 'Box' }), {});
    expect(props.size).toEqual({ x: 2, y: 2, z: 2 });
  });

  it('preserves Node3D transform origin', () => {
    const props = parseCSGBox3D(heading('CSGBox3D', { name: 'Wall' }), {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 2.25, 0)',
      size: 'Vector3(3, 4.5, 0.3)',
    });
    expect(props.transform?.origin).toEqual({ x: 0, y: 2.25, z: 0 });
  });

  it('captures the material reference', () => {
    const props = parseCSGBox3D(heading('CSGBox3D', { name: 'Floor' }), {
      material: 'SubResource("StandardMaterial3D_floor")',
    });
    expect(props.material).toBe('SubResource("StandardMaterial3D_floor")');
  });

  it('parses the operation enum (parsed, not applied)', () => {
    const props = parseCSGBox3D(heading('CSGBox3D', { name: 'Box' }), {
      operation: '2',
    });
    expect(props.operation).toBe(2);
  });

  it('tolerates malformed size by falling back to default', () => {
    const props = parseCSGBox3D(heading('CSGBox3D', { name: 'Box' }), {
      size: 'not-a-vector',
    });
    expect(props.size).toEqual({ x: 2, y: 2, z: 2 });
  });
});
