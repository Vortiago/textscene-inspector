import { describe, expect, it } from 'vitest';
import { parseCSGCylinder3D } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

describe('parseCSGCylinder3D', () => {
  it('parses radius and height', () => {
    const props = parseCSGCylinder3D(heading('CSGCylinder3D', { name: 'Plant' }), {
      radius: '0.25',
      height: '0.8',
    });
    expect(props.radius).toBe(0.25);
    expect(props.height).toBe(0.8);
  });

  it('applies Godot defaults when absent (radius 1, height 1, sides 8, cone false)', () => {
    const props = parseCSGCylinder3D(heading('CSGCylinder3D', { name: 'Cyl' }), {});
    expect(props.radius).toBe(1);
    expect(props.height).toBe(1);
    expect(props.sides).toBe(8);
    expect(props.cone).toBe(false);
  });

  it('parses sides and cone', () => {
    const props = parseCSGCylinder3D(heading('CSGCylinder3D', { name: 'Cyl' }), {
      sides: '16',
      cone: 'true',
    });
    expect(props.sides).toBe(16);
    expect(props.cone).toBe(true);
  });

  it('captures the material reference and transform', () => {
    const props = parseCSGCylinder3D(heading('CSGCylinder3D', { name: 'Cyl' }), {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 8.5, 0.4, -16.5)',
      material: 'SubResource("StandardMaterial3D_frame")',
    });
    expect(props.material).toBe('SubResource("StandardMaterial3D_frame")');
    expect(props.transform?.origin.x).toBeCloseTo(8.5, 5);
  });
});
