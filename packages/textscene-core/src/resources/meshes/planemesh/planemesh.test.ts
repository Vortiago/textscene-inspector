import { describe, it, expect } from 'vitest';
import { parsePlaneMesh } from './parser';
import { parseVector2 } from '../../../parser/vectors';
import { createPlaneMeshGeometry } from './renderer';
import * as THREE from 'three';

describe('PlaneMesh Parser', () => {
  describe('parseVector2', () => {
    it('should parse Vector2 with positive values', () => {
      const result = parseVector2('Vector2(10, 5)');
      expect(result).toEqual({ x: 10, y: 5 });
    });

    it('should parse Vector2 with negative values', () => {
      const result = parseVector2('Vector2(-3.5, -2.1)');
      expect(result).toEqual({ x: -3.5, y: -2.1 });
    });

    it('should parse Vector2 with spaces', () => {
      const result = parseVector2('Vector2( 10 , 5 )');
      expect(result).toEqual({ x: 10, y: 5 });
    });

    it('should throw on invalid format', () => {
      expect(() => parseVector2('invalid')).toThrow('Invalid Vector2 format');
      expect(() => parseVector2('Vector2(10)')).toThrow('Invalid Vector2 format');
    });
  });

  describe('parsePlaneMesh', () => {
    it('should parse PlaneMesh with default values', () => {
      const properties = {};
      const result = parsePlaneMesh(properties);

      expect(result.size).toEqual({ x: 2, y: 2 });
      expect(result.subdivideWidth).toBe(0);
      expect(result.subdivideDepth).toBe(0);
      expect(result.orientation).toBe(1); // FACE_Y
      expect(result.centerOffset).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('should parse custom PlaneMesh properties', () => {
      const properties = {
        size: 'Vector2(10, 5)',
        subdivide_width: '10',
        subdivide_depth: '5',
        orientation: '2',
      };
      const result = parsePlaneMesh(properties);

      expect(result.size).toEqual({ x: 10, y: 5 });
      expect(result.subdivideWidth).toBe(10);
      expect(result.subdivideDepth).toBe(5);
      expect(result.orientation).toBe(2);
    });

    it('should handle invalid size gracefully', () => {
      const properties = {
        size: 'invalid',
      };
      const result = parsePlaneMesh(properties);

      expect(result.size).toEqual({ x: 2, y: 2 }); // Falls back to default
    });

    it('should handle invalid subdivision values', () => {
      const properties = {
        subdivide_width: 'invalid',
        subdivide_depth: 'not_a_number',
      };
      const result = parsePlaneMesh(properties);

      expect(result.subdivideWidth).toBe(0);
      expect(result.subdivideDepth).toBe(0);
    });

    it('should handle invalid orientation', () => {
      const properties = {
        orientation: '5', // Out of range
      };
      const result = parsePlaneMesh(properties);

      expect(result.orientation).toBe(1); // Falls back to default
    });

    it('should parse center_offset property', () => {
      const properties = {
        center_offset: 'Vector3(0, 2, 0)',
      };
      const result = parsePlaneMesh(properties);

      expect(result.centerOffset).toEqual({ x: 0, y: 2, z: 0 });
    });

    it('should parse center_offset with negative values', () => {
      const properties = {
        center_offset: 'Vector3(-1.5, 3.2, -0.5)',
      };
      const result = parsePlaneMesh(properties);

      expect(result.centerOffset).toEqual({ x: -1.5, y: 3.2, z: -0.5 });
    });

    it('should handle invalid center_offset gracefully', () => {
      const properties = {
        center_offset: 'invalid',
      };
      const result = parsePlaneMesh(properties);

      expect(result.centerOffset).toEqual({ x: 0, y: 0, z: 0 }); // Falls back to default
    });

    it('should parse all properties including center_offset', () => {
      const properties = {
        size: 'Vector2(2, 4)',
        center_offset: 'Vector3(0, 2, 0)',
        orientation: '0',
      };
      const result = parsePlaneMesh(properties);

      expect(result.size).toEqual({ x: 2, y: 4 });
      expect(result.centerOffset).toEqual({ x: 0, y: 2, z: 0 });
      expect(result.orientation).toBe(0);
    });
  });
});

describe('PlaneMesh Renderer', () => {
  describe('createPlaneMeshGeometry', () => {
    it('should create PlaneGeometry with correct dimensions', () => {
      const props = {
        size: { x: 10, y: 5 },
        subdivideWidth: 10,
        subdivideDepth: 5,
        orientation: 1,
        centerOffset: { x: 0, y: 0, z: 0 },
      };

      const geometry = createPlaneMeshGeometry(props);

      expect(geometry).toBeInstanceOf(THREE.PlaneGeometry);
      expect(geometry.parameters.width).toBe(10);
      expect(geometry.parameters.height).toBe(5);
      expect(geometry.parameters.widthSegments).toBe(10);
      expect(geometry.parameters.heightSegments).toBe(5);
    });

    it('should enforce minimum 1 segment for subdivisions', () => {
      const props = {
        size: { x: 5, y: 5 },
        subdivideWidth: 0,
        subdivideDepth: 0,
        orientation: 1,
        centerOffset: { x: 0, y: 0, z: 0 },
      };

      const geometry = createPlaneMeshGeometry(props);

      expect(geometry.parameters.widthSegments).toBe(1);
      expect(geometry.parameters.heightSegments).toBe(1);
    });

    it('should create default plane with size 2x2', () => {
      const props = {
        size: { x: 2, y: 2 },
        subdivideWidth: 0,
        subdivideDepth: 0,
        orientation: 1,
        centerOffset: { x: 0, y: 0, z: 0 },
      };

      const geometry = createPlaneMeshGeometry(props);

      expect(geometry.parameters.width).toBe(2);
      expect(geometry.parameters.height).toBe(2);
    });

    it('should apply center_offset by translating geometry', () => {
      const props = {
        size: { x: 2, y: 4 },
        subdivideWidth: 0,
        subdivideDepth: 0,
        orientation: 2, // FACE_Z (default orientation, no rotation)
        centerOffset: { x: 0, y: 2, z: 0 },
      };

      const geometry = createPlaneMeshGeometry(props);

      // Check bounding box to verify translation was applied
      geometry.computeBoundingBox();
      const bbox = geometry.boundingBox!;

      // With center_offset.y = 2, the plane should be shifted up by 2 units
      // Original plane (4 units tall) goes from -2 to +2
      // After offset by +2, it should go from 0 to +4
      expect(bbox.min.y).toBeCloseTo(0, 5);
      expect(bbox.max.y).toBeCloseTo(4, 5);
    });

    it('should apply center_offset with negative values', () => {
      const props = {
        size: { x: 2, y: 2 },
        subdivideWidth: 0,
        subdivideDepth: 0,
        orientation: 2, // FACE_Z
        centerOffset: { x: -1, y: -1, z: 0 },
      };

      const geometry = createPlaneMeshGeometry(props);

      geometry.computeBoundingBox();
      const bbox = geometry.boundingBox!;

      // Original plane (2 units) goes from -1 to +1
      // After offset by -1, -1 it should go from -2 to 0 in both x and y
      expect(bbox.min.x).toBeCloseTo(-2, 5);
      expect(bbox.max.x).toBeCloseTo(0, 5);
      expect(bbox.min.y).toBeCloseTo(-2, 5);
      expect(bbox.max.y).toBeCloseTo(0, 5);
    });

    it('should not translate geometry when center_offset is zero', () => {
      const props = {
        size: { x: 2, y: 2 },
        subdivideWidth: 0,
        subdivideDepth: 0,
        orientation: 2, // FACE_Z
        centerOffset: { x: 0, y: 0, z: 0 },
      };

      const geometry = createPlaneMeshGeometry(props);

      geometry.computeBoundingBox();
      const bbox = geometry.boundingBox!;

      // Without offset, plane should be centered at origin
      expect(bbox.min.x).toBeCloseTo(-1, 5);
      expect(bbox.max.x).toBeCloseTo(1, 5);
      expect(bbox.min.y).toBeCloseTo(-1, 5);
      expect(bbox.max.y).toBeCloseTo(1, 5);
    });
  });
});
