/**
 * Tests for ValidatorRegistry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ValidatorRegistry } from './ValidatorRegistry.js';
import type { PropertyValidator } from './ValidatorRegistry.js';

describe('ValidatorRegistry', () => {
  let registry: ValidatorRegistry;

  beforeEach(() => {
    registry = new ValidatorRegistry();
  });

  describe('registerAll', () => {
    it('should register validators for a node type', () => {
      const mockValidator: PropertyValidator = () => null;

      registry.registerAll('MeshInstance3D', {
        mesh: mockValidator,
        cast_shadow: mockValidator,
      });

      expect(registry.findValidator('MeshInstance3D', 'mesh')).toBe(mockValidator);
      expect(registry.findValidator('MeshInstance3D', 'cast_shadow')).toBe(mockValidator);
    });

    it('should merge validators for same node type', () => {
      const validator1: PropertyValidator = () => null;
      const validator2: PropertyValidator = () => null;

      registry.registerAll('MeshInstance3D', {
        mesh: validator1,
      });

      registry.registerAll('MeshInstance3D', {
        cast_shadow: validator2,
      });

      expect(registry.findValidator('MeshInstance3D', 'mesh')).toBe(validator1);
      expect(registry.findValidator('MeshInstance3D', 'cast_shadow')).toBe(validator2);
    });

    it('should handle multiple node types independently', () => {
      const meshValidator: PropertyValidator = () => null;
      const lightValidator: PropertyValidator = () => null;

      registry.registerAll('MeshInstance3D', {
        mesh: meshValidator,
      });

      registry.registerAll('DirectionalLight3D', {
        light_energy: lightValidator,
      });

      expect(registry.findValidator('MeshInstance3D', 'mesh')).toBe(meshValidator);
      expect(registry.findValidator('DirectionalLight3D', 'light_energy')).toBe(lightValidator);
      expect(registry.findValidator('MeshInstance3D', 'light_energy')).toBeNull();
      expect(registry.findValidator('DirectionalLight3D', 'mesh')).toBeNull();
    });

    it('registers a table given as several parts', () => {
      const meshValidator: PropertyValidator = () => null;
      const shadowValidator: PropertyValidator = () => null;

      registry.registerAll('MeshInstance3D', { mesh: meshValidator }, { cast_shadow: shadowValidator });

      expect(registry.findValidator('MeshInstance3D', 'mesh')).toBe(meshValidator);
      expect(registry.findValidator('MeshInstance3D', 'cast_shadow')).toBe(shadowValidator);
    });

    it('throws on a key two parts of one call both declare, naming the type and the key', () => {
      const mockValidator: PropertyValidator = () => null;

      expect(() =>
        registry.registerAll('MeshInstance3D', { mesh: mockValidator }, { mesh: mockValidator })
      ).toThrow("MeshInstance3D already declares 'mesh'");
    });

    it('throws on a key an earlier call for the same type declares', () => {
      const first: PropertyValidator = () => null;
      registry.registerAll('MeshInstance3D', { mesh: first });

      expect(() => registry.registerAll('MeshInstance3D', { mesh: () => null })).toThrow(
        "MeshInstance3D already declares 'mesh'"
      );
      expect(registry.findValidator('MeshInstance3D', 'mesh')).toBe(first);
    });

    it('registers nothing from a refused call', () => {
      const mockValidator: PropertyValidator = () => null;

      expect(() =>
        registry.registerAll(
          'MeshInstance3D',
          { cast_shadow: mockValidator },
          { mesh: mockValidator },
          { mesh: mockValidator }
        )
      ).toThrow();
      expect(registry.getOwnKeys('MeshInstance3D')).toEqual([]);
    });

    it('accepts a key named like an Object.prototype member, declared once', () => {
      const mockValidator: PropertyValidator = () => null;

      registry.registerAll('MeshInstance3D', { toString: mockValidator }, { constructor: mockValidator });

      expect(registry.getOwnKeys('MeshInstance3D').sort()).toEqual(['constructor', 'toString']);
    });

    it('lets two types declare the same key', () => {
      const mockValidator: PropertyValidator = () => null;

      registry.registerAll('MeshInstance3D', { visible: mockValidator });
      registry.registerAll('DirectionalLight3D', { visible: mockValidator });

      expect(registry.getOwnKeys('DirectionalLight3D')).toEqual(['visible']);
    });
  });

  describe('getOwnKeys', () => {
    it('should return the keys registered directly for a node type', () => {
      const mockValidator: PropertyValidator = () => null;

      registry.registerAll('MeshInstance3D', {
        mesh: mockValidator,
        cast_shadow: mockValidator,
      });

      expect(registry.getOwnKeys('MeshInstance3D').sort()).toEqual([
        'cast_shadow',
        'mesh',
      ]);
    });

    it('should return an empty array for an unregistered node type', () => {
      expect(registry.getOwnKeys('NoSuchType')).toEqual([]);
    });

    it('should not walk the base-type chain', () => {
      const mockValidator: PropertyValidator = () => null;
      const walkingRegistry = new ValidatorRegistry({ MeshInstance3D: 'Node3D' });

      walkingRegistry.registerAll('Node3D', { visible: mockValidator });
      walkingRegistry.registerAll('MeshInstance3D', { mesh: mockValidator });

      // findValidator walks the chain, getOwnKeys must not.
      expect(walkingRegistry.findValidator('MeshInstance3D', 'visible')).toBe(mockValidator);
      expect(walkingRegistry.getOwnKeys('MeshInstance3D')).toEqual(['mesh']);
    });
  });

  describe('findValidator - exact match', () => {
    it('should find validator by exact property key', () => {
      const mockValidator: PropertyValidator = () => null;

      registry.registerAll('MeshInstance3D', {
        mesh: mockValidator,
      });

      expect(registry.findValidator('MeshInstance3D', 'mesh')).toBe(mockValidator);
    });

    it('should return null for non-existent property', () => {
      registry.registerAll('MeshInstance3D', {
        mesh: () => null,
      });

      expect(registry.findValidator('MeshInstance3D', 'nonexistent')).toBeNull();
    });

    it('should return null for non-existent node type', () => {
      expect(registry.findValidator('NonExistentNode', 'property')).toBeNull();
    });
  });

  describe('findValidator - wildcard matching', () => {
    it('should match wildcard pattern', () => {
      const mockValidator: PropertyValidator = () => null;

      registry.registerAll('MeshInstance3D', {
        'surface_material_override/*': mockValidator,
      });

      expect(registry.findValidator('MeshInstance3D', 'surface_material_override/0')).toBe(mockValidator);
      expect(registry.findValidator('MeshInstance3D', 'surface_material_override/1')).toBe(mockValidator);
      expect(registry.findValidator('MeshInstance3D', 'surface_material_override/999')).toBe(mockValidator);
    });

    it('should prefer exact match over wildcard', () => {
      const exactValidator: PropertyValidator = () => ({ severity: 'error', message: 'exact', line: 1, column: 1, code: 'TEST' });
      const wildcardValidator: PropertyValidator = () => ({ severity: 'error', message: 'wildcard', line: 1, column: 1, code: 'TEST' });

      registry.registerAll('MeshInstance3D', {
        'surface_material_override/0': exactValidator,
        'surface_material_override/*': wildcardValidator,
      });

      expect(registry.findValidator('MeshInstance3D', 'surface_material_override/0')).toBe(exactValidator);
      expect(registry.findValidator('MeshInstance3D', 'surface_material_override/1')).toBe(wildcardValidator);
    });

    it('should not match wildcard without slash separator', () => {
      const mockValidator: PropertyValidator = () => null;

      registry.registerAll('MeshInstance3D', {
        'surface_material_override/*': mockValidator,
      });

      expect(registry.findValidator('MeshInstance3D', 'surface_material_override')).toBeNull();
      expect(registry.findValidator('MeshInstance3D', 'surface_material_override_0')).toBeNull();
    });

    it('should handle multiple wildcard patterns', () => {
      const materialValidator: PropertyValidator = () => null;
      const customValidator: PropertyValidator = () => null;

      registry.registerAll('MeshInstance3D', {
        'surface_material_override/*': materialValidator,
        'custom_property/*': customValidator,
      });

      expect(registry.findValidator('MeshInstance3D', 'surface_material_override/0')).toBe(materialValidator);
      expect(registry.findValidator('MeshInstance3D', 'custom_property/foo')).toBe(customValidator);
    });
  });

  describe('validator execution', () => {
    it('should execute validator and return error', () => {
      const validator: PropertyValidator = (key, value, line) => ({
        severity: 'error',
        message: `Invalid ${key}: ${value}`,
        line,
        column: 1,
        code: 'INVALID_VALUE',
      });

      registry.registerAll('MeshInstance3D', {
        cast_shadow: validator,
      });

      const foundValidator = registry.findValidator('MeshInstance3D', 'cast_shadow');
      expect(foundValidator).not.toBeNull();

      const error = foundValidator!('cast_shadow', 'invalid', 42);
      expect(error).toEqual({
        severity: 'error',
        message: 'Invalid cast_shadow: invalid',
        line: 42,
        column: 1,
        code: 'INVALID_VALUE',
      });
    });

    it('should execute validator and return null for valid input', () => {
      const validator: PropertyValidator = (key, value) => {
        if (value === '0' || value === '1') return null;
        return {
          severity: 'error',
          message: `Invalid ${key}`,
          line: 1,
          column: 1,
          code: 'INVALID_VALUE',
        };
      };

      registry.registerAll('MeshInstance3D', {
        cast_shadow: validator,
      });

      const foundValidator = registry.findValidator('MeshInstance3D', 'cast_shadow');
      expect(foundValidator!('cast_shadow', '0', 1)).toBeNull();
      expect(foundValidator!('cast_shadow', '1', 1)).toBeNull();
      expect(foundValidator!('cast_shadow', '2', 1)).not.toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all registered validators', () => {
      const mockValidator: PropertyValidator = () => null;

      registry.registerAll('MeshInstance3D', {
        mesh: mockValidator,
      });

      registry.registerAll('DirectionalLight3D', {
        light_energy: mockValidator,
      });

      expect(registry.findValidator('MeshInstance3D', 'mesh')).not.toBeNull();
      expect(registry.findValidator('DirectionalLight3D', 'light_energy')).not.toBeNull();

      registry.clear();

      expect(registry.findValidator('MeshInstance3D', 'mesh')).toBeNull();
      expect(registry.findValidator('DirectionalLight3D', 'light_energy')).toBeNull();
    });

    it('should allow re-registration after clear', () => {
      const mockValidator: PropertyValidator = () => null;

      registry.registerAll('MeshInstance3D', {
        mesh: mockValidator,
      });

      registry.clear();

      registry.registerAll('MeshInstance3D', {
        cast_shadow: mockValidator,
      });

      expect(registry.findValidator('MeshInstance3D', 'mesh')).toBeNull();
      expect(registry.findValidator('MeshInstance3D', 'cast_shadow')).toBe(mockValidator);
    });
  });
});
