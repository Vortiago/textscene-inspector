import { describe, expect, it } from 'vitest';
import { parseCSGCylinder3D, isCSGCylinder3D } from './parser';
import type { ParsedHeading } from '../../../../parser/utils';

function heading(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseCSGCylinder3D', () => {
  it('parses radius and height', () => {
    const props = parseCSGCylinder3D(heading({ name: 'Plant', type: 'CSGCylinder3D' }), {
      radius: '0.25',
      height: '0.8',
    });
    expect(props.radius).toBe(0.25);
    expect(props.height).toBe(0.8);
  });

  it('applies Godot defaults when absent (radius 1, height 1, sides 8, cone false)', () => {
    const props = parseCSGCylinder3D(heading({ name: 'Cyl', type: 'CSGCylinder3D' }), {});
    expect(props.radius).toBe(1);
    expect(props.height).toBe(1);
    expect(props.sides).toBe(8);
    expect(props.cone).toBe(false);
  });

  it('parses sides and cone', () => {
    const props = parseCSGCylinder3D(heading({ name: 'Cyl', type: 'CSGCylinder3D' }), {
      sides: '16',
      cone: 'true',
    });
    expect(props.sides).toBe(16);
    expect(props.cone).toBe(true);
  });

  it('captures the material reference and transform', () => {
    const props = parseCSGCylinder3D(heading({ name: 'Cyl', type: 'CSGCylinder3D' }), {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 8.5, 0.4, -16.5)',
      material: 'SubResource("StandardMaterial3D_frame")',
    });
    expect(props.material).toBe('SubResource("StandardMaterial3D_frame")');
    expect(props.transform?.origin.x).toBeCloseTo(8.5, 5);
  });
});

describe('isCSGCylinder3D', () => {
  it('matches a CSGCylinder3D node heading', () => {
    expect(isCSGCylinder3D(heading({ type: 'CSGCylinder3D' }))).toBe(true);
  });

  it('rejects other node types', () => {
    expect(isCSGCylinder3D(heading({ type: 'CSGBox3D' }))).toBe(false);
  });
});
