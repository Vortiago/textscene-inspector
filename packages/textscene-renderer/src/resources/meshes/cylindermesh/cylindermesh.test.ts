/**
 * Tests for CylinderMesh parser and renderer
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { parseCylinderMesh } from './parser';
import { createCylinderMeshGeometry } from './renderer';

describe('CylinderMesh Parser', () => {
  describe('parseCylinderMesh', () => {
    it('should parse cylinder with all properties', () => {
      const properties = {
        top_radius: '0.5',
        bottom_radius: '1.0',
        height: '2.0',
      };

      const result = parseCylinderMesh(properties);

      expect(result.top_radius).toBe(0.5);
      expect(result.bottom_radius).toBe(1.0);
      expect(result.height).toBe(2.0);
    });

    it('should use default values when properties are missing', () => {
      const result = parseCylinderMesh({});

      expect(result.top_radius).toBe(0.5);
      expect(result.bottom_radius).toBe(0.5);
      expect(result.height).toBe(2.0);
    });

    it('should parse vase cylinder from Hallway scene', () => {
      const properties = {
        top_radius: '0.05',
        bottom_radius: '0.08',
        height: '0.3',
      };

      const result = parseCylinderMesh(properties);

      expect(result.top_radius).toBe(0.05);
      expect(result.bottom_radius).toBe(0.08);
      expect(result.height).toBe(0.3);
    });

    it('should parse blood pool cylinder from Hallway scene', () => {
      const properties = {
        top_radius: '0.6',
        bottom_radius: '0.6',
        height: '0.02',
      };

      const result = parseCylinderMesh(properties);

      expect(result.top_radius).toBe(0.6);
      expect(result.bottom_radius).toBe(0.6);
      expect(result.height).toBe(0.02);
    });

    it('should handle decimal values correctly', () => {
      const properties = {
        top_radius: '0.123456',
        bottom_radius: '0.789012',
        height: '1.5',
      };

      const result = parseCylinderMesh(properties);

      expect(result.top_radius).toBeCloseTo(0.123456);
      expect(result.bottom_radius).toBeCloseTo(0.789012);
      expect(result.height).toBe(1.5);
    });

    it('should parse optional radial_segments', () => {
      const properties = {
        radial_segments: '64',
      };

      const result = parseCylinderMesh(properties);

      expect(result.radial_segments).toBe(64);
    });

    it('should parse optional rings', () => {
      const properties = {
        rings: '10',
      };

      const result = parseCylinderMesh(properties);

      expect(result.rings).toBe(10);
    });

    it('should handle invalid top_radius gracefully', () => {
      const properties = {
        top_radius: 'invalid',
      };

      const result = parseCylinderMesh(properties);

      expect(result.top_radius).toBe(0.5); // default
    });

    it('should handle invalid bottom_radius gracefully', () => {
      const properties = {
        bottom_radius: 'not_a_number',
      };

      const result = parseCylinderMesh(properties);

      expect(result.bottom_radius).toBe(0.5); // default
    });

    it('should handle invalid height gracefully', () => {
      const properties = {
        height: 'NaN',
      };

      const result = parseCylinderMesh(properties);

      expect(result.height).toBe(2.0); // default
    });

    it('should parse cone (top_radius = 0)', () => {
      const properties = {
        top_radius: '0',
        bottom_radius: '1',
        height: '2',
      };

      const result = parseCylinderMesh(properties);

      expect(result.top_radius).toBe(0);
      expect(result.bottom_radius).toBe(1);
    });

    it('should parse inverted cone (bottom_radius = 0)', () => {
      const properties = {
        top_radius: '1',
        bottom_radius: '0',
        height: '2',
      };

      const result = parseCylinderMesh(properties);

      expect(result.top_radius).toBe(1);
      expect(result.bottom_radius).toBe(0);
    });
  });
});

describe('CylinderMesh Renderer', () => {
  describe('createCylinderMeshGeometry', () => {
    it('should create THREE.CylinderGeometry', () => {
      const properties = {
        top_radius: 0.5,
        bottom_radius: 1.0,
        height: 2.0,
      };

      const geometry = createCylinderMeshGeometry(properties);

      expect(geometry).toBeInstanceOf(THREE.CylinderGeometry);
    });

    it('should create geometry with correct dimensions', () => {
      const properties = {
        top_radius: 0.5,
        bottom_radius: 1.5,
        height: 3.0,
      };

      const geometry = createCylinderMeshGeometry(properties);

      // Access the parameters from THREE.CylinderGeometry
      expect(geometry.parameters.radiusTop).toBe(0.5);
      expect(geometry.parameters.radiusBottom).toBe(1.5);
      expect(geometry.parameters.height).toBe(3.0);
    });

    it('should use default segment values when not specified', () => {
      const properties = {
        top_radius: 1,
        bottom_radius: 1,
        height: 2,
      };

      const geometry = createCylinderMeshGeometry(properties);

      expect(geometry.parameters.radialSegments).toBe(32);
      expect(geometry.parameters.heightSegments).toBe(1);
    });

    it('should use provided radial_segments', () => {
      const properties = {
        top_radius: 1,
        bottom_radius: 1,
        height: 2,
        radial_segments: 64,
      };

      const geometry = createCylinderMeshGeometry(properties);

      expect(geometry.parameters.radialSegments).toBe(64);
    });

    it('should use provided rings for heightSegments', () => {
      const properties = {
        top_radius: 1,
        bottom_radius: 1,
        height: 2,
        rings: 10,
      };

      const geometry = createCylinderMeshGeometry(properties);

      expect(geometry.parameters.heightSegments).toBe(10);
    });

    it('should create cone geometry (top_radius = 0)', () => {
      const properties = {
        top_radius: 0,
        bottom_radius: 1,
        height: 2,
      };

      const geometry = createCylinderMeshGeometry(properties);

      expect(geometry.parameters.radiusTop).toBe(0);
      expect(geometry.parameters.radiusBottom).toBe(1);
    });

    it('should create vase geometry from Hallway scene', () => {
      const properties = {
        top_radius: 0.05,
        bottom_radius: 0.08,
        height: 0.3,
      };

      const geometry = createCylinderMeshGeometry(properties);

      expect(geometry.parameters.radiusTop).toBe(0.05);
      expect(geometry.parameters.radiusBottom).toBe(0.08);
      expect(geometry.parameters.height).toBe(0.3);
    });

    it('should create blood pool geometry from Hallway scene', () => {
      const properties = {
        top_radius: 0.6,
        bottom_radius: 0.6,
        height: 0.02,
      };

      const geometry = createCylinderMeshGeometry(properties);

      expect(geometry.parameters.radiusTop).toBe(0.6);
      expect(geometry.parameters.radiusBottom).toBe(0.6);
      expect(geometry.parameters.height).toBe(0.02);
    });
  });
});
