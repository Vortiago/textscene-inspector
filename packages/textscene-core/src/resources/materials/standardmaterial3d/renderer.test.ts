/**
 * Tests for StandardMaterial3D renderer
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createStandardMaterial } from './renderer';
import type { StandardMaterial3DProperties } from './types';

describe('StandardMaterial3D Renderer', () => {
  describe('createStandardMaterial', () => {
    it('should create MeshStandardMaterial', () => {
      const properties: StandardMaterial3DProperties = {
        albedo_color: { r: 1, g: 0, b: 0, a: 1 },
      };

      const material = createStandardMaterial(properties);

      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    });

    it('should set color from albedo_color', () => {
      const properties: StandardMaterial3DProperties = {
        albedo_color: { r: 1, g: 0, b: 0, a: 1 },
      };

      const material = createStandardMaterial(properties);

      expect(material.color.r).toBe(1);
      expect(material.color.g).toBe(0);
      expect(material.color.b).toBe(0);
    });

    it('should handle transparency when alpha < 1', () => {
      const properties: StandardMaterial3DProperties = {
        albedo_color: { r: 1, g: 1, b: 1, a: 0.5 },
      };

      const material = createStandardMaterial(properties);

      expect(material.transparent).toBe(true);
      expect(material.opacity).toBe(0.5);
    });

    it('should not set transparency when alpha = 1', () => {
      const properties: StandardMaterial3DProperties = {
        albedo_color: { r: 1, g: 0, b: 0, a: 1 },
      };

      const material = createStandardMaterial(properties);

      expect(material.transparent).toBe(false);
      expect(material.opacity).toBe(1); // THREE.js default
    });

    it('should set metalness property', () => {
      const properties: StandardMaterial3DProperties = {
        metallic: 0.8,
      };

      const material = createStandardMaterial(properties);

      expect(material.metalness).toBe(0.8);
    });

    it('should set roughness property', () => {
      const properties: StandardMaterial3DProperties = {
        roughness: 0.3,
      };

      const material = createStandardMaterial(properties);

      expect(material.roughness).toBe(0.3);
    });

    it('should create material with all properties', () => {
      const properties: StandardMaterial3DProperties = {
        albedo_color: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
        metallic: 0.7,
        roughness: 0.2,
      };

      const material = createStandardMaterial(properties);

      expect(material.color.r).toBe(0.5);
      expect(material.color.g).toBe(0.5);
      expect(material.color.b).toBe(0.5);
      expect(material.metalness).toBe(0.7);
      expect(material.roughness).toBe(0.2);
    });

    it('should create material without albedo_color', () => {
      const properties: StandardMaterial3DProperties = {
        metallic: 0.5,
        roughness: 0.7,
      };

      const material = createStandardMaterial(properties);

      expect(material.metalness).toBe(0.5);
      expect(material.roughness).toBe(0.7);
    });

    it('should create material with empty properties', () => {
      const properties: StandardMaterial3DProperties = {};

      const material = createStandardMaterial(properties);

      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
    });

    it('should create brown table material from Hallway scene', () => {
      const properties: StandardMaterial3DProperties = {
        albedo_color: { r: 0.545098, g: 0.270588, b: 0.0745098, a: 1 },
      };

      const material = createStandardMaterial(properties);

      expect(material.color.r).toBeCloseTo(0.545098, 5);
      expect(material.color.g).toBeCloseTo(0.270588, 5);
      expect(material.color.b).toBeCloseTo(0.0745098, 5);
    });

    it('should create gold material from Hallway scene', () => {
      const properties: StandardMaterial3DProperties = {
        albedo_color: { r: 1, g: 0.843137, b: 0, a: 1 },
      };

      const material = createStandardMaterial(properties);

      expect(material.color.r).toBe(1);
      expect(material.color.g).toBeCloseTo(0.843137, 5);
      expect(material.color.b).toBe(0);
    });

    it('should handle zero metallic and roughness', () => {
      const properties: StandardMaterial3DProperties = {
        metallic: 0,
        roughness: 0,
      };

      const material = createStandardMaterial(properties);

      expect(material.metalness).toBe(0);
      expect(material.roughness).toBe(0);
    });

    it('should handle max metallic and roughness', () => {
      const properties: StandardMaterial3DProperties = {
        metallic: 1,
        roughness: 1,
      };

      const material = createStandardMaterial(properties);

      expect(material.metalness).toBe(1);
      expect(material.roughness).toBe(1);
    });

    it('should handle fully transparent material', () => {
      const properties: StandardMaterial3DProperties = {
        albedo_color: { r: 1, g: 1, b: 1, a: 0 },
      };

      const material = createStandardMaterial(properties);

      expect(material.transparent).toBe(true);
      expect(material.opacity).toBe(0);
    });

    it('should handle semi-transparent material', () => {
      const properties: StandardMaterial3DProperties = {
        albedo_color: { r: 1, g: 0, b: 0, a: 0.75 },
      };

      const material = createStandardMaterial(properties);

      expect(material.transparent).toBe(true);
      expect(material.opacity).toBe(0.75);
    });

    it('should apply normal map when normal_enabled is true and texture provided', () => {
      const mockTexture = new THREE.Texture();
      const properties: StandardMaterial3DProperties = {
        normal_enabled: true,
        normal_texture: mockTexture,
      };

      const material = createStandardMaterial(properties);

      expect(material.normalMap).toBe(mockTexture);
    });

    it('should NOT apply normal map when normal_enabled is false', () => {
      const mockTexture = new THREE.Texture();
      const properties: StandardMaterial3DProperties = {
        normal_enabled: false,
        normal_texture: mockTexture,
      };

      const material = createStandardMaterial(properties);

      expect(material.normalMap).toBeNull();
    });

    it('should NOT apply normal map when normal_enabled is undefined', () => {
      const mockTexture = new THREE.Texture();
      const properties: StandardMaterial3DProperties = {
        normal_texture: mockTexture,
      };

      const material = createStandardMaterial(properties);

      expect(material.normalMap).toBeNull();
    });

    it('should NOT apply normal map when normal_enabled is true but no texture', () => {
      const properties: StandardMaterial3DProperties = {
        normal_enabled: true,
      };

      const material = createStandardMaterial(properties);

      expect(material.normalMap).toBeNull();
    });

    it('should apply albedo texture and normal map together', () => {
      const albedoTexture = new THREE.Texture();
      const normalTexture = new THREE.Texture();
      const properties: StandardMaterial3DProperties = {
        albedo_texture: albedoTexture,
        normal_enabled: true,
        normal_texture: normalTexture,
      };

      const material = createStandardMaterial(properties);

      expect(material.map).toBe(albedoTexture);
      expect(material.normalMap).toBe(normalTexture);
    });

    it('should apply emission map when emission_enabled is true and texture provided', () => {
      const mockTexture = new THREE.Texture();
      const properties: StandardMaterial3DProperties = {
        emission_enabled: true,
        emission_texture: mockTexture,
      };

      const material = createStandardMaterial(properties);

      expect(material.emissiveMap).toBe(mockTexture);
    });

    it('should NOT apply emission map when emission_enabled is false', () => {
      const mockTexture = new THREE.Texture();
      const properties: StandardMaterial3DProperties = {
        emission_enabled: false,
        emission_texture: mockTexture,
      };

      const material = createStandardMaterial(properties);

      expect(material.emissiveMap).toBeNull();
    });

    it('should NOT apply emission map when emission_enabled is undefined', () => {
      const mockTexture = new THREE.Texture();
      const properties: StandardMaterial3DProperties = {
        emission_texture: mockTexture,
      };

      const material = createStandardMaterial(properties);

      expect(material.emissiveMap).toBeNull();
    });

    it('should NOT apply emission map when texture is null', () => {
      const properties: StandardMaterial3DProperties = {
        emission_enabled: true,
      };

      const material = createStandardMaterial(properties);

      expect(material.emissiveMap).toBeNull();
    });

    it('should NOT apply emission map when both flag and texture missing', () => {
      const properties: StandardMaterial3DProperties = {};

      const material = createStandardMaterial(properties);

      expect(material.emissiveMap).toBeNull();
    });

    it('should allow emission_enabled without texture (no crash)', () => {
      const properties: StandardMaterial3DProperties = {
        emission_enabled: true,
      };

      expect(() => createStandardMaterial(properties)).not.toThrow();
    });
  });
});
