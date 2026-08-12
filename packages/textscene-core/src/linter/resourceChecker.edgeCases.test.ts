/**
 * `checkResourceExists` where the input is not a clean hit: text that is not a
 * reference at all, and an id that exists in one table but not the other.
 *
 * The happy paths are the sibling `resourceChecker.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { checkResourceExists } from './resourceChecker.js';
import type { TscnScene, TscnExternalResource } from '../parser/types.js';

describe('checkResourceExists', () => {
  describe('invalid reference formats', () => {
    it('should return false for invalid format (no quotes)', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      expect(checkResourceExists(scene, 'SubResource(mesh_1)')).toBe(false);
    });

    it('should return false for invalid format (missing parentheses)', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      expect(checkResourceExists(scene, 'SubResource"mesh_1"')).toBe(false);
    });

    it('should return false for invalid format (wrong resource type)', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      expect(checkResourceExists(scene, 'InvalidResource("mesh_1")')).toBe(false);
    });

    it('should return false for plain string', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      expect(checkResourceExists(scene, 'mesh_1')).toBe(false);
    });

    it('should return false for empty string', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      expect(checkResourceExists(scene, '')).toBe(false);
    });

    it('should return true for a cleared slot, which names nothing on purpose', () => {
      // `variant_parser.cpp:699` reads a bare `null` as `Variant()` and every
      // `Ref<T>` setter takes it, so nothing is missing. Shared by every rule
      // that asks this question, so the arm is pinned here once.
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      expect(checkResourceExists(scene, 'null')).toBe(true);
    });

    it('should return false for malformed reference', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      expect(checkResourceExists(scene, 'SubResource(')).toBe(false);
      expect(checkResourceExists(scene, 'SubResource()')).toBe(false);
      expect(checkResourceExists(scene, 'SubResource("")')).toBe(false);
    });
  });

  describe('mixed SubResource and ExtResource', () => {
    it('should differentiate between SubResource and ExtResource with same ID', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [
          {
            id: 'resource_1',
            type: 'Texture2D',
            path: 'res://texture.png',
          },
        ] as TscnExternalResource[],
        internalResources: [
          {
            id: '1',
            type: 'ArrayMesh',
            data: { id: 'resource_1' },
          },
        ],
      };

      expect(checkResourceExists(scene, 'SubResource("resource_1")')).toBe(true);
      expect(checkResourceExists(scene, 'ExtResource("resource_1")')).toBe(true);
    });

    it('should not find SubResource when only ExtResource exists', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [
          {
            id: 'resource_1',
            type: 'Texture2D',
            path: 'res://texture.png',
          },
        ] as TscnExternalResource[],
        internalResources: [],
      };

      expect(checkResourceExists(scene, 'SubResource("resource_1")')).toBe(false);
      expect(checkResourceExists(scene, 'ExtResource("resource_1")')).toBe(true);
    });

    it('should not find ExtResource when only SubResource exists', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [
          {
            id: '1',
            type: 'ArrayMesh',
            data: { id: 'resource_1' },
          },
        ],
      };

      expect(checkResourceExists(scene, 'ExtResource("resource_1")')).toBe(false);
      expect(checkResourceExists(scene, 'SubResource("resource_1")')).toBe(true);
    });
  });
});
