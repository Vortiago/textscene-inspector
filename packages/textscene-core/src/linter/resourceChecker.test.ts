/**
 * Resolving a well-formed reference against the resources a scene declares.
 * Malformed text and one id in both tables are in
 * `resourceChecker.edgeCases.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { checkResourceExists } from './resourceChecker.js';
import type { TscnScene, TscnExternalResource } from '../parser/types.js';

describe('checkResourceExists', () => {
  describe('SubResource validation', () => {
    it('should find existing SubResource', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [
          {
            id: '1',
            type: 'ArrayMesh',
            data: { id: 'mesh_1' },
          },
        ],
      };

      expect(checkResourceExists(scene, 'SubResource("mesh_1")')).toBe(true);
    });

    it('should not find non-existent SubResource', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [
          {
            id: '1',
            type: 'ArrayMesh',
            data: { id: 'mesh_1' },
          },
        ],
      };

      expect(checkResourceExists(scene, 'SubResource("mesh_999")')).toBe(false);
    });

    it('should handle scene with no internal resources', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      expect(checkResourceExists(scene, 'SubResource("mesh_1")')).toBe(false);
    });

    it('should find SubResource with hyphenated ID', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [
          {
            id: '1',
            type: 'StandardMaterial3D',
            data: { id: 'material-red-glossy' },
          },
        ],
      };

      expect(checkResourceExists(scene, 'SubResource("material-red-glossy")')).toBe(true);
    });

    it('should find SubResource with underscore ID', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [
          {
            id: '1',
            type: 'StandardMaterial3D',
            data: { id: 'material_red_glossy' },
          },
        ],
      };

      expect(checkResourceExists(scene, 'SubResource("material_red_glossy")')).toBe(true);
    });

    it('should handle multiple SubResources', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [
          {
            id: '1',
            type: 'ArrayMesh',
            data: { id: 'mesh_1' },
          },
          {
            id: '2',
            type: 'StandardMaterial3D',
            data: { id: 'material_1' },
          },
          {
            id: '3',
            type: 'BoxShape3D',
            data: { id: 'shape_1' },
          },
        ],
      };

      expect(checkResourceExists(scene, 'SubResource("mesh_1")')).toBe(true);
      expect(checkResourceExists(scene, 'SubResource("material_1")')).toBe(true);
      expect(checkResourceExists(scene, 'SubResource("shape_1")')).toBe(true);
      expect(checkResourceExists(scene, 'SubResource("nonexistent")')).toBe(false);
    });
  });

  describe('ExtResource validation', () => {
    it('should find existing ExtResource', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [
          {
            id: 'texture_1',
            type: 'Texture2D',
            path: 'res://textures/texture.png',
          },
        ] as TscnExternalResource[],
        internalResources: [],
      };

      expect(checkResourceExists(scene, 'ExtResource("texture_1")')).toBe(true);
    });

    it('should not find non-existent ExtResource', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [
          {
            id: 'texture_1',
            type: 'Texture2D',
            path: 'res://textures/texture.png',
          },
        ],
        internalResources: [],
      };

      expect(checkResourceExists(scene, 'ExtResource("texture_999")')).toBe(false);
    });

    it('should handle scene with no external resources', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      expect(checkResourceExists(scene, 'ExtResource("texture_1")')).toBe(false);
    });

    it('should handle multiple ExtResources', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [
          {
            id: 'texture_1',
            type: 'Texture2D',
            path: 'res://textures/texture.png',
          },
          {
            id: 'material_1',
            type: 'Material',
            path: 'res://materials/mat.tres',
          },
          {
            id: 'scene_1',
            type: 'PackedScene',
            path: 'res://scenes/scene.tscn',
          },
        ] as TscnExternalResource[],
        internalResources: [],
      };

      expect(checkResourceExists(scene, 'ExtResource("texture_1")')).toBe(true);
      expect(checkResourceExists(scene, 'ExtResource("material_1")')).toBe(true);
      expect(checkResourceExists(scene, 'ExtResource("scene_1")')).toBe(true);
      expect(checkResourceExists(scene, 'ExtResource("nonexistent")')).toBe(false);
    });
  });
});
