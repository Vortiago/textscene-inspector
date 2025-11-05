/**
 * Tests for SceneManager external scene rendering integration
 * Tests that verify external scenes are properly loaded and their nodes added to the graph
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SceneManager } from './SceneManager';
import { TscnParser } from '../parser/TscnParser';
import { NodeTracker } from './NodeTracker';
import { NodeLifecycleManager } from './NodeLifecycleManager';
import { ResourceRegistry } from '../resources/ResourceRegistry';
import type { ResourceProvider } from '../resources/ResourceProvider';
import * as THREE from 'three';
import type { TscnNode } from '../parser/types';

describe('SceneManager - External Scene Node Rendering', () => {
  let sceneManager: SceneManager;
  let parser: TscnParser;
  let nodeTracker: NodeTracker;
  let nodeLifecycle: NodeLifecycleManager;
  let resourceRegistry: ResourceRegistry;
  let threeScene: THREE.Scene;

  // Sample external scene content
  const childCubeScene = `[gd_scene load_steps=3 format=3 uid="uid://child_cube_scene"]

[sub_resource type="BoxMesh" id="BoxMesh_1"]
size = Vector3(1, 1, 1)

[sub_resource type="StandardMaterial3D" id="Material_1"]
albedo_color = Color(0.2, 0.6, 0.9, 1)

[node name="ChildCube" type="Node3D"]

[node name="Cube" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_1")
surface_material_override/0 = SubResource("Material_1")
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

    // Create resource registry with a test provider
    resourceRegistry = new ResourceRegistry();

    // Create a test resource provider
    const testProvider: ResourceProvider = {
      loadResource: async (path: string, _type: string) => {
        if (path === 'res://child_cube.tscn') {
          return childCubeScene;
        }
        throw new Error(`Resource not found: ${path}`);
      }
    };

    resourceRegistry.setProvider(testProvider);

    // Register the external resource so it can be loaded
    resourceRegistry.register({
      type: 'PackedScene',
      path: 'res://child_cube.tscn',
      id: '1_cube'
    });

    sceneManager.setResourceRegistry(resourceRegistry);
  });

  describe('External Scene Node Addition', () => {
    it('should add nodes from external scene to the graph', async () => {
      // Create the instance parent node first (this happens in real scenario)
      const instanceNode = new THREE.Object3D();
      instanceNode.userData.nodePath = 'MainScene/ChildInstance';
      threeScene.add(instanceNode);
      nodeTracker.set('MainScene/ChildInstance', instanceNode, {
        name: 'ChildInstance',
        type: 'Node3D',
        properties: {}
      } as TscnNode);

      // Load external scene
      await sceneManager.addScene('MainScene/ChildInstance', 'res://child_cube.tscn');

      // Verify external scene nodes were tracked
      const allPaths = nodeTracker.getAllPaths();

      // Should have the external scene's root node
      expect(allPaths).toContain('MainScene/ChildInstance/ChildCube');

      // Should have the mesh instance child
      expect(allPaths).toContain('MainScene/ChildInstance/ChildCube/Cube');
    });

    it('should create THREE.Object3D instances for external nodes', async () => {
      // Create the instance parent node first
      const instanceNode = new THREE.Object3D();
      instanceNode.userData.nodePath = 'MainScene/ChildInstance';
      threeScene.add(instanceNode);
      nodeTracker.set('MainScene/ChildInstance', instanceNode, {
        name: 'ChildInstance',
        type: 'Node3D',
        properties: {}
      } as TscnNode);

      await sceneManager.addScene('MainScene/ChildInstance', 'res://child_cube.tscn');

      // Verify objects were created
      const childCubeObject = nodeTracker.getObject('MainScene/ChildInstance/ChildCube');
      expect(childCubeObject).toBeDefined();
      expect(childCubeObject).toBeInstanceOf(THREE.Object3D);

      const cubeObject = nodeTracker.getObject('MainScene/ChildInstance/ChildCube/Cube');
      expect(cubeObject).toBeDefined();
      expect(cubeObject).toBeInstanceOf(THREE.Mesh);
    });

    it('should set instanceRoot userData on external scene nodes', async () => {
      // Create the instance parent node first
      const instanceNode = new THREE.Object3D();
      instanceNode.userData.nodePath = 'MainScene/ChildInstance';
      threeScene.add(instanceNode);
      nodeTracker.set('MainScene/ChildInstance', instanceNode, {
        name: 'ChildInstance',
        type: 'Node3D',
        properties: {}
      } as TscnNode);

      await sceneManager.addScene('MainScene/ChildInstance', 'res://child_cube.tscn');

      const childCubeObject = nodeTracker.getObject('MainScene/ChildInstance/ChildCube');
      const cubeObject = nodeTracker.getObject('MainScene/ChildInstance/ChildCube/Cube');

      // Both should have instanceRoot pointing to the instance path
      expect(childCubeObject?.userData.instanceRoot).toBe('MainScene/ChildInstance');
      expect(cubeObject?.userData.instanceRoot).toBe('MainScene/ChildInstance');
    });

    it('should maintain correct parent-child relationships in THREE.js graph', async () => {
      // First, we need to create the instance parent node manually
      // (normally this would be done by NodeLifecycleManager during full scene parsing)
      const instanceNode = new THREE.Object3D();
      instanceNode.userData.nodePath = 'MainScene/ChildInstance';
      threeScene.add(instanceNode);
      nodeTracker.set('MainScene/ChildInstance', instanceNode, {
        name: 'ChildInstance',
        type: 'Node3D',
        properties: {}
      } as TscnNode);

      // Now add the external scene
      await sceneManager.addScene('MainScene/ChildInstance', 'res://child_cube.tscn');

      // Verify parent-child relationships
      const childCubeObject = nodeTracker.getObject('MainScene/ChildInstance/ChildCube');
      const cubeObject = nodeTracker.getObject('MainScene/ChildInstance/ChildCube/Cube');

      // ChildCube should be child of instance node
      expect(childCubeObject?.parent).toBe(instanceNode);

      // Cube should be child of ChildCube
      expect(cubeObject?.parent).toBe(childCubeObject);
    });

    it('should handle multiple external scene instances', async () => {
      // Create multiple instance parent nodes
      for (let i = 1; i <= 3; i++) {
        const instanceNode = new THREE.Object3D();
        const instancePath = `MainScene/Instance${i}`;
        instanceNode.userData.nodePath = instancePath;
        threeScene.add(instanceNode);
        nodeTracker.set(instancePath, instanceNode, {
          name: `Instance${i}`,
          type: 'Node3D',
          properties: {}
        } as TscnNode);

        await sceneManager.addScene(instancePath, 'res://child_cube.tscn');
      }

      // Should have 3 sets of external scene nodes
      const allPaths = nodeTracker.getAllPaths();

      expect(allPaths).toContain('MainScene/Instance1/ChildCube');
      expect(allPaths).toContain('MainScene/Instance1/ChildCube/Cube');

      expect(allPaths).toContain('MainScene/Instance2/ChildCube');
      expect(allPaths).toContain('MainScene/Instance2/ChildCube/Cube');

      expect(allPaths).toContain('MainScene/Instance3/ChildCube');
      expect(allPaths).toContain('MainScene/Instance3/ChildCube/Cube');
    });
  });

  describe('Scene Caching', () => {
    it('should cache and reuse parsed external scenes', async () => {
      const loadSpy = vi.spyOn(resourceRegistry, 'loadByPath');

      // Add same scene twice
      await sceneManager.addScene('Instance1', 'res://child_cube.tscn');
      await sceneManager.addScene('Instance2', 'res://child_cube.tscn');

      // Should only load once (then use cache)
      expect(loadSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Integration with NodeLifecycleManager', () => {
    it('should work when called from NodeLifecycleManager.addNode', async () => {
      // Parse a scene that has an external instance
      const mainSceneContent = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://child_cube.tscn" id="1_cube"]

[node name="MainScene" type="Node3D"]

[node name="ChildInstance" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)
instance = ExtResource("1_cube")
`;

      const mainScene = parser.parse(mainSceneContent);
      mainScene.resourceRegistry = resourceRegistry;

      // Add all nodes from main scene (this should trigger external scene loading)
      for (const node of mainScene.nodes) {
        await nodeLifecycle.addNode(node.name, node, mainScene);
      }

      // Verify main scene nodes
      expect(nodeTracker.getObject('MainScene')).toBeDefined();
      expect(nodeTracker.getObject('MainScene/ChildInstance')).toBeDefined();

      // CRITICAL: Verify external scene nodes were added
      const externalRoot = nodeTracker.getObject('MainScene/ChildInstance/ChildCube');
      expect(externalRoot).toBeDefined();
      expect(externalRoot?.userData.nodeName).toBe('ChildCube');
      expect(externalRoot?.userData.instanceRoot).toBe('MainScene/ChildInstance');

      const externalMesh = nodeTracker.getObject('MainScene/ChildInstance/ChildCube/Cube');
      expect(externalMesh).toBeDefined();
      expect(externalMesh).toBeInstanceOf(THREE.Mesh);
      expect(externalMesh?.userData.nodeName).toBe('Cube');
      expect(externalMesh?.userData.instanceRoot).toBe('MainScene/ChildInstance');
    });

    it('should apply instance node transform to external scene root', async () => {
      const mainSceneContent = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://child_cube.tscn" id="1_cube"]

[node name="MainScene" type="Node3D"]

[node name="ChildInstance" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 10, 15)
instance = ExtResource("1_cube")
`;

      const mainScene = parser.parse(mainSceneContent);
      mainScene.resourceRegistry = resourceRegistry;

      for (const node of mainScene.nodes) {
        await nodeLifecycle.addNode(node.name, node, mainScene);
      }

      // Instance node should have transform applied
      const instanceObject = nodeTracker.getObject('MainScene/ChildInstance');
      expect(instanceObject?.position.x).toBeCloseTo(5, 5);
      expect(instanceObject?.position.y).toBeCloseTo(10, 5);
      expect(instanceObject?.position.z).toBeCloseTo(15, 5);

      // External scene nodes are children, so they inherit the transform
      const externalRoot = nodeTracker.getObject('MainScene/ChildInstance/ChildCube');
      expect(externalRoot?.parent).toBe(instanceObject);
    });
  });
});
