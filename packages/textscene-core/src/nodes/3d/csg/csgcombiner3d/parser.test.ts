import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { parseCSGCombiner3D } from './parser';

describe('parseCSGCombiner3D', () => {
  it('parses the vendored witness shape (ragdoll_physics.tscn:92)', () => {
    const result = parseCSGCombiner3D(
      heading('CSGCombiner3D', { name: 'CSGCombiner3D', parent: 'StaticBody3D' }),
      { visible: 'false' }
    );
    expect(result.name).toBe('CSGCombiner3D');
    expect(result.parent).toBe('StaticBody3D');
    expect(result.visible).toBe(false);
  });

  // `CSGShape3D : GeometryInstance3D` (`modules/csg/csg_shape.h:47`), so a
  // combiner carries the shadow-casting mode like any other geometry. It is
  // read here rather than through `finishCsgParse` because that helper also
  // copies `material`, which a CSGShape3D that is not a CSGPrimitive3D lacks.
  it('parses cast_shadow, which the CSGPrimitive3D helper it cannot use would have carried', () => {
    const result = parseCSGCombiner3D(heading('CSGCombiner3D', { name: 'C' }), { cast_shadow: '3' });
    expect(result.castShadow).toBe(3);
  });

  it('leaves cast_shadow absent when the scene authors none', () => {
    expect(parseCSGCombiner3D(heading('CSGCombiner3D', { name: 'C' }), {}).castShadow).toBeUndefined();
  });

  it('parses operation, which says how its fold combines into ITS parent', () => {
    const result = parseCSGCombiner3D(heading('CSGCombiner3D', { name: 'C' }), { operation: '2' });
    expect(result.operation).toBe(2);
  });

  it('leaves operation undefined when unwritten rather than defaulting to 0', () => {
    // Union is Godot's default, but recording "absent" separately keeps the inspector
    // honest about what the scene file actually says.
    expect(parseCSGCombiner3D(heading('CSGCombiner3D', { name: 'C' }), {}).operation).toBeUndefined();
  });

  it('does not carry a material: a combiner is a CSGShape3D, not a CSGPrimitive3D', () => {
    const result = parseCSGCombiner3D(heading('CSGCombiner3D', { name: 'C' }), {
      material: 'SubResource("StandardMaterial3D_1")',
    });
    expect('materialPath' in result).toBe(false);
  });

  it('parses name, parent, and transform (happy path)', () => {
    const result = parseCSGCombiner3D(heading('CSGCombiner3D', { name: 'C', parent: '.' }), {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4)',
    });
    expect(result.transform?.origin).toEqual({ x: 2, y: 3, z: 4 });
  });

  it('falls back to identity transform on a malformed transform (error path)', () => {
    const result = parseCSGCombiner3D(heading('CSGCombiner3D', { name: 'Bad' }), {
      transform: 'Transform3D(not, valid)',
    });
    expect(result.transform?.basis_x).toEqual({ x: 1, y: 0, z: 0 });
    expect(result.transform?.origin).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('handles missing optional attributes (edge case)', () => {
    const result = parseCSGCombiner3D({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.transform).toBeUndefined();
  });
});
