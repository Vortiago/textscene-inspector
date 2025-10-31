/**
 * Tests for BoxMesh renderer
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createBoxMeshGeometry } from './renderer';
import type { BoxMeshProperties } from './types';

describe('BoxMesh Renderer', () => {
  describe('createBoxMeshGeometry', () => {
    it('should create a THREE.BoxGeometry', () => {
      const properties: BoxMeshProperties = {
        size: { x: 1, y: 1, z: 1 },
      };

      const geometry = createBoxMeshGeometry(properties);

      expect(geometry).toBeInstanceOf(THREE.BoxGeometry);
    });

    it('should create geometry with correct dimensions', () => {
      const properties: BoxMeshProperties = {
        size: { x: 2, y: 3, z: 4 },
      };

      const geometry = createBoxMeshGeometry(properties);

      expect(geometry.parameters.width).toBe(2);
      expect(geometry.parameters.height).toBe(3);
      expect(geometry.parameters.depth).toBe(4);
    });

    it('should create geometry with uniform size', () => {
      const properties: BoxMeshProperties = {
        size: { x: 2, y: 2, z: 2 },
      };

      const geometry = createBoxMeshGeometry(properties);

      expect(geometry.parameters.width).toBe(2);
      expect(geometry.parameters.height).toBe(2);
      expect(geometry.parameters.depth).toBe(2);
    });

    it('should create geometry with default size', () => {
      const properties: BoxMeshProperties = {
        size: { x: 1, y: 1, z: 1 },
      };

      const geometry = createBoxMeshGeometry(properties);

      expect(geometry.parameters.width).toBe(1);
      expect(geometry.parameters.height).toBe(1);
      expect(geometry.parameters.depth).toBe(1);
    });

    it('should handle non-uniform dimensions', () => {
      const properties: BoxMeshProperties = {
        size: { x: 5, y: 0.5, z: 10 },
      };

      const geometry = createBoxMeshGeometry(properties);

      expect(geometry.parameters.width).toBe(5);
      expect(geometry.parameters.height).toBe(0.5);
      expect(geometry.parameters.depth).toBe(10);
    });
  });
});
