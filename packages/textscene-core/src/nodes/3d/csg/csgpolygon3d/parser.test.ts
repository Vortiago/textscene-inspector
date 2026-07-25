import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { parseCSGPolygon3D } from './parser';

describe('parseCSGPolygon3D', () => {
  it('defaults `polygon` to a UNIT SQUARE, not an empty array', () => {
    // csg_shape.cpp:2811-2814. The single most consequential default here: a
    // CSGPolygon3D that writes nothing still renders a solid, so reading this as
    // "empty" would make csg.tscn:128 disappear.
    const result = parseCSGPolygon3D(heading('CSGPolygon3D', { name: 'P' }), {});
    expect(Array.from(result.polygon)).toEqual([0, 0, 0, 1, 1, 1, 1, 0]);
  });

  it('defaults path_rotation to PATH_FOLLOW (2), not POLYGON (0)', () => {
    expect(parseCSGPolygon3D(heading('CSGPolygon3D', { name: 'P' }), {}).pathRotation).toBe(2);
  });

  it('defaults smooth_faces to FALSE, unlike CSGTorus3D which defaults it true', () => {
    expect(parseCSGPolygon3D(heading('CSGPolygon3D', { name: 'P' }), {}).smoothFaces).toBe(false);
  });

  it('applies the remaining Godot defaults (csg_shape.cpp:2808-2829)', () => {
    const r = parseCSGPolygon3D(heading('CSGPolygon3D', { name: 'P' }), {});
    expect(r.mode).toBe(0);
    expect(r.depth).toBe(1);
    expect(r.spinDegrees).toBe(360);
    expect(r.spinSides).toBe(8);
    expect(r.pathIntervalType).toBe(0);
    expect(r.pathInterval).toBe(1);
    expect(r.pathSimplifyAngle).toBe(0);
    expect(r.pathRotationAccurate).toBe(false);
    expect(r.pathLocal).toBe(false);
    expect(r.pathContinuousU).toBe(true);
    expect(r.pathUDistance).toBe(1);
    expect(r.pathJoined).toBe(false);
    expect(r.flipFaces).toBe(false);
  });

  it('parses the DEPTH witness (csg.tscn:145, the Slope)', () => {
    const r = parseCSGPolygon3D(heading('CSGPolygon3D', { name: 'CSGPolygon3D', parent: 'Testers/Slope' }), {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -1, 1, 1)',
      polygon: 'PackedVector2Array(0, -1, 0, 0, 2, -1)',
      depth: '2.0',
      material: 'ExtResource("3_5yyaq")',
    });
    expect(Array.from(r.polygon)).toEqual([0, -1, 0, 0, 2, -1]);
    expect(r.depth).toBe(2);
    expect(r.material).toBe('ExtResource("3_5yyaq")');
  });

  it('parses the SPIN witness (csg.tscn:163, the StaircaseSpin)', () => {
    const r = parseCSGPolygon3D(heading('CSGPolygon3D', { name: 'P' }), {
      mode: '1',
      spin_degrees: '90.0',
      spin_sides: '32',
    });
    expect(r.mode).toBe(1);
    expect(r.spinDegrees).toBe(90);
    expect(r.spinSides).toBe(32);
  });

  it('parses the PATH witness (csg.tscn:365, RoadSides) and keeps path_node raw', () => {
    const r = parseCSGPolygon3D(heading('CSGPolygon3D', { name: 'RoadSides' }), {
      mode: '2',
      path_node: 'NodePath("../Path3D")',
      path_interval_type: '0',
      path_interval: '0.1',
      path_simplify_angle: '4.0',
      path_rotation: '1',
      path_rotation_accurate: 'false',
      path_local: 'true',
      path_continuous_u: 'true',
      path_u_distance: '2.0',
      path_joined: 'true',
      smooth_faces: 'true',
    });
    expect(r.mode).toBe(2);
    // Kept as the literal: only the scene-wide pass can resolve it, since a sibling is
    // not reachable from the node itself.
    expect(r.pathNode).toBe('NodePath("../Path3D")');
    expect(r.pathInterval).toBe(0.1);
    expect(r.pathSimplifyAngle).toBe(4);
    expect(r.pathRotation).toBe(1);
    expect(r.pathLocal).toBe(true);
    expect(r.pathUDistance).toBe(2);
    expect(r.pathJoined).toBe(true);
    expect(r.smoothFaces).toBe(true);
    expect(r.resolvedPath).toBeUndefined();
  });

  it('falls back to an EMPTY polygon on malformed input, not to the default square', () => {
    // Substituting the default would draw a unit square the scene never asked for,
    // which reads as "working" instead of "broken".
    const r = parseCSGPolygon3D(heading('CSGPolygon3D', { name: 'Bad' }), {
      polygon: 'PackedVector2Array(nonsense',
    });
    expect(r.polygon.length).toBe(0);
  });

  it('handles missing optional attributes (edge case)', () => {
    const r = parseCSGPolygon3D({ type: 'node', attributes: {} }, {});
    expect(r.name).toBe('');
    expect(r.parent).toBeUndefined();
    expect(r.transform).toBeUndefined();
  });
});
