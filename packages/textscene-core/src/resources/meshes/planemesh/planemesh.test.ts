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
      };

      const geometry = createPlaneMeshGeometry(props);

      expect(geometry.parameters.width).toBe(2);
      expect(geometry.parameters.height).toBe(2);
    });
  });
});
