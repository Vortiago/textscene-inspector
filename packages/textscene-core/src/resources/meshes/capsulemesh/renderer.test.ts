/**
 * Tests for CapsuleMesh renderer
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createCapsuleMeshGeometry } from './renderer';
import type { CapsuleMeshProperties } from './types';

describe('CapsuleMesh Renderer', () => {
  describe('createCapsuleMeshGeometry', () => {
    it('should create basic capsule with standard properties', () => {
      const properties: CapsuleMeshProperties = {
        radius: 0.5,
        height: 2.0,
        radialSegments: 16,
        rings: 4
      };

      const geometry = createCapsuleMeshGeometry(properties);

      expect(geometry).toBeInstanceOf(THREE.CapsuleGeometry);
      expect(geometry.parameters.radius).toBe(0.5);
      expect(geometry.parameters.radialSegments).toBe(16);
      expect(geometry.parameters.capSegments).toBe(4);
    });

    it('should convert Godot height to THREE.js length (height - 2*radius)', () => {
      const properties: CapsuleMeshProperties = {
        radius: 0.5,
        height: 3.0, // Godot height includes caps
        radialSegments: 16,
        rings: 4
      };

      const geometry = createCapsuleMeshGeometry(properties);

      // THREE.js length = height - 2*radius = 3.0 - 2*0.5 = 2.0
      expect(geometry.parameters.length).toBe(2.0);
    });

    it('should handle height exactly equal to 2*radius', () => {
      const properties: CapsuleMeshProperties = {
        radius: 1.0,
        height: 2.0, // height = 2*radius
        radialSegments: 16,
        rings: 4
      };

      const geometry = createCapsuleMeshGeometry(properties);

      // length = 2.0 - 2*1.0 = 0 → clamped to 0.01
      expect(geometry.parameters.length).toBe(0.01);
    });

    it('should clamp negative length to minimum 0.01', () => {
      const properties: CapsuleMeshProperties = {
        radius: 1.0,
        height: 1.5, // height < 2*radius
        radialSegments: 16,
        rings: 4
      };

      const geometry = createCapsuleMeshGeometry(properties);

      // length = 1.5 - 2*1.0 = -0.5 → clamped to 0.01
      expect(geometry.parameters.length).toBe(0.01);
    });

    it('should handle very small radius', () => {
      const properties: CapsuleMeshProperties = {
        radius: 0.01,
        height: 0.1,
        radialSegments: 8,
        rings: 2
      };

      const geometry = createCapsuleMeshGeometry(properties);

      expect(geometry.parameters.radius).toBe(0.01);
      // length = 0.1 - 2*0.01 = 0.08
      expect(geometry.parameters.length).toBe(0.08);
    });

    it('should handle large capsule dimensions', () => {
      const properties: CapsuleMeshProperties = {
        radius: 10.0,
        height: 100.0,
        radialSegments: 32,
        rings: 8
      };

      const geometry = createCapsuleMeshGeometry(properties);

      expect(geometry.parameters.radius).toBe(10.0);
      // length = 100.0 - 2*10.0 = 80.0
      expect(geometry.parameters.length).toBe(80.0);
    });

    it('should handle low radial segment count', () => {
      const properties: CapsuleMeshProperties = {
        radius: 0.5,
        height: 2.0,
        radialSegments: 3,
        rings: 1
      };

      const geometry = createCapsuleMeshGeometry(properties);

      expect(geometry.parameters.radialSegments).toBe(3);
      expect(geometry.parameters.capSegments).toBe(1);
    });

    it('should handle high radial segment count', () => {
      const properties: CapsuleMeshProperties = {
        radius: 0.5,
        height: 2.0,
        radialSegments: 128,
        rings: 32
      };

      const geometry = createCapsuleMeshGeometry(properties);

      expect(geometry.parameters.radialSegments).toBe(128);
      expect(geometry.parameters.capSegments).toBe(32);
    });

    it('should create capsule with custom segments', () => {
      const properties: CapsuleMeshProperties = {
        radius: 1.0,
        height: 4.0,
        radialSegments: 24,
        rings: 6
      };

      const geometry = createCapsuleMeshGeometry(properties);

      expect(geometry.parameters.radialSegments).toBe(24);
      expect(geometry.parameters.capSegments).toBe(6);
    });

    it('should handle capsule with minimal cylinder (mostly spherical)', () => {
      const properties: CapsuleMeshProperties = {
        radius: 1.0,
        height: 2.05, // Just slightly more than 2*radius
        radialSegments: 16,
        rings: 4
      };

      const geometry = createCapsuleMeshGeometry(properties);

      // length = 2.05 - 2*1.0 = 0.05
      expect(geometry.parameters.length).toBeCloseTo(0.05, 5);
    });

    it('should handle capsule with long cylinder', () => {
      const properties: CapsuleMeshProperties = {
        radius: 0.5,
        height: 10.0,
        radialSegments: 16,
        rings: 4
      };

      const geometry = createCapsuleMeshGeometry(properties);

      // length = 10.0 - 2*0.5 = 9.0
      expect(geometry.parameters.length).toBe(9.0);
    });

    it('should create geometry with valid vertex data', () => {
      const properties: CapsuleMeshProperties = {
        radius: 0.5,
        height: 2.0,
        radialSegments: 16,
        rings: 4
      };

      const geometry = createCapsuleMeshGeometry(properties);

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
      const properties: CapsuleMeshProperties = {
        radius: 0.5,
        height: 2.0,
        radialSegments: 16,
        rings: 4
      };

      const geometry = createCapsuleMeshGeometry(properties);

      expect(geometry.index).toBeDefined();
      expect(geometry.index!.count).toBeGreaterThan(0);
    });

    it('should have bounding sphere calculated', () => {
      const properties: CapsuleMeshProperties = {
        radius: 1.0,
        height: 4.0,
        radialSegments: 16,
        rings: 4
      };

      const geometry = createCapsuleMeshGeometry(properties);
      geometry.computeBoundingSphere();

      expect(geometry.boundingSphere).toBeDefined();
      expect(geometry.boundingSphere!.radius).toBeGreaterThan(0);
    });

    it('should have bounding box calculated', () => {
      const properties: CapsuleMeshProperties = {
        radius: 0.5,
        height: 2.0,
        radialSegments: 16,
        rings: 4
      };

      const geometry = createCapsuleMeshGeometry(properties);
      geometry.computeBoundingBox();

      expect(geometry.boundingBox).toBeDefined();
      expect(geometry.boundingBox!.min).toBeDefined();
      expect(geometry.boundingBox!.max).toBeDefined();
    });

    it('should create capsule centered at origin', () => {
      const properties: CapsuleMeshProperties = {
        radius: 0.5,
        height: 3.0,
        radialSegments: 16,
        rings: 4
      };

      const geometry = createCapsuleMeshGeometry(properties);
      geometry.computeBoundingBox();

      const bbox = geometry.boundingBox!;
      const centerX = (bbox.max.x + bbox.min.x) / 2;
      const centerY = (bbox.max.y + bbox.min.y) / 2;
      const centerZ = (bbox.max.z + bbox.min.z) / 2;

      expect(centerX).toBeCloseTo(0, 5);
      expect(centerY).toBeCloseTo(0, 5);
      expect(centerZ).toBeCloseTo(0, 5);
    });

    it('should have correct height including caps', () => {
      const properties: CapsuleMeshProperties = {
        radius: 0.5,
        height: 3.0, // Godot height
        radialSegments: 16,
        rings: 4
      };

      const geometry = createCapsuleMeshGeometry(properties);
      geometry.computeBoundingBox();

      const bbox = geometry.boundingBox!;
      const totalHeight = bbox.max.y - bbox.min.y;

      // Total height should be approximately the Godot height
      // (length + 2*radius = 2.0 + 2*0.5 = 3.0)
      expect(totalHeight).toBeCloseTo(3.0, 1);
    });

    it('should handle fractional dimensions', () => {
      const properties: CapsuleMeshProperties = {
        radius: 0.33,
        height: 2.75,
        radialSegments: 12,
        rings: 5
      };

      const geometry = createCapsuleMeshGeometry(properties);

      expect(geometry.parameters.radius).toBe(0.33);
      // length = 2.75 - 2*0.33 = 2.09
      expect(geometry.parameters.length).toBeCloseTo(2.09, 5);
    });
  });
});
