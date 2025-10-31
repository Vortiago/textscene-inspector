import { describe, it, expect } from 'vitest';
import { parsePrismMesh } from './parser';
import { parseVector3 } from '../../../parser/vectors';
import { createPrismMeshGeometry } from './renderer';
import * as THREE from 'three';

describe('PrismMesh Parser', () => {
  describe('parseVector3', () => {
    it('should parse Vector3 with positive values', () => {
      const result = parseVector3('Vector3(1, 2, 3)');
      expect(result).toEqual({ x: 1, y: 2, z: 3 });
    });

    it('should parse Vector3 with negative values', () => {
      const result = parseVector3('Vector3(-1.5, -2.5, -3.5)');
      expect(result).toEqual({ x: -1.5, y: -2.5, z: -3.5 });
    });

    it('should parse Vector3 with spaces', () => {
      const result = parseVector3('Vector3( 1 , 2 , 3 )');
      expect(result).toEqual({ x: 1, y: 2, z: 3 });
    });

    it('should throw on invalid format', () => {
      expect(() => parseVector3('invalid')).toThrow('Invalid Vector3 format');
      expect(() => parseVector3('Vector3(1, 2)')).toThrow('Invalid Vector3 format');
    });
  });

  describe('parsePrismMesh', () => {
    it('should parse PrismMesh with default values', () => {
      const properties = {};
      const result = parsePrismMesh(properties);

      expect(result.leftToRight).toBe(0.5);
      expect(result.size).toEqual({ x: 2, y: 2, z: 2 });
      expect(result.subdivideWidth).toBe(0);
      expect(result.subdivideHeight).toBe(0);
      expect(result.subdivideDepth).toBe(0);
    });

    it('should parse custom PrismMesh properties', () => {
      const properties = {
        left_to_right: '0.3',
        size: 'Vector3(1, 3, 2)',
        subdivide_width: '2',
        subdivide_height: '4',
        subdivide_depth: '3',
      };
      const result = parsePrismMesh(properties);

      expect(result.leftToRight).toBe(0.3);
      expect(result.size).toEqual({ x: 1, y: 3, z: 2 });
      expect(result.subdivideWidth).toBe(2);
      expect(result.subdivideHeight).toBe(4);
      expect(result.subdivideDepth).toBe(3);
    });

    it('should handle invalid left_to_right gracefully', () => {
      const properties = {
        left_to_right: 'invalid',
      };
      const result = parsePrismMesh(properties);

      expect(result.leftToRight).toBe(0.5); // Falls back to default
    });

    it('should handle invalid size gracefully', () => {
      const properties = {
        size: 'invalid',
      };
      const result = parsePrismMesh(properties);

      expect(result.size).toEqual({ x: 2, y: 2, z: 2 }); // Falls back to default
    });

    it('should handle invalid subdivisions gracefully', () => {
      const properties = {
        subdivide_width: 'invalid',
        subdivide_height: 'not_a_number',
        subdivide_depth: 'bad',
      };
      const result = parsePrismMesh(properties);

      expect(result.subdivideWidth).toBe(0);
      expect(result.subdivideHeight).toBe(0);
      expect(result.subdivideDepth).toBe(0);
    });
  });
});

describe('PrismMesh Renderer', () => {
  it('should create CylinderGeometry with 3 radial segments', () => {
    const props = {
      leftToRight: 0.5,
      size: { x: 2, y: 3, z: 2 },
      subdivideWidth: 0,
      subdivideHeight: 0,
      subdivideDepth: 0,
    };

    const geometry = createPrismMeshGeometry(props);

    expect(geometry).toBeInstanceOf(THREE.CylinderGeometry);
    expect(geometry.parameters.radiusTop).toBe(1); // size.x / 2
    expect(geometry.parameters.radiusBottom).toBe(1); // size.x / 2
    expect(geometry.parameters.height).toBe(3); // size.y
    expect(geometry.parameters.radialSegments).toBe(3); // Triangular
  });

  it('should handle height subdivisions', () => {
    const props = {
      leftToRight: 0.5,
      size: { x: 2, y: 4, z: 2 },
      subdivideWidth: 0,
      subdivideHeight: 5,
      subdivideDepth: 0,
    };

    const geometry = createPrismMeshGeometry(props);

    expect(geometry.parameters.heightSegments).toBe(5);
  });

  it('should enforce minimum 1 height segment', () => {
    const props = {
      leftToRight: 0.5,
      size: { x: 2, y: 4, z: 2 },
      subdivideWidth: 0,
      subdivideHeight: 0,
      subdivideDepth: 0,
    };

    const geometry = createPrismMeshGeometry(props);

    expect(geometry.parameters.heightSegments).toBe(1);
  });

  it('should create default prism dimensions', () => {
    const props = {
      leftToRight: 0.5,
      size: { x: 2, y: 2, z: 2 },
      subdivideWidth: 0,
      subdivideHeight: 0,
      subdivideDepth: 0,
    };

    const geometry = createPrismMeshGeometry(props);

    expect(geometry.parameters.radiusTop).toBe(1);
    expect(geometry.parameters.radiusBottom).toBe(1);
    expect(geometry.parameters.height).toBe(2);
    expect(geometry.parameters.radialSegments).toBe(3);
  });
});
