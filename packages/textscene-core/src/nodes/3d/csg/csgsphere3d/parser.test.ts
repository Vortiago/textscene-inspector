import { describe, expect, it } from 'vitest';
import { parseCSGSphere3D } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

describe('parseCSGSphere3D', () => {
  it('parses the witnessed radius/segments/rings form', () => {
    const props = parseCSGSphere3D(heading('CSGSphere3D', { name: 'Union' }), {
      radius: '1.25',
      radial_segments: '48',
      rings: '24',
    });
    expect(props.radius).toBe(1.25);
    expect(props.radialSegments).toBe(48);
    expect(props.rings).toBe(24);
  });

  it('defaults to Godot defaults (radius 0.5, radial_segments 12, rings 6) when absent', () => {
    const props = parseCSGSphere3D(heading('CSGSphere3D', { name: 'Sphere' }), {});
    expect(props.radius).toBe(0.5);
    expect(props.radialSegments).toBe(12);
    expect(props.rings).toBe(6);
  });

  it('preserves the Node3D transform origin', () => {
    const props = parseCSGSphere3D(heading('CSGSphere3D', { name: 'Union' }), {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -1, 1, 1)',
      radius: '1.25',
    });
    expect(props.transform?.origin).toEqual({ x: -1, y: 1, z: 1 });
  });

  it('captures the material reference', () => {
    const props = parseCSGSphere3D(heading('CSGSphere3D', { name: 'Union' }), {
      material: 'ExtResource("4_dsi4m")',
    });
    expect(props.materialPath).toBe('ExtResource("4_dsi4m")');
  });

  it('parses the operation enum (parsed, not applied)', () => {
    const props = parseCSGSphere3D(heading('CSGSphere3D', { name: 'Subtraction' }), {
      operation: '2',
    });
    expect(props.operation).toBe(2);
  });

  it('tolerates a malformed radius by falling back to the default', () => {
    const props = parseCSGSphere3D(heading('CSGSphere3D', { name: 'Sphere' }), {
      radius: 'not-a-number',
    });
    expect(props.radius).toBe(0.5);
  });
});
