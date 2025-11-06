/**
 * Tests for deeply nested external scenes (3+ levels)
 * Validates "resolve early, use late" architecture for nested hierarchies
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SceneManager } from './SceneManager';
import { TscnParser } from '../parser/TscnParser';
import { NodeTracker } from './NodeTracker';
import { NodeLifecycleManager } from './NodeLifecycleManager';
import { ResourceRegistry } from '../resources/ResourceRegistry';
import type { ResourceProvider, MissingResource } from '../resources/ResourceProvider';
import * as THREE from 'three';

describe('SceneManager - Nested External Scenes (3+ Levels)', () => {
  let sceneManager: SceneManager;
  let parser: TscnParser;
  let nodeTracker: NodeTracker;
  let nodeLifecycle: NodeLifecycleManager;
  let resourceRegistry: ResourceRegistry;
  let threeScene: THREE.Scene;

  // Level 3 (leaf): Orange sphere - no dependencies
  const leafSceneContent = `[gd_scene load_steps=3 format=3 uid="uid://test_nested_leaf"]

[sub_resource type="SphereMesh" id="SphereMesh_1"]
radius = 0.5

[sub_resource type="StandardMaterial3D" id="Material_1"]
albedo_color = Color(1, 0.6, 0.2, 1)

[node name="NestedLeaf" type="Node3D"]

[node name="LeafSphere" type="MeshInstance3D" parent="."]
mesh = SubResource("SphereMesh_1")
surface_material_override/0 = SubResource("Material_1")
`;

  // Level 2 (middle): Blue box + references leaf
  const middleSceneContent = `[gd_scene load_steps=4 format=3 uid="uid://test_nested_middle"]

[ext_resource type="PackedScene" uid="uid://test_nested_leaf" path="res://test-nested-leaf.tscn" id="1_leaf"]

[sub_resource type="BoxMesh" id="BoxMesh_1"]
size = Vector3(1, 1, 1)

[sub_resource type="StandardMaterial3D" id="Material_1"]
albedo_color = Color(0.2, 0.5, 1, 1)

[node name="NestedMiddle" type="Node3D"]

[node name="MiddleBox" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -2, 0, 0)
mesh = SubResource("BoxMesh_1")
surface_material_override/0 = SubResource("Material_1")

[node name="LeafInstance" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)
instance = ExtResource("1_leaf")
`;

  // Level 1 (top): Green cylinder + references middle
  const topSceneContent = `[gd_scene load_steps=4 format=3 uid="uid://test_nested_top"]

[ext_resource type="PackedScene" uid="uid://test_nested_middle" path="res://test-nested-middle.tscn" id="1_middle"]

[sub_resource type="CylinderMesh" id="CylinderMesh_1"]
height = 2.0

[sub_resource type="StandardMaterial3D" id="Material_1"]
albedo_color = Color(0.2, 0.8, 0.3, 1)

[node name="NestedTop" type="Node3D"]

[node name="TopCylinder" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, -3)
mesh = SubResource("CylinderMesh_1")
surface_material_override/0 = SubResource("Material_1")

[node name="MiddleInstance" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 3)
instance = ExtResource("1_middle")
`;

  beforeEach(() => {
    parser = new TscnParser();
    nodeTracker = new NodeTracker();
    threeScene = new THREE.Scene();
    nodeLifecycle = new NodeLifecycleManager(threeScene, nodeTracker);

    sceneManager = new SceneManager(parser, nodeTracker);
    sceneManager.setNodeLifecycleManager(nodeLifecycle);

    // Set up circular dependency
    nodeLifecycle.setSceneManager(sceneManager);

    // Create resource registry with test provider for all 3 levels
    resourceRegistry = new ResourceRegistry();

    const testProvider: ResourceProvider = {
      loadResource: async (path: string, _type: string) => {
        switch (path) {
          case 'res://test-nested-leaf.tscn':
            return leafSceneContent;
          case 'res://test-nested-middle.tscn':
            return middleSceneContent;
          case 'res://test-nested-top.tscn':
            return topSceneContent;
          default:
            throw new Error(`Resource not found: ${path}`);
        }
      }
    };

    resourceRegistry.setProvider(testProvider);
    sceneManager.setResourceRegistry(resourceRegistry);
  });

  describe('3-Level Hierarchy Resolution', () => {
    it('should resolve and render all 3 levels of nested external scenes', async () => {
      // Parse top scene
      const topScene = parser.parse(topSceneContent);
      topScene.resourceRegistry = resourceRegistry;

      // Register top scene's external resources (middle scene)
      for (const extResource of topScene.externalResources) {
        resourceRegistry.register(extResource);
      }

      // Add all nodes from top scene (triggers L1→L2→L3 cascade)
      for (const node of topScene.nodes) {
        await nodeLifecycle.addNode(node.name, node, topScene);
      }

      const allPaths = nodeTracker.getAllPaths();

      // Level 1: Top scene nodes
      expect(allPaths).toContain('NestedTop');
      expect(allPaths).toContain('NestedTop/TopCylinder');
      expect(allPaths).toContain('NestedTop/MiddleInstance');

      // Level 2: Middle scene nodes (loaded from L1 instance)
      expect(allPaths).toContain('NestedTop/MiddleInstance/NestedMiddle');
      expect(allPaths).toContain('NestedTop/MiddleInstance/NestedMiddle/MiddleBox');
      expect(allPaths).toContain('NestedTop/MiddleInstance/NestedMiddle/LeafInstance');

      // Level 3: Leaf scene nodes (loaded from L2 instance) - KEY TEST
      expect(allPaths).toContain('NestedTop/MiddleInstance/NestedMiddle/LeafInstance/NestedLeaf');
      expect(allPaths).toContain('NestedTop/MiddleInstance/NestedMiddle/LeafInstance/NestedLeaf/LeafSphere');
    });

    it('should create THREE.js objects for all nested levels', async () => {
      const topScene = parser.parse(topSceneContent);
      topScene.resourceRegistry = resourceRegistry;

      for (const extResource of topScene.externalResources) {
        resourceRegistry.register(extResource);
      }

      for (const node of topScene.nodes) {
        await nodeLifecycle.addNode(node.name, node, topScene);
      }

      // Level 1 objects
      expect(nodeTracker.getObject('NestedTop')).toBeInstanceOf(THREE.Object3D);
      expect(nodeTracker.getObject('NestedTop/TopCylinder')).toBeInstanceOf(THREE.Mesh);

      // Level 2 objects
      expect(nodeTracker.getObject('NestedTop/MiddleInstance/NestedMiddle')).toBeInstanceOf(THREE.Object3D);
      expect(nodeTracker.getObject('NestedTop/MiddleInstance/NestedMiddle/MiddleBox')).toBeInstanceOf(THREE.Mesh);

      // Level 3 objects - KEY TEST
      expect(nodeTracker.getObject('NestedTop/MiddleInstance/NestedMiddle/LeafInstance/NestedLeaf')).toBeInstanceOf(THREE.Object3D);
      expect(nodeTracker.getObject('NestedTop/MiddleInstance/NestedMiddle/LeafInstance/NestedLeaf/LeafSphere')).toBeInstanceOf(THREE.Mesh);
    });

    it('should maintain correct instanceRoot metadata across all levels', async () => {
      const topScene = parser.parse(topSceneContent);
      topScene.resourceRegistry = resourceRegistry;

      for (const extResource of topScene.externalResources) {
        resourceRegistry.register(extResource);
      }

      for (const node of topScene.nodes) {
        await nodeLifecycle.addNode(node.name, node, topScene);
      }

      // Level 2 nodes should have L1 instance as root
      const middleRoot = nodeTracker.getObject('NestedTop/MiddleInstance/NestedMiddle');
      expect(middleRoot?.userData.instanceRoot).toBe('NestedTop/MiddleInstance');

      const middleBox = nodeTracker.getObject('NestedTop/MiddleInstance/NestedMiddle/MiddleBox');
      expect(middleBox?.userData.instanceRoot).toBe('NestedTop/MiddleInstance');

      // Level 3 nodes should have L2 instance as root - KEY TEST
      const leafRoot = nodeTracker.getObject('NestedTop/MiddleInstance/NestedMiddle/LeafInstance/NestedLeaf');
      expect(leafRoot?.userData.instanceRoot).toBe('NestedTop/MiddleInstance/NestedMiddle/LeafInstance');

      const leafSphere = nodeTracker.getObject('NestedTop/MiddleInstance/NestedMiddle/LeafInstance/NestedLeaf/LeafSphere');
      expect(leafSphere?.userData.instanceRoot).toBe('NestedTop/MiddleInstance/NestedMiddle/LeafInstance');
    });

    it('should apply transforms correctly across nested levels', async () => {
      const topScene = parser.parse(topSceneContent);
      topScene.resourceRegistry = resourceRegistry;

      for (const extResource of topScene.externalResources) {
        resourceRegistry.register(extResource);
      }

      for (const node of topScene.nodes) {
        await nodeLifecycle.addNode(node.name, node, topScene);
      }

      // L1 instance transform
      const middleInstance = nodeTracker.getObject('NestedTop/MiddleInstance');
      expect(middleInstance?.position.z).toBeCloseTo(3, 5);

      // L2 instance transform (should be relative to MiddleInstance)
      const leafInstance = nodeTracker.getObject('NestedTop/MiddleInstance/NestedMiddle/LeafInstance');
      expect(leafInstance?.position.x).toBeCloseTo(2, 5);

      // Verify parent-child relationships
      const nestedMiddle = nodeTracker.getObject('NestedTop/MiddleInstance/NestedMiddle');
      expect(nestedMiddle?.parent).toBe(middleInstance);

      const nestedLeaf = nodeTracker.getObject('NestedTop/MiddleInstance/NestedMiddle/LeafInstance/NestedLeaf');
      expect(nestedLeaf?.parent).toBe(leafInstance);
    });
  });

  describe('Error Handling for Deep Nesting', () => {
    it('should invoke callback when Level 2 external scene is missing', async () => {
      const missingResources: MissingResource[] = [];
      const mockCallback = vi.fn(async (resource: MissingResource) => {
        missingResources.push(resource);
        return null;
      });

      sceneManager.setOnResourceNeeded(mockCallback);

      // Provider that only has top and leaf, but NOT middle
      const partialProvider: ResourceProvider = {
        loadResource: async (path: string, _type: string) => {
          if (path === 'res://test-nested-top.tscn') {
            return topSceneContent;
          }
          if (path === 'res://test-nested-leaf.tscn') {
            return leafSceneContent;
          }
          throw new Error(`Resource not found: ${path}`);
        }
      };

      resourceRegistry.setProvider(partialProvider);

      const topScene = parser.parse(topSceneContent);
      topScene.resourceRegistry = resourceRegistry;

      for (const extResource of topScene.externalResources) {
        resourceRegistry.register(extResource);
      }

      for (const node of topScene.nodes) {
        await nodeLifecycle.addNode(node.name, node, topScene);
      }

      // Should have invoked callback for missing middle scene
      expect(mockCallback).toHaveBeenCalled();
      expect(missingResources).toHaveLength(1);
      expect(missingResources[0]?.path).toBe('res://test-nested-middle.tscn');
      expect(missingResources[0]?.type).toBe('PackedScene');
    });

    it('should still render Level 1 nodes when Level 2 scene is missing', async () => {
      sceneManager.setOnResourceNeeded(async () => null);

      // Provider missing middle scene
      const partialProvider: ResourceProvider = {
        loadResource: async (path: string, _type: string) => {
          if (path === 'res://test-nested-top.tscn') {
            return topSceneContent;
          }
          throw new Error(`Resource not found: ${path}`);
        }
      };

      resourceRegistry.setProvider(partialProvider);

      const topScene = parser.parse(topSceneContent);
      topScene.resourceRegistry = resourceRegistry;

      for (const extResource of topScene.externalResources) {
        resourceRegistry.register(extResource);
      }

      for (const node of topScene.nodes) {
        await nodeLifecycle.addNode(node.name, node, topScene);
      }

      // Level 1 should still exist
      expect(nodeTracker.getObject('NestedTop')).toBeDefined();
      expect(nodeTracker.getObject('NestedTop/TopCylinder')).toBeDefined();
      expect(nodeTracker.getObject('NestedTop/MiddleInstance')).toBeDefined();

      // Level 2+ should NOT exist
      expect(nodeTracker.getObject('NestedTop/MiddleInstance/NestedMiddle')).toBeUndefined();
    });
  });
});
