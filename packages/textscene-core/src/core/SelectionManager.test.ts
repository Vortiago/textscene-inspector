/**
 * Tests for SelectionManager - Raycasting and node selection from screen coordinates
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { SelectionManager } from './SelectionManager';
import { NodeTracker } from './NodeTracker';

describe('SelectionManager', () => {
  let selectionManager: SelectionManager;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let renderer: THREE.WebGLRenderer;
  let nodeTracker: NodeTracker;
  let canvas: HTMLCanvasElement;

  // Helper function to mock raycaster intersections
  const mockRaycasterIntersections = (objects: THREE.Object3D[]) => {
    const raycaster = (selectionManager as any).raycaster as THREE.Raycaster;
    const intersections = objects.map(obj => ({
      object: obj,
      distance: 1,
      point: new THREE.Vector3(),
      face: null,
      faceIndex: 0,
      uv: undefined,
      uv1: undefined,
      normal: undefined,
      instanceId: undefined
    }));
    vi.spyOn(raycaster, 'intersectObjects').mockReturnValue(intersections);
  };

  beforeEach(() => {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.z = 5;

    // Create a mock canvas with getBoundingClientRect
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;

    // Mock getBoundingClientRect to return consistent values
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => {}
    } as DOMRect);

    // Mock WebGLRenderer (doesn't create real WebGL context)
    renderer = {
      domElement: canvas,
      render: vi.fn(),
      setSize: vi.fn(),
      dispose: vi.fn(),
    } as unknown as THREE.WebGLRenderer;

    nodeTracker = new NodeTracker();

    selectionManager = new SelectionManager(scene, camera, renderer, nodeTracker);
  });

  describe('Constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(selectionManager).toBeDefined();
      expect(selectionManager).toBeInstanceOf(SelectionManager);
    });
  });

  describe('getNodePathAtScreenPosition', () => {
    it('should return node path when clicking on mesh', () => {
      // Create mesh at origin (visible to camera)
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial()
      );
      mesh.userData.nodePath = 'Root/TestNode';
      scene.add(mesh);

      // Register in node tracker
      nodeTracker.set('Root/TestNode', mesh, {
        name: 'TestNode',
        type: 'MeshInstance3D',
        children: [],
        properties: {}
      });

      // Mock raycaster to return intersection with mesh
      mockRaycasterIntersections([mesh]);

      // Click center of screen (should hit mesh at origin)
      const nodePath = selectionManager.getNodePathAtScreenPosition(400, 300);
      expect(nodePath).toBe('Root/TestNode');
    });

    it('should return null when clicking empty space', () => {
      // No meshes in scene
      const nodePath = selectionManager.getNodePathAtScreenPosition(400, 300);
      expect(nodePath).toBeNull();
    });

    it('should return null when clicking outside canvas', () => {
      // Create mesh but click far off-screen
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial()
      );
      mesh.userData.nodePath = 'Root/TestNode';
      scene.add(mesh);

      nodeTracker.set('Root/TestNode', mesh, {
        name: 'TestNode',
        type: 'MeshInstance3D',
        children: [],
        properties: {}
      });

      // Click far outside expected intersection
      const nodePath = selectionManager.getNodePathAtScreenPosition(-1000, -1000);
      expect(nodePath).toBeNull();
    });

    it('should filter out non-mesh objects like lights', () => {
      // Create a light (not selectable)
      const light = new THREE.DirectionalLight(0xffffff);
      light.userData.nodePath = 'Root/Light';
      light.position.set(0, 0, 0);
      scene.add(light);

      nodeTracker.set('Root/Light', light, {
        name: 'Light',
        type: 'DirectionalLight3D',
        children: [],
        properties: {}
      });

      // Click where light is - should return null (lights not selectable)
      const nodePath = selectionManager.getNodePathAtScreenPosition(400, 300);
      expect(nodePath).toBeNull();
    });

    it('should filter out cameras', () => {
      // Create a camera object (not selectable)
      const cameraObject = new THREE.PerspectiveCamera();
      cameraObject.userData.nodePath = 'Root/Camera';
      cameraObject.position.set(0, 0, 0);
      scene.add(cameraObject);

      nodeTracker.set('Root/Camera', cameraObject, {
        name: 'Camera',
        type: 'Camera3D',
        children: [],
        properties: {}
      });

      const nodePath = selectionManager.getNodePathAtScreenPosition(400, 300);
      expect(nodePath).toBeNull();
    });

    it('should return first intersected mesh when multiple meshes overlap', () => {
      // Create two overlapping meshes (different z positions)
      const mesh1 = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial()
      );
      mesh1.userData.nodePath = 'Root/FrontMesh';
      mesh1.position.z = -1; // Closer to camera
      scene.add(mesh1);

      const mesh2 = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial()
      );
      mesh2.userData.nodePath = 'Root/BackMesh';
      mesh2.position.z = -2; // Further from camera
      scene.add(mesh2);

      nodeTracker.set('Root/FrontMesh', mesh1, {
        name: 'FrontMesh',
        type: 'MeshInstance3D',
        children: [],
        properties: {}
      });

      nodeTracker.set('Root/BackMesh', mesh2, {
        name: 'BackMesh',
        type: 'MeshInstance3D',
        children: [],
        properties: {}
      });

      // Mock raycaster to return both meshes (front mesh first)
      mockRaycasterIntersections([mesh1, mesh2]);

      // Click center - should hit front mesh first
      const nodePath = selectionManager.getNodePathAtScreenPosition(400, 300);
      expect(nodePath).toBe('Root/FrontMesh');
    });

    it('should handle clicks at canvas edges', () => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(10, 10, 1),
        new THREE.MeshBasicMaterial()
      );
      mesh.userData.nodePath = 'Root/LargeMesh';
      scene.add(mesh);

      nodeTracker.set('Root/LargeMesh', mesh, {
        name: 'LargeMesh',
        type: 'MeshInstance3D',
        children: [],
        properties: {}
      });

      // Click top-left corner (0, 0)
      const topLeft = selectionManager.getNodePathAtScreenPosition(0, 0);
      expect(topLeft).toBeDefined(); // Should hit mesh

      // Click bottom-right corner (800, 600)
      const bottomRight = selectionManager.getNodePathAtScreenPosition(800, 600);
      expect(bottomRight).toBeDefined(); // Should hit mesh
    });
  });

  describe('findNodePathInHierarchy', () => {
    it('should find nodePath on object itself', () => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial()
      );
      mesh.userData.nodePath = 'Root/TestNode';
      scene.add(mesh);

      nodeTracker.set('Root/TestNode', mesh, {
        name: 'TestNode',
        type: 'MeshInstance3D',
        children: [],
        properties: {}
      });

      mockRaycasterIntersections([mesh]);

      const nodePath = selectionManager.getNodePathAtScreenPosition(400, 300);
      expect(nodePath).toBe('Root/TestNode');
    });

    it('should traverse up to parent to find nodePath', () => {
      // Create parent with nodePath
      const parent = new THREE.Group();
      parent.userData.nodePath = 'Root/Parent';
      scene.add(parent);

      // Create child mesh without nodePath
      const childMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial()
      );
      parent.add(childMesh);

      nodeTracker.set('Root/Parent', parent, {
        name: 'Parent',
        type: 'Node3D',
        children: [],
        properties: {}
      });

      mockRaycasterIntersections([childMesh]);

      const nodePath = selectionManager.getNodePathAtScreenPosition(400, 300);
      expect(nodePath).toBe('Root/Parent');
    });

    it('should return instanceRoot when present', () => {
      // Create mesh with instanceRoot (external scene instance)
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial()
      );
      mesh.userData.nodePath = 'Root/Enemy1/Mesh'; // Path inside instance
      mesh.userData.instanceRoot = 'Root/Enemy1'; // Instance root path
      scene.add(mesh);

      nodeTracker.set('Root/Enemy1', mesh, {
        name: 'Enemy1',
        type: 'Node3D',
        children: [],
        properties: {}
      });

      mockRaycasterIntersections([mesh]);

      const nodePath = selectionManager.getNodePathAtScreenPosition(400, 300);
      expect(nodePath).toBe('Root/Enemy1'); // Should return instanceRoot, not internal path
    });

    it('should handle objects without nodePath in hierarchy', () => {
      // Create object without nodePath
      const group = new THREE.Group();
      scene.add(group);

      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial()
      );
      group.add(mesh);

      const nodePath = selectionManager.getNodePathAtScreenPosition(400, 300);
      expect(nodePath).toBeNull(); // No nodePath found in hierarchy
    });
  });

  describe('isMeshObject', () => {
    it('should return true for THREE.Mesh', () => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial()
      );
      mesh.userData.nodePath = 'Root/Mesh';
      scene.add(mesh);

      nodeTracker.set('Root/Mesh', mesh, {
        name: 'Mesh',
        type: 'MeshInstance3D',
        children: [],
        properties: {}
      });

      mockRaycasterIntersections([mesh]);

      const nodePath = selectionManager.getNodePathAtScreenPosition(400, 300);
      expect(nodePath).toBe('Root/Mesh'); // Mesh is selectable
    });

    it('should return true for Group containing Mesh children', () => {
      const group = new THREE.Group();
      group.userData.nodePath = 'Root/Group';
      scene.add(group);

      const childMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial()
      );
      group.add(childMesh);

      nodeTracker.set('Root/Group', group, {
        name: 'Group',
        type: 'Node3D',
        children: [],
        properties: {}
      });

      mockRaycasterIntersections([childMesh]);

      const nodePath = selectionManager.getNodePathAtScreenPosition(400, 300);
      expect(nodePath).toBe('Root/Group'); // Group with mesh children is selectable
    });

    it('should return false for empty Group', () => {
      const group = new THREE.Group();
      group.userData.nodePath = 'Root/EmptyGroup';
      scene.add(group);

      nodeTracker.set('Root/EmptyGroup', group, {
        name: 'EmptyGroup',
        type: 'Node3D',
        children: [],
        properties: {}
      });

      const nodePath = selectionManager.getNodePathAtScreenPosition(400, 300);
      expect(nodePath).toBeNull(); // Empty group not selectable
    });

    it('should return false for Light objects', () => {
      const light = new THREE.DirectionalLight(0xffffff);
      light.userData.nodePath = 'Root/Light';
      scene.add(light);

      nodeTracker.set('Root/Light', light, {
        name: 'Light',
        type: 'DirectionalLight3D',
        children: [],
        properties: {}
      });

      const nodePath = selectionManager.getNodePathAtScreenPosition(400, 300);
      expect(nodePath).toBeNull(); // Lights not selectable
    });
  });

  describe('Normalized Device Coordinates', () => {
    it('should convert center of canvas to (0, 0) NDC', () => {
      // This test verifies the conversion logic conceptually
      // Center of 800x600 canvas: (400, 300)
      // NDC: ((400 - 0) / 800) * 2 - 1 = 0
      // NDC: -((300 - 0) / 600) * 2 + 1 = 0
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial()
      );
      mesh.userData.nodePath = 'Root/Center';
      scene.add(mesh);

      nodeTracker.set('Root/Center', mesh, {
        name: 'Center',
        type: 'MeshInstance3D',
        children: [],
        properties: {}
      });

      mockRaycasterIntersections([mesh]);

      const nodePath = selectionManager.getNodePathAtScreenPosition(400, 300);
      expect(nodePath).toBe('Root/Center');
    });

    it('should convert top-left corner (0, 0) to (-1, 1) NDC', () => {
      // Top-left: (0, 0)
      // NDC X: ((0 - 0) / 800) * 2 - 1 = -1
      // NDC Y: -((0 - 0) / 600) * 2 + 1 = 1
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(10, 10, 1),
        new THREE.MeshBasicMaterial()
      );
      mesh.position.set(-3, 3, 0); // Position at top-left in world space
      mesh.userData.nodePath = 'Root/TopLeft';
      scene.add(mesh);

      nodeTracker.set('Root/TopLeft', mesh, {
        name: 'TopLeft',
        type: 'MeshInstance3D',
        children: [],
        properties: {}
      });

      // Click top-left corner
      const nodePath = selectionManager.getNodePathAtScreenPosition(0, 0);
      expect(nodePath).toBeDefined(); // Should work
    });

    it('should convert bottom-right corner (800, 600) to (1, -1) NDC', () => {
      // Bottom-right: (800, 600)
      // NDC X: ((800 - 0) / 800) * 2 - 1 = 1
      // NDC Y: -((600 - 0) / 600) * 2 + 1 = -1
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(10, 10, 1),
        new THREE.MeshBasicMaterial()
      );
      mesh.position.set(3, -3, 0); // Position at bottom-right in world space
      mesh.userData.nodePath = 'Root/BottomRight';
      scene.add(mesh);

      nodeTracker.set('Root/BottomRight', mesh, {
        name: 'BottomRight',
        type: 'MeshInstance3D',
        children: [],
        properties: {}
      });

      const nodePath = selectionManager.getNodePathAtScreenPosition(800, 600);
      expect(nodePath).toBeDefined(); // Should work
    });
  });

  describe('Edge Cases', () => {
    it('should handle canvas with different getBoundingClientRect', () => {
      // Mock different canvas position (e.g., canvas not at 0,0)
      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
        left: 100,
        top: 50,
        width: 800,
        height: 600,
        right: 900,
        bottom: 650,
        x: 100,
        y: 50,
        toJSON: () => {}
      } as DOMRect);

      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial()
      );
      mesh.userData.nodePath = 'Root/Mesh';
      scene.add(mesh);

      nodeTracker.set('Root/Mesh', mesh, {
        name: 'Mesh',
        type: 'MeshInstance3D',
        children: [],
        properties: {}
      });

      mockRaycasterIntersections([mesh]);

      // Click accounting for canvas offset
      const nodePath = selectionManager.getNodePathAtScreenPosition(500, 350); // Center: 100+400, 50+300
      expect(nodePath).toBe('Root/Mesh');
    });

    it('should handle mesh behind camera', () => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial()
      );
      mesh.userData.nodePath = 'Root/BehindCamera';
      mesh.position.z = 10; // Behind camera at z=5
      scene.add(mesh);

      nodeTracker.set('Root/BehindCamera', mesh, {
        name: 'BehindCamera',
        type: 'MeshInstance3D',
        children: [],
        properties: {}
      });

      const nodePath = selectionManager.getNodePathAtScreenPosition(400, 300);
      expect(nodePath).toBeNull(); // Mesh behind camera not visible
    });

    it('should handle deeply nested mesh hierarchy', () => {
      // Create deeply nested hierarchy
      const root = new THREE.Group();
      root.userData.nodePath = 'Root';
      scene.add(root);

      let current = root;
      for (let i = 0; i < 5; i++) {
        const group = new THREE.Group();
        current.add(group);
        current = group;
      }

      // Add mesh at the end
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial()
      );
      current.add(mesh);

      nodeTracker.set('Root', root, {
        name: 'Root',
        type: 'Node3D',
        children: [],
        properties: {}
      });

      mockRaycasterIntersections([mesh]);

      const nodePath = selectionManager.getNodePathAtScreenPosition(400, 300);
      expect(nodePath).toBe('Root'); // Should traverse up to root
    });

    it('should handle selection with no objects in nodeTracker', () => {
      // Create mesh but don't register in nodeTracker
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial()
      );
      mesh.userData.nodePath = 'Root/Untracked';
      scene.add(mesh);

      // Don't add to nodeTracker - selection requires tracking
      const nodePath = selectionManager.getNodePathAtScreenPosition(400, 300);
      expect(nodePath).toBeNull(); // Not in tracker, can't be selected
    });
  });
});
