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

  describe('UV Transform (uv1_scale)', () => {
    it('should apply UV transform to albedo texture with uv1_scale=0.5', () => {
      const albedoTexture = new THREE.Texture();
      const properties: StandardMaterial3DProperties = {
        albedo_texture: albedoTexture,
        uv1_scale: { x: 0.5, y: 0.5, z: 0.5 },
      };

      const material = createStandardMaterial(properties);

      // Texture should be cloned, not the same object
      expect(material.map).toBeDefined();
      expect(material.map).not.toBe(albedoTexture);
      expect(material.map!.repeat.x).toBe(0.5); // Direct mapping: uv1_scale = 0.5
      expect(material.map!.repeat.y).toBe(0.5);
      expect(material.map!.wrapS).toBe(THREE.RepeatWrapping);
      expect(material.map!.wrapT).toBe(THREE.RepeatWrapping);

      // Original texture should be unmodified
      expect(albedoTexture.repeat.x).toBe(1);
      expect(albedoTexture.repeat.y).toBe(1);
    });

    it('should apply UV transform to albedo texture with uv1_scale=2.4', () => {
      const albedoTexture = new THREE.Texture();
      const properties: StandardMaterial3DProperties = {
        albedo_texture: albedoTexture,
        uv1_scale: { x: 2.4, y: 2.4, z: 2.4 },
      };

      const material = createStandardMaterial(properties);

      expect(material.map).toBeDefined();
      expect(material.map).not.toBe(albedoTexture);
      expect(material.map!.repeat.x).toBeCloseTo(2.4, 5);
      expect(material.map!.repeat.y).toBeCloseTo(2.4, 5);
      expect(material.map!.wrapS).toBe(THREE.RepeatWrapping);
      expect(material.map!.wrapT).toBe(THREE.RepeatWrapping);

      // Original texture should be unmodified
      expect(albedoTexture.repeat.x).toBe(1);
      expect(albedoTexture.repeat.y).toBe(1);
    });

    it('should apply UV transform to normal texture', () => {
      const normalTexture = new THREE.Texture();
      const properties: StandardMaterial3DProperties = {
        normal_enabled: true,
        normal_texture: normalTexture,
        uv1_scale: { x: 0.5, y: 0.5, z: 0.5 },
      };

      const material = createStandardMaterial(properties);

      expect(material.normalMap).toBeDefined();
      expect(material.normalMap).not.toBe(normalTexture);
      expect(material.normalMap!.repeat.x).toBe(0.5);
      expect(material.normalMap!.repeat.y).toBe(0.5);
      expect(material.normalMap!.wrapS).toBe(THREE.RepeatWrapping);
      expect(material.normalMap!.wrapT).toBe(THREE.RepeatWrapping);
    });

    it('should apply UV transform to metallic texture', () => {
      const metallicTexture = new THREE.Texture();
      const properties: StandardMaterial3DProperties = {
        metallic_texture: metallicTexture,
        uv1_scale: { x: 0.5, y: 0.5, z: 0.5 },
      };

      const material = createStandardMaterial(properties);

      expect(material.metalnessMap).toBeDefined();
      expect(material.metalnessMap).not.toBe(metallicTexture);
      expect(material.metalnessMap!.repeat.x).toBe(0.5);
      expect(material.metalnessMap!.repeat.y).toBe(0.5);
    });

    it('should apply UV transform to roughness texture', () => {
      const roughnessTexture = new THREE.Texture();
      const properties: StandardMaterial3DProperties = {
        roughness_texture: roughnessTexture,
        uv1_scale: { x: 0.5, y: 0.5, z: 0.5 },
      };

      const material = createStandardMaterial(properties);

      expect(material.roughnessMap).toBeDefined();
      expect(material.roughnessMap).not.toBe(roughnessTexture);
      expect(material.roughnessMap!.repeat.x).toBe(0.5);
      expect(material.roughnessMap!.repeat.y).toBe(0.5);
    });

    it('should apply UV transform to AO texture', () => {
      const aoTexture = new THREE.Texture();
      const properties: StandardMaterial3DProperties = {
        ao_texture: aoTexture,
        uv1_scale: { x: 0.5, y: 0.5, z: 0.5 },
      };

      const material = createStandardMaterial(properties);

      expect(material.aoMap).toBeDefined();
      expect(material.aoMap).not.toBe(aoTexture);
      expect(material.aoMap!.repeat.x).toBe(0.5);
      expect(material.aoMap!.repeat.y).toBe(0.5);
    });

    it('should apply UV transform to emission texture', () => {
      const emissionTexture = new THREE.Texture();
      const properties: StandardMaterial3DProperties = {
        emission_enabled: true,
        emission_texture: emissionTexture,
        uv1_scale: { x: 0.5, y: 0.5, z: 0.5 },
      };

      const material = createStandardMaterial(properties);

      expect(material.emissiveMap).toBeDefined();
      expect(material.emissiveMap).not.toBe(emissionTexture);
      expect(material.emissiveMap!.repeat.x).toBe(0.5);
      expect(material.emissiveMap!.repeat.y).toBe(0.5);
    });

    it('should apply UV transform to multiple textures', () => {
      const albedoTexture = new THREE.Texture();
      const normalTexture = new THREE.Texture();
      const properties: StandardMaterial3DProperties = {
        albedo_texture: albedoTexture,
        normal_enabled: true,
        normal_texture: normalTexture,
        uv1_scale: { x: 0.5, y: 0.5, z: 0.5 },
      };

      const material = createStandardMaterial(properties);

      expect(material.map!.repeat.x).toBe(0.5);
      expect(material.map!.repeat.y).toBe(0.5);
      expect(material.normalMap!.repeat.x).toBe(0.5);
      expect(material.normalMap!.repeat.y).toBe(0.5);

      // Original textures should be unmodified
      expect(albedoTexture.repeat.x).toBe(1);
      expect(normalTexture.repeat.x).toBe(1);
    });

    it('should handle different x and y values in uv1_scale', () => {
      const albedoTexture = new THREE.Texture();
      const properties: StandardMaterial3DProperties = {
        albedo_texture: albedoTexture,
        uv1_scale: { x: 0.5, y: 2.0, z: 1.0 },
      };

      const material = createStandardMaterial(properties);

      expect(material.map!.repeat.x).toBe(0.5); // Direct: uv1_scale.x
      expect(material.map!.repeat.y).toBe(2.0); // Direct: uv1_scale.y

      // Original texture should be unmodified
      expect(albedoTexture.repeat.x).toBe(1);
      expect(albedoTexture.repeat.y).toBe(1);
    });

    it('should NOT apply UV transform when uv1_scale is undefined', () => {
      const albedoTexture = new THREE.Texture();
      const properties: StandardMaterial3DProperties = {
        albedo_texture: albedoTexture,
      };

      const material = createStandardMaterial(properties);

      expect(material.map).toBe(albedoTexture);
      expect(albedoTexture.repeat.x).toBe(1); // THREE.js default
      expect(albedoTexture.repeat.y).toBe(1);
    });

    it('should NOT crash when uv1_scale provided but no textures', () => {
      const properties: StandardMaterial3DProperties = {
        uv1_scale: { x: 0.5, y: 0.5, z: 0.5 },
      };

      expect(() => createStandardMaterial(properties)).not.toThrow();
    });

    it('should correctly apply formula: THREE.repeat = Godot.uv1_scale (direct mapping)', () => {
      const albedoTexture = new THREE.Texture();
      const properties: StandardMaterial3DProperties = {
        albedo_texture: albedoTexture,
        uv1_scale: { x: 4.0, y: 8.0, z: 1.0 },
      };

      const material = createStandardMaterial(properties);

      // Direct mapping: uv1_scale = repeat
      expect(material.map!.repeat.x).toBe(4.0);
      expect(material.map!.repeat.y).toBe(8.0);
    });

    it('should handle very large uv1_scale values (very large repeat)', () => {
      const albedoTexture = new THREE.Texture();
      const properties: StandardMaterial3DProperties = {
        albedo_texture: albedoTexture,
        uv1_scale: { x: 1000, y: 1000, z: 1 },
      };

      const material = createStandardMaterial(properties);

      expect(material.map!.repeat.x).toBe(1000); // Direct mapping
      expect(material.map!.repeat.y).toBe(1000);
      expect(material.map!.wrapS).toBe(THREE.RepeatWrapping);
      expect(material.map!.wrapT).toBe(THREE.RepeatWrapping);
    });

    it('should handle very small uv1_scale values (very small repeat)', () => {
      const albedoTexture = new THREE.Texture();
      const properties: StandardMaterial3DProperties = {
        albedo_texture: albedoTexture,
        uv1_scale: { x: 0.01, y: 0.01, z: 1 },
      };

      const material = createStandardMaterial(properties);

      expect(material.map!.repeat.x).toBe(0.01); // Direct mapping
      expect(material.map!.repeat.y).toBe(0.01);
      expect(material.map!.wrapS).toBe(THREE.RepeatWrapping);
      expect(material.map!.wrapT).toBe(THREE.RepeatWrapping);
    });

    it('should handle uv1_scale with value of 1.0 (no tiling change)', () => {
      const albedoTexture = new THREE.Texture();
      const properties: StandardMaterial3DProperties = {
        albedo_texture: albedoTexture,
        uv1_scale: { x: 1.0, y: 1.0, z: 1.0 },
      };

      const material = createStandardMaterial(properties);

      expect(material.map!.repeat.x).toBe(1); // Direct: uv1_scale = 1.0
      expect(material.map!.repeat.y).toBe(1);
      expect(material.map!.wrapS).toBe(THREE.RepeatWrapping);
      expect(material.map!.wrapT).toBe(THREE.RepeatWrapping);
    });

    it('should apply UV transform independently to each texture type', () => {
      const albedoTexture = new THREE.Texture();
      const normalTexture = new THREE.Texture();
      const metallicTexture = new THREE.Texture();

      const properties: StandardMaterial3DProperties = {
        albedo_texture: albedoTexture,
        normal_enabled: true,
        normal_texture: normalTexture,
        metallic_texture: metallicTexture,
        uv1_scale: { x: 0.25, y: 0.5, z: 1.0 },
      };

      const material = createStandardMaterial(properties);

      // All textures should have same UV transform applied
      expect(material.map!.repeat.x).toBe(0.25); // Direct: uv1_scale.x
      expect(material.map!.repeat.y).toBe(0.5); // Direct: uv1_scale.y

      expect(material.normalMap!.repeat.x).toBe(0.25);
      expect(material.normalMap!.repeat.y).toBe(0.5);

      expect(material.metalnessMap!.repeat.x).toBe(0.25);
      expect(material.metalnessMap!.repeat.y).toBe(0.5);

      // All should have RepeatWrapping
      expect(material.map!.wrapS).toBe(THREE.RepeatWrapping);
      expect(material.normalMap!.wrapS).toBe(THREE.RepeatWrapping);
      expect(material.metalnessMap!.wrapS).toBe(THREE.RepeatWrapping);
    });

    it('should ignore z component of uv1_scale (only x and y affect UV)', () => {
      const albedoTexture = new THREE.Texture();
      const properties: StandardMaterial3DProperties = {
        albedo_texture: albedoTexture,
        uv1_scale: { x: 0.5, y: 0.5, z: 999 }, // z should be ignored
      };

      const material = createStandardMaterial(properties);

      // Only x and y affect the repeat
      expect(material.map!.repeat.x).toBe(0.5);
      expect(material.map!.repeat.y).toBe(0.5);
    });

    it('should apply UV transform even when other material properties are set', () => {
      const albedoTexture = new THREE.Texture();
      const properties: StandardMaterial3DProperties = {
        albedo_texture: albedoTexture,
        albedo_color: { r: 1, g: 0, b: 0, a: 1 },
        metallic: 0.8,
        roughness: 0.2,
        uv1_scale: { x: 0.5, y: 0.5, z: 0.5 },
      };

      const material = createStandardMaterial(properties);

      // UV transform should still be applied
      expect(material.map!.repeat.x).toBe(0.5);
      expect(material.map!.repeat.y).toBe(0.5);

      // Other properties should also be set
      expect(material.color.r).toBe(1);
      expect(material.metalness).toBe(0.8);
      expect(material.roughness).toBe(0.2);
    });
  });
});
