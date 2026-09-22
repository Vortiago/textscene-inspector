import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { parseCSGTorus3D } from './parser';

describe('parseCSGTorus3D', () => {
  it('applies Godot’s defaults when nothing is written (csg_shape.cpp:2140-2147)', () => {
    // An omitted property means Godot's value, so a mismatch here renders every
    // default torus at the wrong size. smooth_faces defaulting TRUE is the one most
    // easily assumed backwards: CSGPolygon3D defaults it false.
    const result = parseCSGTorus3D(heading('CSGTorus3D', { name: 'Ring' }), {});
    expect(result.innerRadius).toBe(0.5);
    expect(result.outerRadius).toBe(1);
    expect(result.sides).toBe(8);
    expect(result.ringSides).toBe(6);
    expect(result.smoothFaces).toBe(true);
    expect(result.flipFaces).toBe(false);
  });

  it('parses the vendored witness block (csg.tscn:268)', () => {
    const result = parseCSGTorus3D(heading('CSGTorus3D', { name: 'CSGTorus3D', parent: '.' }), {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.9, 0)',
      operation: '2',
      inner_radius: '0.25',
      outer_radius: '0.4',
      sides: '32',
      ring_sides: '5',
      material: 'ExtResource("4_dsi4m")',
    });
    expect(result.innerRadius).toBe(0.25);
    expect(result.outerRadius).toBe(0.4);
    expect(result.sides).toBe(32);
    expect(result.ringSides).toBe(5);
    expect(result.operation).toBe(2);
    expect(result.materialPath).toBe('ExtResource("4_dsi4m")');
    expect(result.transform?.origin).toEqual({ x: 0, y: 0.9, z: 0 });
  });

  it('reads smooth_faces and flip_faces when written', () => {
    const result = parseCSGTorus3D(heading('CSGTorus3D', { name: 'Ring' }), {
      smooth_faces: 'false',
      flip_faces: 'true',
    });
    expect(result.smoothFaces).toBe(false);
    expect(result.flipFaces).toBe(true);
  });

  it('falls back to the default on a malformed radius rather than emitting NaN', () => {
    // NaN would propagate into the geometry and then into the BVH, so the parser
    // absorbs it here.
    const result = parseCSGTorus3D(heading('CSGTorus3D', { name: 'Bad' }), {
      inner_radius: 'not-a-number',
    });
    expect(result.innerRadius).toBe(0.5);
  });

  it('falls back to identity transform on a malformed transform (error path)', () => {
    const result = parseCSGTorus3D(heading('CSGTorus3D', { name: 'Bad' }), {
      transform: 'Transform3D(not, valid)',
    });
    expect(result.transform?.basis_x).toEqual({ x: 1, y: 0, z: 0 });
    expect(result.transform?.origin).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('handles missing optional attributes (edge case)', () => {
    const result = parseCSGTorus3D({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.transform).toBeUndefined();
  });
});
