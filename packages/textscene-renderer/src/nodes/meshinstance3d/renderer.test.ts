/**
 * Tests for MeshInstance3D renderer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { createMeshInstance3D } from './renderer';
import type { MeshInstance3DProperties } from './types';
import { applyNode3DTransform } from '../node3d/renderer';
import { parseTransform3D } from '../../utils/transform';
import * as logger from '../../logger';

describe('MeshInstance3D Renderer', () => {
  let loggerWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    loggerWarnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    loggerWarnSpy.mockRestore();
  });

  describe('createMeshInstance3D', () => {
    it('should create a THREE.Mesh', () => {
      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = createMeshInstance3D('TestMesh', properties);

      expect(mesh).toBeInstanceOf(THREE.Mesh);
    });

    it('should set the mesh name from nodeName', () => {
      const properties: MeshInstance3DProperties = {
        name: 'MyMeshInstance',
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = createMeshInstance3D('MyMeshInstance', properties);

      expect(mesh.name).toBe('MyMeshInstance');
    });

    it('should use placeholder BoxGeometry', () => {
      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = createMeshInstance3D('TestMesh', properties);

      expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
    });

    it('should use wireframe material for placeholder', () => {
      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = createMeshInstance3D('TestMesh', properties);

      expect(mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);
      const material = mesh.material as THREE.MeshBasicMaterial;
      expect(material.wireframe).toBe(true);
      expect(material.color.getHex()).toBe(0xff00ff);
    });

    it('should default receiveShadow to true', () => {
      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = createMeshInstance3D('TestMesh', properties);

      expect(mesh.receiveShadow).toBe(true);
    });

    it('should log warning when mesh property exists but no scene provided', () => {
      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        mesh: 'SubResource("BoxMesh_1")',
        surfaceMaterialOverrides: new Map(),
      };

      createMeshInstance3D('TestMesh', properties);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('No scene provided')
      );
    });
  });

  describe('Shadow Casting', () => {
    it('should set castShadow=false when castShadow=0 (OFF)', () => {
      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        castShadow: 0,
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = createMeshInstance3D('TestMesh', properties);

      expect(mesh.castShadow).toBe(false);
    });

    it('should set castShadow=true when castShadow=1 (ON)', () => {
      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        castShadow: 1,
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = createMeshInstance3D('TestMesh', properties);

      expect(mesh.castShadow).toBe(true);
    });

    it('should set castShadow=true and shadowSide=DoubleSide when castShadow=2 (DOUBLE_SIDED)', () => {
      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        castShadow: 2,
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = createMeshInstance3D('TestMesh', properties);

      expect(mesh.castShadow).toBe(true);
      const material = mesh.material as THREE.MeshBasicMaterial;
      expect(material.shadowSide).toBe(THREE.DoubleSide);
    });

    it('should set castShadow=true and visible=false when castShadow=3 (SHADOWS_ONLY)', () => {
      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        castShadow: 3,
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = createMeshInstance3D('TestMesh', properties);

      expect(mesh.castShadow).toBe(true);
      expect(mesh.visible).toBe(false);
    });

    it('should default to castShadow=false when castShadow is undefined', () => {
      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = createMeshInstance3D('TestMesh', properties);

      expect(mesh.castShadow).toBe(false);
    });
  });

  describe('Integration with Node3D Transform', () => {
    it('should work with applyNode3DTransform', () => {
      const transform = parseTransform3D('Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4)');
      const properties: MeshInstance3DProperties = {
        name: 'TestMesh',
        transform,
        surfaceMaterialOverrides: new Map(),
      };

      const mesh = createMeshInstance3D('TestMesh', properties);
      applyNode3DTransform(mesh, properties);

      expect(mesh.position.x).toBe(2);
      expect(mesh.position.y).toBe(3);
      expect(mesh.position.z).toBe(4);
    });
  });
});
