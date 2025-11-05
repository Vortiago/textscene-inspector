/**
 * Tests for SphereMesh renderer
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createSphereMeshGeometry } from './renderer';
import type { SphereMeshProperties } from './types';

describe('SphereMesh Renderer', () => {
  describe('createSphereMeshGeometry', () => {
    it('should create basic sphere with required radius', () => {
      const properties: SphereMeshProperties = {
        radius: 1.0,
        height: 2.0
      };

      const geometry = createSphereMeshGeometry(properties);

      expect(geometry).toBeInstanceOf(THREE.SphereGeometry);
      expect(geometry.parameters.radius).toBe(1.0);
    });

    it('should use default width segments when not provided', () => {
      const properties: SphereMeshProperties = {
        radius: 1.0,
        height: 2.0
      };

      const geometry = createSphereMeshGeometry(properties);

      expect(geometry.parameters.widthSegments).toBe(32);
    });

    it('should use default height segments when rings not provided', () => {
      const properties: SphereMeshProperties = {
        radius: 1.0,
        height: 2.0
      };

      const geometry = createSphereMeshGeometry(properties);

      expect(geometry.parameters.heightSegments).toBe(16);
    });

    it('should create sphere with custom radial segments', () => {
      const properties: SphereMeshProperties = {
        radius: 1.0,
        height: 2.0,
        radial_segments: 16
      };

      const geometry = createSphereMeshGeometry(properties);

      expect(geometry.parameters.widthSegments).toBe(16);
    });

    it('should create sphere with custom rings (height segments)', () => {
      const properties: SphereMeshProperties = {
        radius: 1.0,
        height: 2.0,
        rings: 8
      };

      const geometry = createSphereMeshGeometry(properties);

      expect(geometry.parameters.heightSegments).toBe(8);
    });

    it('should create sphere with all custom properties', () => {
      const properties: SphereMeshProperties = {
        radius: 2.5,
        height: 5.0,
        radial_segments: 24,
        rings: 12
      };

      const geometry = createSphereMeshGeometry(properties);

      expect(geometry.parameters.radius).toBe(2.5);
      expect(geometry.parameters.widthSegments).toBe(24);
      expect(geometry.parameters.heightSegments).toBe(12);
    });

    it('should handle very small radius', () => {
      const properties: SphereMeshProperties = {
        radius: 0.01,
        height: 0.02
      };

      const geometry = createSphereMeshGeometry(properties);

      expect(geometry.parameters.radius).toBe(0.01);
      expect(geometry).toBeInstanceOf(THREE.SphereGeometry);
    });

    it('should handle very large radius', () => {
      const properties: SphereMeshProperties = {
        radius: 1000,
        height: 2000
      };

      const geometry = createSphereMeshGeometry(properties);

      expect(geometry.parameters.radius).toBe(1000);
    });

    it('should handle low segment count', () => {
      const properties: SphereMeshProperties = {
        radius: 1.0,
        height: 2.0,
        radial_segments: 3,
        rings: 2
      };

      const geometry = createSphereMeshGeometry(properties);

      expect(geometry.parameters.widthSegments).toBe(3);
      expect(geometry.parameters.heightSegments).toBe(2);
    });

    it('should handle high segment count', () => {
      const properties: SphereMeshProperties = {
        radius: 1.0,
        height: 2.0,
        radial_segments: 128,
        rings: 64
      };

      const geometry = createSphereMeshGeometry(properties);

      expect(geometry.parameters.widthSegments).toBe(128);
      expect(geometry.parameters.heightSegments).toBe(64);
    });

    it('should create geometry with valid vertex data', () => {
      const properties: SphereMeshProperties = {
        radius: 1.0,
        height: 2.0,
        radial_segments: 16,
        rings: 8
      };

      const geometry = createSphereMeshGeometry(properties);

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
      const properties: SphereMeshProperties = {
        radius: 1.0,
        height: 2.0
      };

      const geometry = createSphereMeshGeometry(properties);

      expect(geometry.index).toBeDefined();
      expect(geometry.index!.count).toBeGreaterThan(0);
    });

    it('should have bounding sphere calculated', () => {
      const properties: SphereMeshProperties = {
        radius: 1.5,
        height: 3.0
      };

      const geometry = createSphereMeshGeometry(properties);
      geometry.computeBoundingSphere();

      expect(geometry.boundingSphere).toBeDefined();
      expect(geometry.boundingSphere!.radius).toBeCloseTo(1.5, 5);
    });

    it('should have bounding box calculated', () => {
      const properties: SphereMeshProperties = {
        radius: 1.0,
        height: 2.0
      };

      const geometry = createSphereMeshGeometry(properties);
      geometry.computeBoundingBox();

      expect(geometry.boundingBox).toBeDefined();
      expect(geometry.boundingBox!.min).toBeDefined();
      expect(geometry.boundingBox!.max).toBeDefined();
    });

    it('should create uniform sphere (not ellipsoid)', () => {
      const properties: SphereMeshProperties = {
        radius: 2.0,
        height: 5.0 // height property ignored by renderer
      };

      const geometry = createSphereMeshGeometry(properties);
      geometry.computeBoundingBox();

      const bbox = geometry.boundingBox!;
      const extentX = bbox.max.x - bbox.min.x;
      const extentY = bbox.max.y - bbox.min.y;
      const extentZ = bbox.max.z - bbox.min.z;

      // All extents should be approximately equal (uniform sphere)
      expect(extentX).toBeCloseTo(extentY, 1);
      expect(extentY).toBeCloseTo(extentZ, 1);
      expect(extentX).toBeCloseTo(4.0, 1); // diameter = 2 * radius
    });

    it('should create sphere centered at origin', () => {
      const properties: SphereMeshProperties = {
        radius: 1.0,
        height: 2.0
      };

      const geometry = createSphereMeshGeometry(properties);
      geometry.computeBoundingBox();

      const bbox = geometry.boundingBox!;
      const centerX = (bbox.max.x + bbox.min.x) / 2;
      const centerY = (bbox.max.y + bbox.min.y) / 2;
      const centerZ = (bbox.max.z + bbox.min.z) / 2;

      expect(centerX).toBeCloseTo(0, 5);
      expect(centerY).toBeCloseTo(0, 5);
      expect(centerZ).toBeCloseTo(0, 5);
    });

    it('should have default phi and theta ranges (full sphere)', () => {
      const properties: SphereMeshProperties = {
        radius: 1.0,
        height: 2.0
      };

      const geometry = createSphereMeshGeometry(properties);

      // THREE.SphereGeometry defaults create a full sphere
      expect(geometry.parameters.phiStart).toBe(0);
      expect(geometry.parameters.phiLength).toBe(Math.PI * 2);
      expect(geometry.parameters.thetaStart).toBe(0);
      expect(geometry.parameters.thetaLength).toBe(Math.PI);
    });
  });
});
