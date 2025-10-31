/**
 * Tests for ResourceManager
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { parseResourceReference, resolveGeometry } from './ResourceManager';
import type { TscnScene } from '../parser/types';

describe('ResourceManager', () => {
  describe('parseResourceReference', () => {
    it('should parse SubResource reference', () => {
      const result = parseResourceReference('SubResource("BoxMesh_1")');

      expect(result).toEqual({
        type: 'SubResource',
        id: 'BoxMesh_1',
      });
    });

    it('should parse ExtResource reference', () => {
      const result = parseResourceReference('ExtResource("1_abc")');

      expect(result).toEqual({
        type: 'ExtResource',
        id: '1_abc',
      });
    });

    it('should handle SubResource with extra whitespace', () => {
      const result = parseResourceReference('SubResource( "BoxMesh_1" )');

      expect(result).toEqual({
        type: 'SubResource',
        id: 'BoxMesh_1',
      });
    });

    it('should return null for invalid format', () => {
      expect(parseResourceReference('InvalidReference')).toBeNull();
      expect(parseResourceReference('Resource("test")')).toBeNull();
      expect(parseResourceReference('SubResource(BoxMesh_1)')).toBeNull(); // Missing quotes
    });
  });

  describe('resolveGeometry', () => {
    it('should resolve BoxMesh geometry', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [
          {
            id: 0,
            type: 'BoxMesh',
            data: {
              id: 'BoxMesh_1',
              size: 'Vector3(2, 2, 2)',
            },
          },
        ],
      };

      const geometry = resolveGeometry('SubResource("BoxMesh_1")', scene);

      expect(geometry).toBeInstanceOf(THREE.BoxGeometry);
      expect(geometry?.type).toBe('BoxGeometry');
    });

    it('should return correct BoxGeometry dimensions', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [
          {
            id: 0,
            type: 'BoxMesh',
            data: {
              id: 'BoxMesh_1',
              size: 'Vector3(3, 4, 5)',
            },
          },
        ],
      };

      const geometry = resolveGeometry('SubResource("BoxMesh_1")', scene) as THREE.BoxGeometry | null;

      expect(geometry).toBeInstanceOf(THREE.BoxGeometry);
      expect(geometry?.parameters.width).toBe(3);
      expect(geometry?.parameters.height).toBe(4);
      expect(geometry?.parameters.depth).toBe(5);
    });

    it('should return null for missing mesh reference', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      const geometry = resolveGeometry(undefined, scene);

      expect(geometry).toBeNull();
    });

    it('should return null for resource not found', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [
          {
            id: 0,
            type: 'BoxMesh',
            data: {
              id: 'BoxMesh_1',
              size: 'Vector3(2, 2, 2)',
            },
          },
        ],
      };

      const geometry = resolveGeometry('SubResource("BoxMesh_2")', scene);

      expect(geometry).toBeNull();
    });

    it('should return null for unsupported mesh type', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [
          {
            id: 0,
            type: 'UnsupportedMesh',
            data: {
              id: 'UnsupportedMesh_1',
            },
          },
        ],
      };

      const geometry = resolveGeometry('SubResource("UnsupportedMesh_1")', scene);

      expect(geometry).toBeNull();
    });

    it('should return null for ExtResource (not yet supported)', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      const geometry = resolveGeometry('ExtResource("1_abc")', scene);

      expect(geometry).toBeNull();
    });

    it('should handle BoxMesh with default size', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [
          {
            id: 0,
            type: 'BoxMesh',
            data: {
              id: 'BoxMesh_1',
              // No size property - should use default
            },
          },
        ],
      };

      const geometry = resolveGeometry('SubResource("BoxMesh_1")', scene) as THREE.BoxGeometry | null;

      expect(geometry).toBeInstanceOf(THREE.BoxGeometry);
      expect(geometry?.parameters.width).toBe(1);
      expect(geometry?.parameters.height).toBe(1);
      expect(geometry?.parameters.depth).toBe(1);
    });
  });
});
