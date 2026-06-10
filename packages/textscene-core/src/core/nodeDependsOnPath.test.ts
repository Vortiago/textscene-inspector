/**
 * Tests for nodeDependsOnPath — the dependency walk used to decide which
 * MeshInstance3D nodes must re-render when a resource path (re)arrives.
 *
 * Pins: which property fields are walked (mesh, materialOverride,
 * materialOverlay, surfaceMaterialOverrides), ExtResource id → path
 * resolution via the scene's ResourceLoader metadata, SubResource
 * recursion (mesh → material → texture), cycle safety, and negatives.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { nodeDependsOnPath } from './nodeDependsOnPath';
import { ResourceLoader } from '../resources/ResourceLoader';
import type { TscnNode, TscnScene, TscnInternalResource } from '../parser/types';

const TEX_PATH = 'res://textures/shared.png';
const MESH_PATH = 'res://meshes/rock.res';

const meshNode = (properties: Record<string, unknown>): TscnNode => ({
  name: 'Mesh',
  type: 'MeshInstance3D',
  children: [],
  properties,
});

function makeScene(internalResources: TscnInternalResource[] = []): TscnScene {
  const loader = new ResourceLoader();
  loader.register({ id: 'tex_1', path: TEX_PATH, type: 'Texture2D' });
  loader.register({ id: 'mesh_ext', path: MESH_PATH, type: 'Mesh' });
  return {
    nodes: [],
    externalResources: [],
    internalResources,
    resourceLoader: loader,
  };
}

describe('nodeDependsOnPath', () => {
  let scene: TscnScene;

  beforeEach(() => {
    scene = makeScene();
  });

  describe('node type gate', () => {
    it('returns false for non-MeshInstance3D nodes even when properties reference the path', () => {
      const sprite: TscnNode = {
        name: 'Sprite',
        type: 'Sprite3D',
        children: [],
        properties: { mesh: 'ExtResource("tex_1")' },
      };

      expect(nodeDependsOnPath(sprite, TEX_PATH, scene)).toBe(false);
    });
  });

  describe('walked property fields (ExtResource direct refs)', () => {
    it('mesh resolves through the registered ExtResource id', () => {
      const node = meshNode({ mesh: 'ExtResource("mesh_ext")' });

      expect(nodeDependsOnPath(node, MESH_PATH, scene)).toBe(true);
      expect(nodeDependsOnPath(node, TEX_PATH, scene)).toBe(false);
    });

    it('materialOverride is walked', () => {
      const node = meshNode({ materialOverride: 'ExtResource("tex_1")' });

      expect(nodeDependsOnPath(node, TEX_PATH, scene)).toBe(true);
    });

    it('materialOverlay is walked', () => {
      const node = meshNode({ materialOverlay: 'ExtResource("tex_1")' });

      expect(nodeDependsOnPath(node, TEX_PATH, scene)).toBe(true);
    });

    it('surfaceMaterialOverrides is walked in both Map and plain-object form', () => {
      const asMap = meshNode({
        surfaceMaterialOverrides: new Map([[0, 'ExtResource("tex_1")']]),
      });
      const asObject = meshNode({
        surfaceMaterialOverrides: { 0: 'ExtResource("tex_1")' },
      });

      expect(nodeDependsOnPath(asMap, TEX_PATH, scene)).toBe(true);
      expect(nodeDependsOnPath(asObject, TEX_PATH, scene)).toBe(true);
    });

    it('properties outside the walked set are ignored', () => {
      const node = meshNode({ skin: 'ExtResource("tex_1")', custom: 'ExtResource("tex_1")' });

      expect(nodeDependsOnPath(node, TEX_PATH, scene)).toBe(false);
    });
  });

  describe('SubResource recursion', () => {
    it('follows mesh -> material -> albedo texture to an ExtResource path', () => {
      scene = makeScene([
        {
          id: 'mesh_1',
          type: 'BoxMesh',
          data: { id: 'mesh_1', material: 'SubResource("mat_1")' },
        },
        {
          id: 'mat_1',
          type: 'StandardMaterial3D',
          data: { id: 'mat_1', albedo_texture: 'ExtResource("tex_1")' },
        },
      ]);
      const node = meshNode({ mesh: 'SubResource("mesh_1")' });

      expect(nodeDependsOnPath(node, TEX_PATH, scene)).toBe(true);
      expect(nodeDependsOnPath(node, 'res://textures/other.png', scene)).toBe(false);
    });

    it('walks every data field of a SubResource (not just material/texture keys)', () => {
      scene = makeScene([
        {
          id: 'mesh_1',
          type: 'BoxMesh',
          data: { id: 'mesh_1', anything_goes: 'ExtResource("tex_1")' },
        },
      ]);
      const node = meshNode({ mesh: 'SubResource("mesh_1")' });

      expect(nodeDependsOnPath(node, TEX_PATH, scene)).toBe(true);
    });

    it('tolerates whitespace inside the reference syntax', () => {
      scene = makeScene([
        {
          id: 'mesh_1',
          type: 'BoxMesh',
          data: { id: 'mesh_1', material: 'ExtResource( "tex_1" )' },
        },
      ]);
      const node = meshNode({ mesh: 'SubResource( "mesh_1" )' });

      expect(nodeDependsOnPath(node, TEX_PATH, scene)).toBe(true);
    });

    it('is cycle-safe: mutually-referencing SubResources terminate and return false', () => {
      scene = makeScene([
        { id: 'a', type: 'Material', data: { id: 'a', next_pass: 'SubResource("b")' } },
        { id: 'b', type: 'Material', data: { id: 'b', next_pass: 'SubResource("a")' } },
      ]);
      const node = meshNode({ materialOverride: 'SubResource("a")' });

      expect(nodeDependsOnPath(node, TEX_PATH, scene)).toBe(false);
    });
  });

  describe('negative cases', () => {
    it('returns false for plain (non-reference) property values', () => {
      const node = meshNode({ mesh: 'BoxMesh', materialOverride: 42 });

      expect(nodeDependsOnPath(node, TEX_PATH, scene)).toBe(false);
    });

    it('returns false for an unknown SubResource id', () => {
      const node = meshNode({ mesh: 'SubResource("ghost")' });

      expect(nodeDependsOnPath(node, TEX_PATH, scene)).toBe(false);
    });

    it('returns false for an ExtResource id with no registered metadata', () => {
      const node = meshNode({ mesh: 'ExtResource("unregistered")' });

      expect(nodeDependsOnPath(node, TEX_PATH, scene)).toBe(false);
    });

    it('returns false when the scene has no ResourceLoader wired', () => {
      const bare: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [],
      };
      const node = meshNode({ mesh: 'ExtResource("tex_1")' });

      expect(nodeDependsOnPath(node, TEX_PATH, bare)).toBe(false);
    });

    it('returns false for a node with no walkable properties at all', () => {
      const node = meshNode({});

      expect(nodeDependsOnPath(node, TEX_PATH, scene)).toBe(false);
    });
  });
});
