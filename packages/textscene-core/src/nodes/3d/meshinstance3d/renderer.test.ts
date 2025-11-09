/**
 * Tests for MeshInstance3D renderer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { createMeshInstance3D } from './renderer';
import type { MeshInstance3DProperties } from './types';
import { applyNode3DTransform } from '../../base/node3d/renderer';
import { parseTransform3D } from '../../../utils/transform';
import * as logger from '../../../logger';

describe('MeshInstance3D Renderer', () => {
  let loggerWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    loggerWarnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    loggerWarnSpy.mockRestore();
  });

  describe('createMeshInstance3D', () => {
    it('should create a THREE.Mesh', async () => {
      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = await createMeshInstance3D('TestMesh', properties);

      expect(mesh).toBeInstanceOf(THREE.Mesh);
    });

    it('should set the mesh name from nodeName', async () => {
      const properties: MeshInstance3DProperties = {
        name: 'MyMeshInstance',
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = await createMeshInstance3D('MyMeshInstance', properties);

      expect(mesh.name).toBe('MyMeshInstance');
    });

    it('should use placeholder BoxGeometry', async () => {
      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = await createMeshInstance3D('TestMesh', properties);

      expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
    });

    it('should use wireframe material for placeholder', async () => {
      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = await createMeshInstance3D('TestMesh', properties);

      expect(mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);
      const material = mesh.material as THREE.MeshBasicMaterial;
      expect(material.wireframe).toBe(true);
      expect(material.color.getHex()).toBe(0xff00ff);
    });

    it('should default receiveShadow to true', async () => {
      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = await createMeshInstance3D('TestMesh', properties);

      expect(mesh.receiveShadow).toBe(true);
    });

    it('should log warning when mesh property exists but no scene provided', async () => {
      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        mesh: 'SubResource("BoxMesh_1")',
        surfaceMaterialOverrides: new Map(),
      };

      await createMeshInstance3D('TestMesh', properties);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No scene provided')
      );
    });
  });

  describe('Shadow Casting', () => {
    it('should set castShadow=false when castShadow=0 (OFF)', async () => {
      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        castShadow: 0,
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = await createMeshInstance3D('TestMesh', properties);

      expect(mesh.castShadow).toBe(false);
    });

    it('should set castShadow=true when castShadow=1 (ON)', async () => {
      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        castShadow: 1,
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = await createMeshInstance3D('TestMesh', properties);

      expect(mesh.castShadow).toBe(true);
    });

    it('should set castShadow=true and shadowSide=DoubleSide when castShadow=2 (DOUBLE_SIDED)', async () => {
      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        castShadow: 2,
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = await createMeshInstance3D('TestMesh', properties);

      expect(mesh.castShadow).toBe(true);
      const material = mesh.material as THREE.MeshBasicMaterial;
      expect(material.shadowSide).toBe(THREE.DoubleSide);
    });

    it('should set castShadow=true and visible=false when castShadow=3 (SHADOWS_ONLY)', async () => {
      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        castShadow: 3,
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = await createMeshInstance3D('TestMesh', properties);

      expect(mesh.castShadow).toBe(true);
      expect(mesh.visible).toBe(false);
    });

    it('should default to castShadow=false when castShadow is undefined', async () => {
      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = await createMeshInstance3D('TestMesh', properties);

      expect(mesh.castShadow).toBe(false);
    });
  });

  describe('Integration with Node3D Transform', () => {
    it('should work with applyNode3DTransform', async () => {
      const transform = parseTransform3D('Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4)');
      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        transform,
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = await createMeshInstance3D('TestMesh', properties);
      applyNode3DTransform(mesh, properties);

      expect(mesh.position.x).toBe(2);
      expect(mesh.position.y).toBe(3);
      expect(mesh.position.z).toBe(4);
    });
  });

  describe('Material Override', () => {
    it('should apply materialOverride to mesh when scene provided', async () => {
      const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

      const mockScene = {
        internalResources: [
          {
            id: 'StandardMaterial3D_red',
            type: 'StandardMaterial3D',
            data: { id: 'StandardMaterial3D_red', albedo_color: 'Color(1, 0, 0, 1)' },
          },
          {
            id: 'BoxMesh_1',
            type: 'BoxMesh',
            data: { id: 'BoxMesh_1' },
            renderedObject: boxGeometry,
          },
        ],
        externalResources: [],
        nodes: [],
      };

      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        mesh: 'SubResource("BoxMesh_1")',
        materialOverride: 'SubResource("StandardMaterial3D_red")',
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = await createMeshInstance3D('TestMesh', properties, mockScene as any);

      expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const material = mesh.material as THREE.MeshStandardMaterial;
      expect(material.color.getHex()).toBe(0xff0000);
    });

    it('should apply surface_material_override to specific surface (Map format)', async () => {
      const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

      const mockScene = {
        internalResources: [
          {
            id: 'StandardMaterial3D_blue',
            type: 'StandardMaterial3D',
            data: { id: 'StandardMaterial3D_blue', albedo_color: 'Color(0, 0, 1, 1)' },
          },
          {
            id: 'BoxMesh_1',
            type: 'BoxMesh',
            data: { id: 'BoxMesh_1' },
            renderedObject: boxGeometry,
          },
        ],
        externalResources: [],
        nodes: [],
      };

      const surfaceOverrides = new Map<number, string>();
      surfaceOverrides.set(0, 'SubResource("StandardMaterial3D_blue")');

      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        mesh: 'SubResource("BoxMesh_1")',
        surfaceMaterialOverrides: surfaceOverrides,
      };

      const mesh = await createMeshInstance3D('TestMesh', properties, mockScene as any);

      expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const material = mesh.material as THREE.MeshStandardMaterial;
      expect(material.color.getHex()).toBe(0x0000ff);
    });

    it('should apply surface_material_override to specific surface (plain object format)', async () => {
      const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

      const mockScene = {
        internalResources: [
          {
            id: 'StandardMaterial3D_green',
            type: 'StandardMaterial3D',
            data: { id: 'StandardMaterial3D_green', albedo_color: 'Color(0, 1, 0, 1)' },
          },
          {
            id: 'BoxMesh_1',
            type: 'BoxMesh',
            data: { id: 'BoxMesh_1' },
            renderedObject: boxGeometry,
          },
        ],
        externalResources: [],
        nodes: [],
      };

      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        mesh: 'SubResource("BoxMesh_1")',
        surfaceMaterialOverrides: { 0: 'SubResource("StandardMaterial3D_green")' } as any,
      };

      const mesh = await createMeshInstance3D('TestMesh', properties, mockScene as any);

      expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const material = mesh.material as THREE.MeshStandardMaterial;
      expect(material.color.getHex()).toBe(0x00ff00);
    });

    it('should prioritize surface_material_override over materialOverride', async () => {
      const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

      const mockScene = {
        internalResources: [
          {
            id: 'StandardMaterial3D_red',
            type: 'StandardMaterial3D',
            data: { id: 'StandardMaterial3D_red', albedo_color: 'Color(1, 0, 0, 1)' },
          },
          {
            id: 'StandardMaterial3D_blue',
            type: 'StandardMaterial3D',
            data: { id: 'StandardMaterial3D_blue', albedo_color: 'Color(0, 0, 1, 1)' },
          },
          {
            id: 'BoxMesh_1',
            type: 'BoxMesh',
            data: { id: 'BoxMesh_1' },
            renderedObject: boxGeometry,
          },
        ],
        externalResources: [],
        nodes: [],
      };

      const surfaceOverrides = new Map<number, string>();
      surfaceOverrides.set(0, 'SubResource("StandardMaterial3D_blue")');

      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        mesh: 'SubResource("BoxMesh_1")',
        materialOverride: 'SubResource("StandardMaterial3D_red")',
        surfaceMaterialOverrides: surfaceOverrides,
      };

      const mesh = await createMeshInstance3D('TestMesh', properties, mockScene as any);

      // Blue should win (surface override takes precedence)
      expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const material = mesh.material as THREE.MeshStandardMaterial;
      expect(material.color.getHex()).toBe(0x0000ff);
    });

    it('should handle multiple surface overrides', async () => {
      const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

      const mockScene = {
        internalResources: [
          {
            id: 'StandardMaterial3D_red',
            type: 'StandardMaterial3D',
            data: { id: 'StandardMaterial3D_red', albedo_color: 'Color(1, 0, 0, 1)' },
          },
          {
            id: 'StandardMaterial3D_blue',
            type: 'StandardMaterial3D',
            data: { id: 'StandardMaterial3D_blue', albedo_color: 'Color(0, 0, 1, 1)' },
          },
          {
            id: 'StandardMaterial3D_green',
            type: 'StandardMaterial3D',
            data: { id: 'StandardMaterial3D_green', albedo_color: 'Color(0, 1, 0, 1)' },
          },
          {
            id: 'BoxMesh_1',
            type: 'BoxMesh',
            data: { id: 'BoxMesh_1' },
            renderedObject: boxGeometry,
          },
        ],
        externalResources: [],
        nodes: [],
      };

      const surfaceOverrides = new Map<number, string>();
      surfaceOverrides.set(0, 'SubResource("StandardMaterial3D_red")');
      surfaceOverrides.set(1, 'SubResource("StandardMaterial3D_blue")');
      surfaceOverrides.set(2, 'SubResource("StandardMaterial3D_green")');

      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        mesh: 'SubResource("BoxMesh_1")',
        surfaceMaterialOverrides: surfaceOverrides,
      };

      const mesh = await createMeshInstance3D('TestMesh', properties, mockScene as any);

      expect(Array.isArray(mesh.material)).toBe(true);
      const materials = mesh.material as THREE.Material[];
      expect(materials.length).toBe(3);
      expect(materials[0]).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(materials[1]).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(materials[2]).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect((materials[0] as THREE.MeshStandardMaterial).color.getHex()).toBe(0xff0000);
      expect((materials[1] as THREE.MeshStandardMaterial).color.getHex()).toBe(0x0000ff);
      expect((materials[2] as THREE.MeshStandardMaterial).color.getHex()).toBe(0x00ff00);
    });

    it('should use default material when no overrides specified', async () => {
      const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

      const mockScene = {
        internalResources: [
          {
            id: 'BoxMesh_1',
            type: 'BoxMesh',
            data: { id: 'BoxMesh_1' },
            renderedObject: boxGeometry,
          },
        ],
        externalResources: [],
        nodes: [],
      };

      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        mesh: 'SubResource("BoxMesh_1")',
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = await createMeshInstance3D('TestMesh', properties, mockScene as any);

      expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const material = mesh.material as THREE.MeshStandardMaterial;
      expect(material.color.getHex()).toBe(0xcccccc);
    });

    it('should handle missing material reference gracefully', async () => {
      const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

      const mockScene = {
        internalResources: [
          {
            id: 'BoxMesh_1',
            type: 'BoxMesh',
            data: { id: 'BoxMesh_1' },
            renderedObject: boxGeometry,
          },
        ],
        externalResources: [],
        nodes: [],
      };

      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        mesh: 'SubResource("BoxMesh_1")',
        materialOverride: 'SubResource("NonExistent")',
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = await createMeshInstance3D('TestMesh', properties, mockScene as any);

      // Should fall back to default material
      expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const material = mesh.material as THREE.MeshStandardMaterial;
      expect(material.color.getHex()).toBe(0xcccccc);
    });
  });

  describe('Mesh Material Support', () => {
    it('should use mesh material when mesh has material property', async () => {
      const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

      const mockScene = {
        internalResources: [
          {
            id: 'StandardMaterial3D_yellow',
            type: 'StandardMaterial3D',
            data: { id: 'StandardMaterial3D_yellow', albedo_color: 'Color(1, 1, 0, 1)' },
          },
          {
            id: 'BoxMesh_1',
            type: 'BoxMesh',
            data: { id: 'BoxMesh_1', material: 'SubResource("StandardMaterial3D_yellow")' },
            renderedObject: boxGeometry,
          },
        ],
        externalResources: [],
        nodes: [],
      };

      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        mesh: 'SubResource("BoxMesh_1")',
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = await createMeshInstance3D('TestMesh', properties, mockScene as any);

      expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const material = mesh.material as THREE.MeshStandardMaterial;
      expect(material.color.getHex()).toBe(0xffff00); // Yellow
    });

    it('should use default material when mesh has no material property', async () => {
      const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

      const mockScene = {
        internalResources: [
          {
            id: 'BoxMesh_1',
            type: 'BoxMesh',
            data: { id: 'BoxMesh_1' },
            renderedObject: boxGeometry,
          },
        ],
        externalResources: [],
        nodes: [],
      };

      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        mesh: 'SubResource("BoxMesh_1")',
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = await createMeshInstance3D('TestMesh', properties, mockScene as any);

      expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const material = mesh.material as THREE.MeshStandardMaterial;
      expect(material.color.getHex()).toBe(0xcccccc); // Default gray
    });

    it('should prioritize materialOverride over mesh material', async () => {
      const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

      const mockScene = {
        internalResources: [
          {
            id: 'StandardMaterial3D_yellow',
            type: 'StandardMaterial3D',
            data: { id: 'StandardMaterial3D_yellow', albedo_color: 'Color(1, 1, 0, 1)' },
          },
          {
            id: 'StandardMaterial3D_red',
            type: 'StandardMaterial3D',
            data: { id: 'StandardMaterial3D_red', albedo_color: 'Color(1, 0, 0, 1)' },
          },
          {
            id: 'BoxMesh_1',
            type: 'BoxMesh',
            data: { id: 'BoxMesh_1', material: 'SubResource("StandardMaterial3D_yellow")' },
            renderedObject: boxGeometry,
          },
        ],
        externalResources: [],
        nodes: [],
      };

      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        mesh: 'SubResource("BoxMesh_1")',
        materialOverride: 'SubResource("StandardMaterial3D_red")',
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = await createMeshInstance3D('TestMesh', properties, mockScene as any);

      expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const material = mesh.material as THREE.MeshStandardMaterial;
      expect(material.color.getHex()).toBe(0xff0000); // Red from override, not yellow from mesh
    });

    it('should prioritize surface_material_override over mesh material', async () => {
      const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

      const mockScene = {
        internalResources: [
          {
            id: 'StandardMaterial3D_yellow',
            type: 'StandardMaterial3D',
            data: { id: 'StandardMaterial3D_yellow', albedo_color: 'Color(1, 1, 0, 1)' },
          },
          {
            id: 'StandardMaterial3D_blue',
            type: 'StandardMaterial3D',
            data: { id: 'StandardMaterial3D_blue', albedo_color: 'Color(0, 0, 1, 1)' },
          },
          {
            id: 'BoxMesh_1',
            type: 'BoxMesh',
            data: { id: 'BoxMesh_1', material: 'SubResource("StandardMaterial3D_yellow")' },
            renderedObject: boxGeometry,
          },
        ],
        externalResources: [],
        nodes: [],
      };

      const surfaceOverrides = new Map<number, string>();
      surfaceOverrides.set(0, 'SubResource("StandardMaterial3D_blue")');

      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        mesh: 'SubResource("BoxMesh_1")',
        surfaceMaterialOverrides: surfaceOverrides,
      };

      const mesh = await createMeshInstance3D('TestMesh', properties, mockScene as any);

      expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const material = mesh.material as THREE.MeshStandardMaterial;
      expect(material.color.getHex()).toBe(0x0000ff); // Blue from surface override, not yellow from mesh
    });

    it('should handle invalid mesh material reference gracefully', async () => {
      const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

      const mockScene = {
        internalResources: [
          {
            id: 'BoxMesh_1',
            type: 'BoxMesh',
            data: { id: 'BoxMesh_1', material: 'SubResource("NonExistent")' },
            renderedObject: boxGeometry,
          },
        ],
        externalResources: [],
        nodes: [],
      };

      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        mesh: 'SubResource("BoxMesh_1")',
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = await createMeshInstance3D('TestMesh', properties, mockScene as any);

      // Should fall back to default material
      expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const material = mesh.material as THREE.MeshStandardMaterial;
      expect(material.color.getHex()).toBe(0xcccccc); // Default gray
    });

    it('should validate complete material precedence: mesh < materialOverride < surface override', async () => {
      const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

      const mockScene = {
        internalResources: [
          {
            id: 'StandardMaterial3D_yellow',
            type: 'StandardMaterial3D',
            data: { id: 'StandardMaterial3D_yellow', albedo_color: 'Color(1, 1, 0, 1)' },
          },
          {
            id: 'StandardMaterial3D_red',
            type: 'StandardMaterial3D',
            data: { id: 'StandardMaterial3D_red', albedo_color: 'Color(1, 0, 0, 1)' },
          },
          {
            id: 'StandardMaterial3D_blue',
            type: 'StandardMaterial3D',
            data: { id: 'StandardMaterial3D_blue', albedo_color: 'Color(0, 0, 1, 1)' },
          },
          {
            id: 'BoxMesh_1',
            type: 'BoxMesh',
            data: { id: 'BoxMesh_1', material: 'SubResource("StandardMaterial3D_yellow")' },
            renderedObject: boxGeometry,
          },
        ],
        externalResources: [],
        nodes: [],
      };

      const surfaceOverrides = new Map<number, string>();
      surfaceOverrides.set(0, 'SubResource("StandardMaterial3D_blue")');

      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        mesh: 'SubResource("BoxMesh_1")',
        materialOverride: 'SubResource("StandardMaterial3D_red")',
        surfaceMaterialOverrides: surfaceOverrides,
      };

      const mesh = await createMeshInstance3D('TestMesh', properties, mockScene as any);

      expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const material = mesh.material as THREE.MeshStandardMaterial;
      // Blue should win (highest precedence)
      expect(material.color.getHex()).toBe(0x0000ff);
    });
  });

  describe('Surface Index Validation', () => {
    it('should reject negative surface indices', async () => {
      const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

      const mockScene = {
        internalResources: [
          {
            id: 'StandardMaterial3D_red',
            type: 'StandardMaterial3D',
            data: { id: 'StandardMaterial3D_red', albedo_color: 'Color(1, 0, 0, 1)' },
          },
          {
            id: 'BoxMesh_1',
            type: 'BoxMesh',
            data: { id: 'BoxMesh_1' },
            renderedObject: boxGeometry,
          },
        ],
        externalResources: [],
        nodes: [],
      };

      const surfaceOverrides = new Map<number, string>();
      surfaceOverrides.set(-1, 'SubResource("StandardMaterial3D_red")');

      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        mesh: 'SubResource("BoxMesh_1")',
        surfaceMaterialOverrides: surfaceOverrides,
      };

      await createMeshInstance3D('TestMesh', properties, mockScene as any);

      // Should log warning and skip invalid index
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('is negative')
      );
    });

    it('should warn about unusually high surface indices but accept them', async () => {
      const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

      const mockScene = {
        internalResources: [
          {
            id: 'StandardMaterial3D_red',
            type: 'StandardMaterial3D',
            data: { id: 'StandardMaterial3D_red', albedo_color: 'Color(1, 0, 0, 1)' },
          },
          {
            id: 'BoxMesh_1',
            type: 'BoxMesh',
            data: { id: 'BoxMesh_1' },
            renderedObject: boxGeometry,
          },
        ],
        externalResources: [],
        nodes: [],
      };

      const surfaceOverrides = new Map<number, string>();
      surfaceOverrides.set(256, 'SubResource("StandardMaterial3D_red")');

      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        mesh: 'SubResource("BoxMesh_1")',
        surfaceMaterialOverrides: surfaceOverrides,
      };

      const mesh = await createMeshInstance3D('TestMesh', properties, mockScene as any);

      // Should log warning about unusually high index
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('unusually high')
      );

      // But should still apply the material
      expect(Array.isArray(mesh.material)).toBe(true);
      const materials = mesh.material as THREE.Material[];
      expect(materials[256]).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect((materials[256] as THREE.MeshStandardMaterial).color.getHex()).toBe(0xff0000);
    });

    it('should accept surface index 0 (lower boundary)', async () => {
      const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

      const mockScene = {
        internalResources: [
          {
            id: 'StandardMaterial3D_blue',
            type: 'StandardMaterial3D',
            data: { id: 'StandardMaterial3D_blue', albedo_color: 'Color(0, 0, 1, 1)' },
          },
          {
            id: 'BoxMesh_1',
            type: 'BoxMesh',
            data: { id: 'BoxMesh_1' },
            renderedObject: boxGeometry,
          },
        ],
        externalResources: [],
        nodes: [],
      };

      const surfaceOverrides = new Map<number, string>();
      surfaceOverrides.set(0, 'SubResource("StandardMaterial3D_blue")');

      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        mesh: 'SubResource("BoxMesh_1")',
        surfaceMaterialOverrides: surfaceOverrides,
      };

      const mesh = await createMeshInstance3D('TestMesh', properties, mockScene as any);

      expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const material = mesh.material as THREE.MeshStandardMaterial;
      expect(material.color.getHex()).toBe(0x0000ff);
    });

    it('should accept high surface index with warning', async () => {
      const boxGeometry = new THREE.BoxGeometry(1, 1, 1);

      const mockScene = {
        internalResources: [
          {
            id: 'StandardMaterial3D_green',
            type: 'StandardMaterial3D',
            data: { id: 'StandardMaterial3D_green', albedo_color: 'Color(0, 1, 0, 1)' },
          },
          {
            id: 'BoxMesh_1',
            type: 'BoxMesh',
            data: { id: 'BoxMesh_1' },
            renderedObject: boxGeometry,
          },
        ],
        externalResources: [],
        nodes: [],
      };

      const surfaceOverrides = new Map<number, string>();
      surfaceOverrides.set(255, 'SubResource("StandardMaterial3D_green")');

      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        mesh: 'SubResource("BoxMesh_1")',
        surfaceMaterialOverrides: surfaceOverrides,
      };

      const mesh = await createMeshInstance3D('TestMesh', properties, mockScene as any);

      // Should warn about high index (255 > 32 threshold)
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('unusually high')
      );

      // Should create 256 material slots (0-255) and apply the material
      expect(Array.isArray(mesh.material)).toBe(true);
      const materials = mesh.material as THREE.Material[];
      expect(materials.length).toBe(256);
      expect((materials[255] as THREE.MeshStandardMaterial).color.getHex()).toBe(0x00ff00);
    });
  });
});
