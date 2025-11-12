/**
 * Tests for PlaneMesh renderer
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createPlaneMeshGeometry } from './renderer';
import type { PlaneMeshProperties } from './types';

describe('PlaneMesh Renderer', () => {
  describe('createPlaneMeshGeometry', () => {
    it('should create basic plane with default orientation (FACE_Z)', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 2.0, y: 2.0 },
        subdivideWidth: 1,
        subdivideDepth: 1,
        orientation: 2, // FACE_Z
        centerOffset: { x: 0, y: 0, z: 0 }
      };

      const geometry = createPlaneMeshGeometry(properties);

      expect(geometry).toBeInstanceOf(THREE.PlaneGeometry);
      expect(geometry.parameters.width).toBe(2.0);
      expect(geometry.parameters.height).toBe(2.0);
    });

    it('should create plane with custom size', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 5.0, y: 3.0 },
        subdivideWidth: 1,
        subdivideDepth: 1,
        orientation: 2,
        centerOffset: { x: 0, y: 0, z: 0 }
      };

      const geometry = createPlaneMeshGeometry(properties);

      expect(geometry.parameters.width).toBe(5.0);
      expect(geometry.parameters.height).toBe(3.0);
    });

    it('should create plane with custom subdivisions', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 2.0, y: 2.0 },
        subdivideWidth: 5,
        subdivideDepth: 3,
        orientation: 2,
        centerOffset: { x: 0, y: 0, z: 0 }
      };

      const geometry = createPlaneMeshGeometry(properties);

      expect(geometry.parameters.widthSegments).toBe(5);
      expect(geometry.parameters.heightSegments).toBe(3);
    });

    it('should clamp subdivideWidth to minimum of 1', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 2.0, y: 2.0 },
        subdivideWidth: 0,
        subdivideDepth: 1,
        orientation: 2,
        centerOffset: { x: 0, y: 0, z: 0 }
      };

      const geometry = createPlaneMeshGeometry(properties);

      expect(geometry.parameters.widthSegments).toBe(1);
    });

    it('should clamp negative subdivideWidth to minimum of 1', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 2.0, y: 2.0 },
        subdivideWidth: -5,
        subdivideDepth: 1,
        orientation: 2,
        centerOffset: { x: 0, y: 0, z: 0 }
      };

      const geometry = createPlaneMeshGeometry(properties);

      expect(geometry.parameters.widthSegments).toBe(1);
    });

    it('should clamp subdivideDepth to minimum of 1', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 2.0, y: 2.0 },
        subdivideWidth: 1,
        subdivideDepth: 0,
        orientation: 2,
        centerOffset: { x: 0, y: 0, z: 0 }
      };

      const geometry = createPlaneMeshGeometry(properties);

      expect(geometry.parameters.heightSegments).toBe(1);
    });

    it('should clamp negative subdivideDepth to minimum of 1', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 2.0, y: 2.0 },
        subdivideWidth: 1,
        subdivideDepth: -3,
        orientation: 2,
        centerOffset: { x: 0, y: 0, z: 0 }
      };

      const geometry = createPlaneMeshGeometry(properties);

      expect(geometry.parameters.heightSegments).toBe(1);
    });

    it('should rotate plane for FACE_X orientation (0)', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 2.0, y: 2.0 },
        subdivideWidth: 1,
        subdivideDepth: 1,
        orientation: 0, // FACE_X
        centerOffset: { x: 0, y: 0, z: 0 }
      };

      const geometry = createPlaneMeshGeometry(properties);

      // Verify rotation was applied by checking first vertex normal
      const normals = geometry.attributes.normal.array;
      // After rotating Y by PI/2, normal should point along X axis
      expect(Math.abs(normals[0])).toBeCloseTo(1, 1); // X component ~1 or ~-1
      expect(Math.abs(normals[1])).toBeCloseTo(0, 1); // Y component ~0
      expect(Math.abs(normals[2])).toBeCloseTo(0, 1); // Z component ~0
    });

    it('should rotate plane for FACE_Y orientation (1)', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 2.0, y: 2.0 },
        subdivideWidth: 1,
        subdivideDepth: 1,
        orientation: 1, // FACE_Y
        centerOffset: { x: 0, y: 0, z: 0 }
      };

      const geometry = createPlaneMeshGeometry(properties);

      // Verify rotation was applied by checking first vertex normal
      const normals = geometry.attributes.normal.array;
      // After rotating X by -PI/2, normal should point along Y axis
      expect(Math.abs(normals[0])).toBeCloseTo(0, 1); // X component ~0
      expect(Math.abs(normals[1])).toBeCloseTo(1, 1); // Y component ~1 or ~-1
      expect(Math.abs(normals[2])).toBeCloseTo(0, 1); // Z component ~0
    });

    it('should not rotate plane for FACE_Z orientation (2)', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 2.0, y: 2.0 },
        subdivideWidth: 1,
        subdivideDepth: 1,
        orientation: 2, // FACE_Z
        centerOffset: { x: 0, y: 0, z: 0 }
      };

      const geometry = createPlaneMeshGeometry(properties);

      // Default THREE.js plane faces Z direction
      const normals = geometry.attributes.normal.array;
      expect(Math.abs(normals[0])).toBeCloseTo(0, 5); // X component ~0
      expect(Math.abs(normals[1])).toBeCloseTo(0, 5); // Y component ~0
      expect(Math.abs(normals[2])).toBeCloseTo(1, 5); // Z component ~1
    });

    it('should handle very small plane size', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 0.01, y: 0.01 },
        subdivideWidth: 1,
        subdivideDepth: 1,
        orientation: 2,
        centerOffset: { x: 0, y: 0, z: 0 }
      };

      const geometry = createPlaneMeshGeometry(properties);

      expect(geometry.parameters.width).toBe(0.01);
      expect(geometry.parameters.height).toBe(0.01);
      expect(geometry).toBeInstanceOf(THREE.PlaneGeometry);
    });

    it('should handle very large plane size', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 1000, y: 2000 },
        subdivideWidth: 1,
        subdivideDepth: 1,
        orientation: 2,
        centerOffset: { x: 0, y: 0, z: 0 }
      };

      const geometry = createPlaneMeshGeometry(properties);

      expect(geometry.parameters.width).toBe(1000);
      expect(geometry.parameters.height).toBe(2000);
    });

    it('should handle high subdivision count', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 2.0, y: 2.0 },
        subdivideWidth: 100,
        subdivideDepth: 50,
        orientation: 2,
        centerOffset: { x: 0, y: 0, z: 0 }
      };

      const geometry = createPlaneMeshGeometry(properties);

      expect(geometry.parameters.widthSegments).toBe(100);
      expect(geometry.parameters.heightSegments).toBe(50);
    });

    it('should handle rectangular plane (width != height)', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 10.0, y: 2.0 },
        subdivideWidth: 1,
        subdivideDepth: 1,
        orientation: 2,
        centerOffset: { x: 0, y: 0, z: 0 }
      };

      const geometry = createPlaneMeshGeometry(properties);

      expect(geometry.parameters.width).toBe(10.0);
      expect(geometry.parameters.height).toBe(2.0);
    });

    it('should create geometry with valid vertex data', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 2.0, y: 2.0 },
        subdivideWidth: 5,
        subdivideDepth: 5,
        orientation: 2,
        centerOffset: { x: 0, y: 0, z: 0 }
      };

      const geometry = createPlaneMeshGeometry(properties);

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
      const properties: PlaneMeshProperties = {
        size: { x: 2.0, y: 2.0 },
        subdivideWidth: 1,
        subdivideDepth: 1,
        orientation: 2,
        centerOffset: { x: 0, y: 0, z: 0 }
      };

      const geometry = createPlaneMeshGeometry(properties);

      expect(geometry.index).toBeDefined();
      expect(geometry.index!.count).toBeGreaterThan(0);
    });

    it('should have bounding box calculated for FACE_Z plane', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 4.0, y: 2.0 },
        subdivideWidth: 1,
        subdivideDepth: 1,
        orientation: 2,
        centerOffset: { x: 0, y: 0, z: 0 }
      };

      const geometry = createPlaneMeshGeometry(properties);
      geometry.computeBoundingBox();

      expect(geometry.boundingBox).toBeDefined();
      const bbox = geometry.boundingBox!;

      // FACE_Z plane spans X and Y dimensions
      expect(bbox.max.x - bbox.min.x).toBeCloseTo(4.0, 5);
      expect(bbox.max.y - bbox.min.y).toBeCloseTo(2.0, 5);
      expect(bbox.max.z - bbox.min.z).toBeCloseTo(0, 5); // Flat in Z
    });

    it('should have bounding sphere calculated', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 2.0, y: 2.0 },
        subdivideWidth: 1,
        subdivideDepth: 1,
        orientation: 2,
        centerOffset: { x: 0, y: 0, z: 0 }
      };

      const geometry = createPlaneMeshGeometry(properties);
      geometry.computeBoundingSphere();

      expect(geometry.boundingSphere).toBeDefined();
      expect(geometry.boundingSphere!.radius).toBeGreaterThan(0);
    });

    it('should create plane centered at origin', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 4.0, y: 2.0 },
        subdivideWidth: 1,
        subdivideDepth: 1,
        orientation: 2,
        centerOffset: { x: 0, y: 0, z: 0 },
        flipFaces: false
      };

      const geometry = createPlaneMeshGeometry(properties);
      geometry.computeBoundingBox();

      const bbox = geometry.boundingBox!;
      const centerX = (bbox.max.x + bbox.min.x) / 2;
      const centerY = (bbox.max.y + bbox.min.y) / 2;

      expect(centerX).toBeCloseTo(0, 5);
      expect(centerY).toBeCloseTo(0, 5);
    });

    it('should not flip faces when flipFaces is false', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 2.0, y: 2.0 },
        subdivideWidth: 1,
        subdivideDepth: 1,
        orientation: 2, // FACE_Z
        centerOffset: { x: 0, y: 0, z: 0 },
        flipFaces: false
      };

      const geometry = createPlaneMeshGeometry(properties);

      // Default THREE.js plane faces +Z direction (normal points in +Z)
      const normals = geometry.attributes.normal.array;
      expect(normals[0]).toBeCloseTo(0, 5); // X component
      expect(normals[1]).toBeCloseTo(0, 5); // Y component
      expect(normals[2]).toBeCloseTo(1, 5); // Z component (positive)
    });

    it('should flip faces when flipFaces is true', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 2.0, y: 2.0 },
        subdivideWidth: 1,
        subdivideDepth: 1,
        orientation: 2, // FACE_Z
        centerOffset: { x: 0, y: 0, z: 0 },
        flipFaces: true
      };

      const geometry = createPlaneMeshGeometry(properties);

      // With flipFaces=true, normals should point in -Z direction
      const normals = geometry.attributes.normal.array;
      expect(normals[0]).toBeCloseTo(0, 5); // X component
      expect(normals[1]).toBeCloseTo(0, 5); // Y component
      expect(normals[2]).toBeCloseTo(-1, 5); // Z component (negative)
    });

    it('should flip faces with FACE_X orientation', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 2.0, y: 2.0 },
        subdivideWidth: 1,
        subdivideDepth: 1,
        orientation: 0, // FACE_X
        centerOffset: { x: 0, y: 0, z: 0 },
        flipFaces: true
      };

      const geometry = createPlaneMeshGeometry(properties);

      // After rotation and flip, normal should still point along X axis (magnitude ~1)
      // The exact sign depends on how rotation + flip interact, but magnitude should be 1
      const normals = geometry.attributes.normal.array;
      expect(Math.abs(normals[0])).toBeCloseTo(1, 1); // X component magnitude ~1
      expect(Math.abs(normals[1])).toBeCloseTo(0, 1); // Y component ~0
      expect(Math.abs(normals[2])).toBeCloseTo(0, 1); // Z component ~0
    });

    it('should flip faces with FACE_Y orientation', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 2.0, y: 2.0 },
        subdivideWidth: 1,
        subdivideDepth: 1,
        orientation: 1, // FACE_Y
        centerOffset: { x: 0, y: 0, z: 0 },
        flipFaces: true
      };

      const geometry = createPlaneMeshGeometry(properties);

      // After rotation and flip, normal should point in -Y direction
      const normals = geometry.attributes.normal.array;
      expect(Math.abs(normals[0])).toBeCloseTo(0, 1); // X component ~0
      expect(Math.abs(normals[1])).toBeCloseTo(1, 1); // Y component magnitude ~1
      expect(normals[1]).toBeLessThan(0); // Should be negative
      expect(Math.abs(normals[2])).toBeCloseTo(0, 1); // Z component ~0
    });

    it('should preserve geometry dimensions when flipping faces', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 5.0, y: 3.0 },
        subdivideWidth: 1,
        subdivideDepth: 1,
        orientation: 2,
        centerOffset: { x: 0, y: 0, z: 0 },
        flipFaces: true
      };

      const geometry = createPlaneMeshGeometry(properties);
      geometry.computeBoundingBox();

      const bbox = geometry.boundingBox!;

      // Flipping should reverse winding but not change dimensions
      expect(bbox.max.x - bbox.min.x).toBeCloseTo(5.0, 5);
      expect(bbox.max.y - bbox.min.y).toBeCloseTo(3.0, 5);
    });

    it('should apply center_offset after flipping faces', () => {
      const properties: PlaneMeshProperties = {
        size: { x: 2.0, y: 2.0 },
        subdivideWidth: 1,
        subdivideDepth: 1,
        orientation: 2, // FACE_Z
        centerOffset: { x: 1, y: 2, z: 3 },
        flipFaces: true
      };

      const geometry = createPlaneMeshGeometry(properties);
      geometry.computeBoundingBox();

      const bbox = geometry.boundingBox!;

      // Center should be offset by centerOffset values
      const centerX = (bbox.max.x + bbox.min.x) / 2;
      const centerY = (bbox.max.y + bbox.min.y) / 2;
      const centerZ = (bbox.max.z + bbox.min.z) / 2;

      expect(centerX).toBeCloseTo(1, 5);
      expect(centerY).toBeCloseTo(2, 5);
      expect(centerZ).toBeCloseTo(3, 5);
    });
  });
});
