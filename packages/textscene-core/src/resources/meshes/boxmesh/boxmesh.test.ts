/**
 * Tests for BoxMesh parser
 */

import { describe, it, expect } from 'vitest';
import { parseBoxMesh } from './parser';
import { parseVector3 } from '../../../parser/vectors';

describe('BoxMesh Parser', () => {
  describe('parseVector3', () => {
    it('should parse Vector3 with positive values', () => {
      const result = parseVector3('Vector3(1, 2, 3)');

      expect(result).toEqual({ x: 1, y: 2, z: 3 });
    });

    it('should parse Vector3 with decimal values', () => {
      const result = parseVector3('Vector3(1.5, 2.7, 3.9)');

      expect(result.x).toBeCloseTo(1.5);
      expect(result.y).toBeCloseTo(2.7);
      expect(result.z).toBeCloseTo(3.9);
    });

    it('should parse Vector3 with negative values', () => {
      const result = parseVector3('Vector3(-1, -2.5, -3)');

      expect(result).toEqual({ x: -1, y: -2.5, z: -3 });
    });

    it('should parse Vector3 with extra whitespace', () => {
      const result = parseVector3('Vector3( 1 , 2 , 3 )');

      expect(result).toEqual({ x: 1, y: 2, z: 3 });
    });

    it('should parse Vector3 with no whitespace', () => {
      const result = parseVector3('Vector3(1,2,3)');

      expect(result).toEqual({ x: 1, y: 2, z: 3 });
    });

    it('should throw on invalid format', () => {
      expect(() => parseVector3('NotAVector')).toThrow('Invalid Vector3 format');
    });

    it('should throw on wrong number of components', () => {
      expect(() => parseVector3('Vector3(1, 2)')).toThrow('Invalid Vector3 format');
      expect(() => parseVector3('Vector3(1, 2, 3, 4)')).toThrow('Invalid Vector3 format');
    });

    it('should throw on non-numeric values', () => {
      expect(() => parseVector3('Vector3(a, b, c)')).toThrow('Invalid Vector3 format');
    });
  });

  describe('parseBoxMesh', () => {
    it('should parse BoxMesh with size property', () => {
      const properties = {
        size: 'Vector3(2, 2, 2)',
      };

      const result = parseBoxMesh(properties);

      expect(result.size).toEqual({ x: 2, y: 2, z: 2 });
    });

    it('should use default size when size property is missing', () => {
      const properties = {};

      const result = parseBoxMesh(properties);

      expect(result.size).toEqual({ x: 1, y: 1, z: 1 });
    });

    it('should parse BoxMesh with non-uniform size', () => {
      const properties = {
        size: 'Vector3(3, 1, 2)',
      };

      const result = parseBoxMesh(properties);

      expect(result.size).toEqual({ x: 3, y: 1, z: 2 });
    });

    it('should handle invalid size gracefully and use default', () => {
      const properties = {
        size: 'InvalidSize',
      };

      const result = parseBoxMesh(properties);

      expect(result.size).toEqual({ x: 1, y: 1, z: 1 });
    });

    it('should parse BoxMesh from actual TSCN format', () => {
      const properties = {
        size: 'Vector3(2, 2, 2)',
      };

      const result = parseBoxMesh(properties);

      expect(result.size.x).toBe(2);
      expect(result.size.y).toBe(2);
      expect(result.size.z).toBe(2);
    });
  });
});
