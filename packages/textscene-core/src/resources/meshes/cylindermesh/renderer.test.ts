/**
 * Tests for CylinderMesh renderer
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createCylinderMeshGeometry } from './renderer';
import type { CylinderMeshProperties } from './types';

describe('CylinderMesh Renderer', () => {
  describe('createCylinderMeshGeometry', () => {
    it('should create basic cylinder with required properties', () => {
      const properties: CylinderMeshProperties = {
        top_radius: 1.0,
        bottom_radius: 1.0,
        height: 2.0
      };

      const geometry = createCylinderMeshGeometry(properties);

      expect(geometry).toBeInstanceOf(THREE.CylinderGeometry);
      expect(geometry.parameters.radiusTop).toBe(1.0);
      expect(geometry.parameters.radiusBottom).toBe(1.0);
      expect(geometry.parameters.height).toBe(2.0);
    });

    it('should use default radial segments when not provided', () => {
      const properties: CylinderMeshProperties = {
        top_radius: 1.0,
        bottom_radius: 1.0,
        height: 2.0
      };

      const geometry = createCylinderMeshGeometry(properties);

      expect(geometry.parameters.radialSegments).toBe(32); // THREE.js default
    });

    it('should use default height segments when rings not provided', () => {
      const properties: CylinderMeshProperties = {
        top_radius: 1.0,
        bottom_radius: 1.0,
        height: 2.0
      };

      const geometry = createCylinderMeshGeometry(properties);

      expect(geometry.parameters.heightSegments).toBe(1); // THREE.js default
    });

    it('should create cylinder with custom radial segments', () => {
      const properties: CylinderMeshProperties = {
        top_radius: 1.0,
        bottom_radius: 1.0,
        height: 2.0,
        radial_segments: 16
      };

      const geometry = createCylinderMeshGeometry(properties);

      expect(geometry.parameters.radialSegments).toBe(16);
    });

    it('should create cylinder with custom rings (height segments)', () => {
      const properties: CylinderMeshProperties = {
        top_radius: 1.0,
        bottom_radius: 1.0,
        height: 2.0,
        rings: 5
      };

      const geometry = createCylinderMeshGeometry(properties);

      expect(geometry.parameters.heightSegments).toBe(5);
    });

    it('should create cylinder with all custom properties', () => {
      const properties: CylinderMeshProperties = {
        top_radius: 0.5,
        bottom_radius: 1.5,
        height: 3.0,
        radial_segments: 24,
        rings: 3
      };

      const geometry = createCylinderMeshGeometry(properties);

      expect(geometry.parameters.radiusTop).toBe(0.5);
      expect(geometry.parameters.radiusBottom).toBe(1.5);
      expect(geometry.parameters.height).toBe(3.0);
      expect(geometry.parameters.radialSegments).toBe(24);
      expect(geometry.parameters.heightSegments).toBe(3);
    });

    it('should create cone shape when top_radius is 0', () => {
      const properties: CylinderMeshProperties = {
        top_radius: 0,
        bottom_radius: 1.0,
        height: 2.0
      };

      const geometry = createCylinderMeshGeometry(properties);

      expect(geometry.parameters.radiusTop).toBe(0);
      expect(geometry.parameters.radiusBottom).toBe(1.0);
      expect(geometry).toBeInstanceOf(THREE.CylinderGeometry);
    });

    it('should create inverted cone when bottom_radius is 0', () => {
      const properties: CylinderMeshProperties = {
        top_radius: 1.0,
        bottom_radius: 0,
        height: 2.0
      };

      const geometry = createCylinderMeshGeometry(properties);

      expect(geometry.parameters.radiusTop).toBe(1.0);
      expect(geometry.parameters.radiusBottom).toBe(0);
    });

    it('should handle different top and bottom radii', () => {
      const properties: CylinderMeshProperties = {
        top_radius: 2.0,
        bottom_radius: 1.0,
        height: 3.0
      };

      const geometry = createCylinderMeshGeometry(properties);

      expect(geometry.parameters.radiusTop).toBe(2.0);
      expect(geometry.parameters.radiusBottom).toBe(1.0);
    });

    it('should handle very small dimensions', () => {
      const properties: CylinderMeshProperties = {
        top_radius: 0.01,
        bottom_radius: 0.01,
        height: 0.01
      };

      const geometry = createCylinderMeshGeometry(properties);

      expect(geometry.parameters.radiusTop).toBe(0.01);
      expect(geometry.parameters.radiusBottom).toBe(0.01);
      expect(geometry.parameters.height).toBe(0.01);
    });

    it('should handle very large dimensions', () => {
      const properties: CylinderMeshProperties = {
        top_radius: 1000,
        bottom_radius: 1000,
        height: 2000
      };

      const geometry = createCylinderMeshGeometry(properties);

      expect(geometry.parameters.radiusTop).toBe(1000);
      expect(geometry.parameters.radiusBottom).toBe(1000);
      expect(geometry.parameters.height).toBe(2000);
    });

    it('should handle low segment count', () => {
      const properties: CylinderMeshProperties = {
        top_radius: 1.0,
        bottom_radius: 1.0,
        height: 2.0,
        radial_segments: 3,
        rings: 1
      };

      const geometry = createCylinderMeshGeometry(properties);

      expect(geometry.parameters.radialSegments).toBe(3);
      expect(geometry.parameters.heightSegments).toBe(1);
    });

    it('should handle high segment count', () => {
      const properties: CylinderMeshProperties = {
        top_radius: 1.0,
        bottom_radius: 1.0,
        height: 2.0,
        radial_segments: 128,
        rings: 20
      };

      const geometry = createCylinderMeshGeometry(properties);

      expect(geometry.parameters.radialSegments).toBe(128);
      expect(geometry.parameters.heightSegments).toBe(20);
    });

    it('should create geometry with valid vertex data', () => {
      const properties: CylinderMeshProperties = {
        top_radius: 1.0,
        bottom_radius: 1.0,
        height: 2.0,
        radial_segments: 16,
        rings: 2
      };

      const geometry = createCylinderMeshGeometry(properties);

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
      const properties: CylinderMeshProperties = {
        top_radius: 1.0,
        bottom_radius: 1.0,
        height: 2.0
      };

      const geometry = createCylinderMeshGeometry(properties);

      expect(geometry.index).toBeDefined();
      expect(geometry.index!.count).toBeGreaterThan(0);
    });

    it('should have bounding sphere calculated', () => {
      const properties: CylinderMeshProperties = {
        top_radius: 1.0,
        bottom_radius: 1.0,
        height: 2.0
      };

      const geometry = createCylinderMeshGeometry(properties);
      geometry.computeBoundingSphere();

      expect(geometry.boundingSphere).toBeDefined();
      expect(geometry.boundingSphere!.radius).toBeGreaterThan(0);
    });

    it('should have bounding box calculated', () => {
      const properties: CylinderMeshProperties = {
        top_radius: 1.0,
        bottom_radius: 1.0,
        height: 2.0
      };

      const geometry = createCylinderMeshGeometry(properties);
      geometry.computeBoundingBox();

      expect(geometry.boundingBox).toBeDefined();
      expect(geometry.boundingBox!.min).toBeDefined();
      expect(geometry.boundingBox!.max).toBeDefined();
    });
  });
});
