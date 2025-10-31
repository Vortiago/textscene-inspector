/**
 * Tests for SphereMesh parser and renderer
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { parseSphereMesh } from './parser';
import { createSphereMeshGeometry } from './renderer';

describe('SphereMesh Parser', () => {
  describe('parseSphereMesh', () => {
    it('should parse sphere with all properties', () => {
      const properties = {
        radius: '1.5',
        height: '3.0',
      };

      const result = parseSphereMesh(properties);

      expect(result.radius).toBe(1.5);
      expect(result.height).toBe(3.0);
    });

    it('should use default values when properties are missing', () => {
      const result = parseSphereMesh({});

      expect(result.radius).toBe(0.5);
      expect(result.height).toBe(1.0);
    });

    it('should parse bust head sphere from Hallway scene', () => {
      const properties = {
        radius: '0.15',
      };

      const result = parseSphereMesh(properties);

      expect(result.radius).toBe(0.15);
    });

    it('should handle invalid radius gracefully', () => {
      const properties = {
        radius: 'invalid',
      };

      const result = parseSphereMesh(properties);

      expect(result.radius).toBe(0.5); // default
    });

    it('should parse optional radial_segments', () => {
      const properties = {
        radial_segments: '64',
      };

      const result = parseSphereMesh(properties);

      expect(result.radial_segments).toBe(64);
    });

    it('should parse optional rings', () => {
      const properties = {
        rings: '32',
      };

      const result = parseSphereMesh(properties);

      expect(result.rings).toBe(32);
    });
  });
});

describe('SphereMesh Renderer', () => {
  describe('createSphereMeshGeometry', () => {
    it('should create THREE.SphereGeometry', () => {
      const properties = {
        radius: 1.0,
        height: 2.0,
      };

      const geometry = createSphereMeshGeometry(properties);

      expect(geometry).toBeInstanceOf(THREE.SphereGeometry);
    });

    it('should create geometry with correct radius', () => {
      const properties = {
        radius: 1.5,
        height: 3.0,
      };

      const geometry = createSphereMeshGeometry(properties);

      expect(geometry.parameters.radius).toBe(1.5);
    });

    it('should use default segment values', () => {
      const properties = {
        radius: 1,
        height: 2,
      };

      const geometry = createSphereMeshGeometry(properties);

      expect(geometry.parameters.widthSegments).toBe(32);
      expect(geometry.parameters.heightSegments).toBe(16);
    });

    it('should use provided radial_segments', () => {
      const properties = {
        radius: 1,
        height: 2,
        radial_segments: 64,
      };

      const geometry = createSphereMeshGeometry(properties);

      expect(geometry.parameters.widthSegments).toBe(64);
    });

    it('should create bust head from Hallway scene', () => {
      const properties = {
        radius: 0.15,
        height: 0.3,
      };

      const geometry = createSphereMeshGeometry(properties);

      expect(geometry.parameters.radius).toBe(0.15);
    });
  });
});
