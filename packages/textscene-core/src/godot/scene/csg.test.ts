import { describe, expect, it } from 'vitest';
import {
  CSG_MERGE_TOLERANCE,
  CSG_OPERATION_NAMES,
  CSG_POLYGON_MODE_NAMES,
  CSG_POLYGON_PATH_INTERVAL_TYPE_NAMES,
  CSG_POLYGON_PATH_ROTATION_NAMES,
} from './csg';

describe('CSG_MERGE_TOLERANCE', () => {
  it('is twice the single-precision epsilon', () => {
    expect(CSG_MERGE_TOLERANCE).toBeCloseTo(2.384185791015625e-7, 20);
  });

  it('is far wider than the trig residue three leaves at a pole', () => {
    expect(Math.abs(Math.sin(Math.PI) * 0.4)).toBeLessThan(CSG_MERGE_TOLERANCE);
  });
});

describe('CSG enum label tables', () => {
  it('names the boolean operations without their OPERATION_ prefix (csg_shape.h:51-55)', () => {
    expect(CSG_OPERATION_NAMES).toEqual({ 0: 'UNION', 1: 'INTERSECTION', 2: 'SUBTRACTION' });
  });

  it('names the CSGPolygon3D modes (csg_shape.h:372-376)', () => {
    expect(CSG_POLYGON_MODE_NAMES).toEqual({ 0: 'DEPTH', 1: 'SPIN', 2: 'PATH' });
  });

  it('names the CSGPolygon3D path interval types (csg_shape.h:378-381)', () => {
    expect(CSG_POLYGON_PATH_INTERVAL_TYPE_NAMES).toEqual({ 0: 'DISTANCE', 1: 'SUBDIVIDE' });
  });

  it('names the CSGPolygon3D path rotations (csg_shape.h:383-387)', () => {
    expect(CSG_POLYGON_PATH_ROTATION_NAMES).toEqual({ 0: 'POLYGON', 1: 'PATH', 2: 'PATH_FOLLOW' });
  });
});
