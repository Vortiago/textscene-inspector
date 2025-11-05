/**
 * Tests for TorusMesh renderer
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createTorusMeshGeometry } from './renderer';
import type { TorusMeshProperties } from './types';

describe('TorusMesh Renderer', () => {
  describe('createTorusMeshGeometry', () => {
    it('should create basic torus with standard properties', () => {
      const properties: TorusMeshProperties = {
        innerRadius: 0.5,
        outerRadius: 1.0,
        rings: 16,
        ringSegments: 8
      };

      const geometry = createTorusMeshGeometry(properties);

      expect(geometry).toBeInstanceOf(THREE.TorusGeometry);
      expect(geometry.parameters.tubularSegments).toBe(16);
      expect(geometry.parameters.radialSegments).toBe(8);
    });

    it('should convert inner/outer radii to center radius', () => {
      const properties: TorusMeshProperties = {
        innerRadius: 0.5,
        outerRadius: 1.5,
        rings: 16,
        ringSegments: 8
      };

      const geometry = createTorusMeshGeometry(properties);

      // Center radius = (1.5 + 0.5) / 2 = 1.0
      expect(geometry.parameters.radius).toBe(1.0);
    });

    it('should convert inner/outer radii to tube radius', () => {
      const properties: TorusMeshProperties = {
        innerRadius: 0.5,
        outerRadius: 1.5,
        rings: 16,
        ringSegments: 8
      };

      const geometry = createTorusMeshGeometry(properties);

      // Tube radius = (1.5 - 0.5) / 2 = 0.5
      expect(geometry.parameters.tube).toBe(0.5);
    });

    it('should handle equal inner and outer radii (zero tube)', () => {
      const properties: TorusMeshProperties = {
        innerRadius: 1.0,
        outerRadius: 1.0,
        rings: 16,
        ringSegments: 8
      };

      const geometry = createTorusMeshGeometry(properties);

      // Center radius = (1.0 + 1.0) / 2 = 1.0
      expect(geometry.parameters.radius).toBe(1.0);
      // Tube radius = (1.0 - 1.0) / 2 = 0
      expect(geometry.parameters.tube).toBe(0);
    });

    it('should handle very small inner radius', () => {
      const properties: TorusMeshProperties = {
        innerRadius: 0.1,
        outerRadius: 2.0,
        rings: 16,
        ringSegments: 8
      };

      const geometry = createTorusMeshGeometry(properties);

      // Center radius = (2.0 + 0.1) / 2 = 1.05
      expect(geometry.parameters.radius).toBe(1.05);
      // Tube radius = (2.0 - 0.1) / 2 = 0.95
      expect(geometry.parameters.tube).toBe(0.95);
    });

    it('should handle large torus dimensions', () => {
      const properties: TorusMeshProperties = {
        innerRadius: 50.0,
        outerRadius: 100.0,
        rings: 32,
        ringSegments: 16
      };

      const geometry = createTorusMeshGeometry(properties);

      // Center radius = (100.0 + 50.0) / 2 = 75.0
      expect(geometry.parameters.radius).toBe(75.0);
      // Tube radius = (100.0 - 50.0) / 2 = 25.0
      expect(geometry.parameters.tube).toBe(25.0);
    });

    it('should handle thin torus (small difference between radii)', () => {
      const properties: TorusMeshProperties = {
        innerRadius: 0.9,
        outerRadius: 1.1,
        rings: 16,
        ringSegments: 8
      };

      const geometry = createTorusMeshGeometry(properties);

      // Center radius = (1.1 + 0.9) / 2 = 1.0
      expect(geometry.parameters.radius).toBe(1.0);
      // Tube radius = (1.1 - 0.9) / 2 = 0.1
      expect(geometry.parameters.tube).toBeCloseTo(0.1, 5);
    });

    it('should handle thick torus (large difference between radii)', () => {
      const properties: TorusMeshProperties = {
        innerRadius: 1.0,
        outerRadius: 10.0,
        rings: 16,
        ringSegments: 8
      };

      const geometry = createTorusMeshGeometry(properties);

      // Center radius = (10.0 + 1.0) / 2 = 5.5
      expect(geometry.parameters.radius).toBe(5.5);
      // Tube radius = (10.0 - 1.0) / 2 = 4.5
      expect(geometry.parameters.tube).toBe(4.5);
    });

    it('should handle low ring count', () => {
      const properties: TorusMeshProperties = {
        innerRadius: 0.5,
        outerRadius: 1.0,
        rings: 3,
        ringSegments: 3
      };

      const geometry = createTorusMeshGeometry(properties);

      expect(geometry.parameters.tubularSegments).toBe(3);
      expect(geometry.parameters.radialSegments).toBe(3);
    });

    it('should handle high ring count', () => {
      const properties: TorusMeshProperties = {
        innerRadius: 0.5,
        outerRadius: 1.0,
        rings: 128,
        ringSegments: 64
      };

      const geometry = createTorusMeshGeometry(properties);

      expect(geometry.parameters.tubularSegments).toBe(128);
      expect(geometry.parameters.radialSegments).toBe(64);
    });

    it('should create torus with custom segments', () => {
      const properties: TorusMeshProperties = {
        innerRadius: 0.5,
        outerRadius: 1.0,
        rings: 24,
        ringSegments: 12
      };

      const geometry = createTorusMeshGeometry(properties);

      expect(geometry.parameters.tubularSegments).toBe(24);
      expect(geometry.parameters.radialSegments).toBe(12);
    });

    it('should create geometry with valid vertex data', () => {
      const properties: TorusMeshProperties = {
        innerRadius: 0.5,
        outerRadius: 1.0,
        rings: 16,
        ringSegments: 8
      };

      const geometry = createTorusMeshGeometry(properties);

      // Verify geometry has positions attribute
      expect(geometry.attributes.position).toBeDefined();
      expect(geometry.attributes.position.count).toBeGreaterThan(0);

      // Verify geometry has normals
      expect(geometry.attributes.normal).toBeDefined();
      expect(geometry.attributes.normal.count).toBeGreaterThan(0);

      // Verify geometry has UVs
      expect(geometry.attributes.uv).toBeDefined();
      expect(geometry.attributes.uv.count).toBeGreaterThan(0);
    });

    it('should create geometry with index buffer', () => {
      const properties: TorusMeshProperties = {
        innerRadius: 0.5,
        outerRadius: 1.0,
        rings: 16,
        ringSegments: 8
      };

      const geometry = createTorusMeshGeometry(properties);

      expect(geometry.index).toBeDefined();
      expect(geometry.index!.count).toBeGreaterThan(0);
    });

    it('should have bounding sphere calculated', () => {
      const properties: TorusMeshProperties = {
        innerRadius: 0.5,
        outerRadius: 1.0,
        rings: 16,
        ringSegments: 8
      };

      const geometry = createTorusMeshGeometry(properties);
      geometry.computeBoundingSphere();

      expect(geometry.boundingSphere).toBeDefined();
      expect(geometry.boundingSphere!.radius).toBeGreaterThan(0);
      // Bounding sphere radius should be approximately outer radius
      expect(geometry.boundingSphere!.radius).toBeCloseTo(1.0, 1);
    });

    it('should have bounding box calculated', () => {
      const properties: TorusMeshProperties = {
        innerRadius: 0.5,
        outerRadius: 1.0,
        rings: 16,
        ringSegments: 8
      };

      const geometry = createTorusMeshGeometry(properties);
      geometry.computeBoundingBox();

      expect(geometry.boundingBox).toBeDefined();
      expect(geometry.boundingBox!.min).toBeDefined();
      expect(geometry.boundingBox!.max).toBeDefined();
    });

    it('should create torus centered at origin', () => {
      const properties: TorusMeshProperties = {
        innerRadius: 0.5,
        outerRadius: 1.0,
        rings: 16,
        ringSegments: 8
      };

      const geometry = createTorusMeshGeometry(properties);
      geometry.computeBoundingBox();

      const bbox = geometry.boundingBox!;
      const centerX = (bbox.max.x + bbox.min.x) / 2;
      const centerY = (bbox.max.y + bbox.min.y) / 2;
      const centerZ = (bbox.max.z + bbox.min.z) / 2;

      expect(centerX).toBeCloseTo(0, 5);
      expect(centerY).toBeCloseTo(0, 5);
      expect(centerZ).toBeCloseTo(0, 5);
    });

    it('should have default arc parameters (full torus)', () => {
      const properties: TorusMeshProperties = {
        innerRadius: 0.5,
        outerRadius: 1.0,
        rings: 16,
        ringSegments: 8
      };

      const geometry = createTorusMeshGeometry(properties);

      // THREE.TorusGeometry defaults to full torus (arc = 2π)
      expect(geometry.parameters.arc).toBe(Math.PI * 2);
    });

    it('should handle fractional dimensions', () => {
      const properties: TorusMeshProperties = {
        innerRadius: 0.33,
        outerRadius: 0.77,
        rings: 20,
        ringSegments: 10
      };

      const geometry = createTorusMeshGeometry(properties);

      // Center radius = (0.77 + 0.33) / 2 = 0.55
      expect(geometry.parameters.radius).toBeCloseTo(0.55, 5);
      // Tube radius = (0.77 - 0.33) / 2 = 0.22
      expect(geometry.parameters.tube).toBeCloseTo(0.22, 5);
    });
  });
});
