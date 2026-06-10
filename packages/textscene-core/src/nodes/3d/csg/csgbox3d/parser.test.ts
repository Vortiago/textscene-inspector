import { describe, expect, it } from 'vitest';
import { parseCSGBox3D } from './parser';
import type { ParsedHeading } from '../../../../parser/utils';

function heading(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseCSGBox3D', () => {
  it('parses size from Vector3', () => {
    const props = parseCSGBox3D(heading({ name: 'Floor', type: 'CSGBox3D' }), {
      size: 'Vector3(3, 0.2, 12)',
    });
    expect(props.size).toEqual({ x: 3, y: 0.2, z: 12 });
  });

  it('defaults size to Godot default (2,2,2) when absent', () => {
    const props = parseCSGBox3D(heading({ name: 'Box', type: 'CSGBox3D' }), {});
    expect(props.size).toEqual({ x: 2, y: 2, z: 2 });
  });

  it('preserves Node3D transform origin', () => {
    const props = parseCSGBox3D(heading({ name: 'Wall', type: 'CSGBox3D' }), {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 2.25, 0)',
      size: 'Vector3(3, 4.5, 0.3)',
    });
    expect(props.transform?.origin).toEqual({ x: 0, y: 2.25, z: 0 });
  });

  it('captures the material reference', () => {
    const props = parseCSGBox3D(heading({ name: 'Floor', type: 'CSGBox3D' }), {
      material: 'SubResource("StandardMaterial3D_floor")',
    });
    expect(props.material).toBe('SubResource("StandardMaterial3D_floor")');
  });

  it('parses the operation enum (parsed, not applied)', () => {
    const props = parseCSGBox3D(heading({ name: 'Box', type: 'CSGBox3D' }), {
      operation: '2',
    });
    expect(props.operation).toBe(2);
  });

  it('tolerates malformed size by falling back to default', () => {
    const props = parseCSGBox3D(heading({ name: 'Box', type: 'CSGBox3D' }), {
      size: 'not-a-vector',
    });
    expect(props.size).toEqual({ x: 2, y: 2, z: 2 });
  });
});
