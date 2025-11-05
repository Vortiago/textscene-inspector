/**
 * Tests for PrismMesh renderer
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createPrismMeshGeometry } from './renderer';
import type { PrismMeshProperties } from './types';

describe('PrismMesh Renderer', () => {
  describe('createPrismMeshGeometry', () => {
    it('should create prism using CylinderGeometry with 3 radial segments', () => {
      const properties: PrismMeshProperties = {
        leftToRight: 0,
        size: { x: 2.0, y: 3.0, z: 1.0 },
        subdivideWidth: 1,
        subdivideHeight: 1,
        subdivideDepth: 1
      };

      const geometry = createPrismMeshGeometry(properties);

      expect(geometry).toBeInstanceOf(THREE.CylinderGeometry);
      expect(geometry.parameters.radialSegments).toBe(3); // Triangular
    });

    it('should use size.x/2 for top and bottom radius', () => {
      const properties: PrismMeshProperties = {
        leftToRight: 0,
        size: { x: 2.0, y: 3.0, z: 1.0 },
        subdivideWidth: 1,
        subdivideHeight: 1,
        subdivideDepth: 1
      };

      const geometry = createPrismMeshGeometry(properties);

      expect(geometry.parameters.radiusTop).toBe(1.0); // size.x / 2
      expect(geometry.parameters.radiusBottom).toBe(1.0); // size.x / 2
    });

    it('should use size.y for height', () => {
      const properties: PrismMeshProperties = {
        leftToRight: 0,
        size: { x: 2.0, y: 4.0, z: 1.0 },
        subdivideWidth: 1,
        subdivideHeight: 1,
        subdivideDepth: 1
      };

      const geometry = createPrismMeshGeometry(properties);

      expect(geometry.parameters.height).toBe(4.0);
    });

    it('should use subdivideHeight for height segments', () => {
      const properties: PrismMeshProperties = {
        leftToRight: 0,
        size: { x: 2.0, y: 3.0, z: 1.0 },
        subdivideWidth: 1,
        subdivideHeight: 5,
        subdivideDepth: 1
      };

      const geometry = createPrismMeshGeometry(properties);

      expect(geometry.parameters.heightSegments).toBe(5);
    });

    it('should clamp subdivideHeight to minimum of 1', () => {
      const properties: PrismMeshProperties = {
        leftToRight: 0,
        size: { x: 2.0, y: 3.0, z: 1.0 },
        subdivideWidth: 1,
        subdivideHeight: 0,
        subdivideDepth: 1
      };

      const geometry = createPrismMeshGeometry(properties);

      expect(geometry.parameters.heightSegments).toBe(1);
    });

    it('should clamp negative subdivideHeight to minimum of 1', () => {
      const properties: PrismMeshProperties = {
        leftToRight: 0,
        size: { x: 2.0, y: 3.0, z: 1.0 },
        subdivideWidth: 1,
        subdivideHeight: -5,
        subdivideDepth: 1
      };

      const geometry = createPrismMeshGeometry(properties);

      expect(geometry.parameters.heightSegments).toBe(1);
    });

    it('should create uncapped cylinder (openEnded = false)', () => {
      const properties: PrismMeshProperties = {
        leftToRight: 0,
        size: { x: 2.0, y: 3.0, z: 1.0 },
        subdivideWidth: 1,
        subdivideHeight: 1,
        subdivideDepth: 1
      };

      const geometry = createPrismMeshGeometry(properties);

      expect(geometry.parameters.openEnded).toBe(false);
    });

    it('should handle very small size', () => {
      const properties: PrismMeshProperties = {
        leftToRight: 0,
        size: { x: 0.2, y: 0.3, z: 0.1 },
        subdivideWidth: 1,
        subdivideHeight: 1,
        subdivideDepth: 1
      };

      const geometry = createPrismMeshGeometry(properties);

      expect(geometry.parameters.radiusTop).toBe(0.1); // x / 2
      expect(geometry.parameters.height).toBe(0.3);
    });

    it('should handle large prism size', () => {
      const properties: PrismMeshProperties = {
        leftToRight: 0,
        size: { x: 100.0, y: 200.0, z: 50.0 },
        subdivideWidth: 1,
        subdivideHeight: 10,
        subdivideDepth: 1
      };

      const geometry = createPrismMeshGeometry(properties);

      expect(geometry.parameters.radiusTop).toBe(50.0); // x / 2
      expect(geometry.parameters.height).toBe(200.0);
      expect(geometry.parameters.heightSegments).toBe(10);
    });

    it('should handle high subdivideHeight', () => {
      const properties: PrismMeshProperties = {
        leftToRight: 0,
        size: { x: 2.0, y: 3.0, z: 1.0 },
        subdivideWidth: 1,
        subdivideHeight: 50,
        subdivideDepth: 1
      };

      const geometry = createPrismMeshGeometry(properties);

      expect(geometry.parameters.heightSegments).toBe(50);
    });

    it('should create geometry with valid vertex data', () => {
      const properties: PrismMeshProperties = {
        leftToRight: 0,
        size: { x: 2.0, y: 3.0, z: 1.0 },
        subdivideWidth: 1,
        subdivideHeight: 5,
        subdivideDepth: 1
      };

      const geometry = createPrismMeshGeometry(properties);

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
      const properties: PrismMeshProperties = {
        leftToRight: 0,
        size: { x: 2.0, y: 3.0, z: 1.0 },
        subdivideWidth: 1,
        subdivideHeight: 1,
        subdivideDepth: 1
      };

      const geometry = createPrismMeshGeometry(properties);

      expect(geometry.index).toBeDefined();
      expect(geometry.index!.count).toBeGreaterThan(0);
    });

    it('should have bounding sphere calculated', () => {
      const properties: PrismMeshProperties = {
        leftToRight: 0,
        size: { x: 2.0, y: 4.0, z: 1.0 },
        subdivideWidth: 1,
        subdivideHeight: 1,
        subdivideDepth: 1
      };

      const geometry = createPrismMeshGeometry(properties);
      geometry.computeBoundingSphere();

      expect(geometry.boundingSphere).toBeDefined();
      expect(geometry.boundingSphere!.radius).toBeGreaterThan(0);
    });

    it('should have bounding box calculated', () => {
      const properties: PrismMeshProperties = {
        leftToRight: 0,
        size: { x: 2.0, y: 3.0, z: 1.0 },
        subdivideWidth: 1,
        subdivideHeight: 1,
        subdivideDepth: 1
      };

      const geometry = createPrismMeshGeometry(properties);
      geometry.computeBoundingBox();

      expect(geometry.boundingBox).toBeDefined();
      expect(geometry.boundingBox!.min).toBeDefined();
      expect(geometry.boundingBox!.max).toBeDefined();
    });

    it('should create prism with Y axis centered at origin', () => {
      const properties: PrismMeshProperties = {
        leftToRight: 0,
        size: { x: 2.0, y: 4.0, z: 1.0 },
        subdivideWidth: 1,
        subdivideHeight: 1,
        subdivideDepth: 1
      };

      const geometry = createPrismMeshGeometry(properties);
      geometry.computeBoundingBox();

      const bbox = geometry.boundingBox!;
      const centerY = (bbox.max.y + bbox.min.y) / 2;

      // Y axis should be centered (height is symmetric)
      expect(centerY).toBeCloseTo(0, 5);

      // X and Z may be offset due to rotation, just verify bbox exists
      expect(bbox.min.x).toBeDefined();
      expect(bbox.max.x).toBeDefined();
      expect(bbox.min.z).toBeDefined();
      expect(bbox.max.z).toBeDefined();
    });

    it('should handle fractional dimensions', () => {
      const properties: PrismMeshProperties = {
        leftToRight: 0,
        size: { x: 1.5, y: 2.75, z: 0.5 },
        subdivideWidth: 1,
        subdivideHeight: 3,
        subdivideDepth: 1
      };

      const geometry = createPrismMeshGeometry(properties);

      expect(geometry.parameters.radiusTop).toBe(0.75); // 1.5 / 2
      expect(geometry.parameters.radiusBottom).toBe(0.75);
      expect(geometry.parameters.height).toBe(2.75);
    });

    it('should create triangular cross-section (3 sides)', () => {
      const properties: PrismMeshProperties = {
        leftToRight: 0,
        size: { x: 2.0, y: 3.0, z: 1.0 },
        subdivideWidth: 1,
        subdivideHeight: 1,
        subdivideDepth: 1
      };

      const geometry = createPrismMeshGeometry(properties);

      // Verify 3 radial segments for triangular shape
      expect(geometry.parameters.radialSegments).toBe(3);

      // Verify it's a uniform cylinder (not a cone)
      expect(geometry.parameters.radiusTop).toBe(geometry.parameters.radiusBottom);
    });

    it('should handle wide prism (large size.x)', () => {
      const properties: PrismMeshProperties = {
        leftToRight: 0,
        size: { x: 10.0, y: 2.0, z: 1.0 },
        subdivideWidth: 1,
        subdivideHeight: 1,
        subdivideDepth: 1
      };

      const geometry = createPrismMeshGeometry(properties);

      expect(geometry.parameters.radiusTop).toBe(5.0); // 10.0 / 2
      expect(geometry.parameters.height).toBe(2.0);
    });

    it('should handle tall prism (large size.y)', () => {
      const properties: PrismMeshProperties = {
        leftToRight: 0,
        size: { x: 1.0, y: 20.0, z: 1.0 },
        subdivideWidth: 1,
        subdivideHeight: 1,
        subdivideDepth: 1
      };

      const geometry = createPrismMeshGeometry(properties);

      expect(geometry.parameters.radiusTop).toBe(0.5); // 1.0 / 2
      expect(geometry.parameters.height).toBe(20.0);
    });
  });
});
