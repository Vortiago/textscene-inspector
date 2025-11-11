/**
 * Integration tests for Camera3D rendering pipeline.
 * Tests complete flow: TSCN file → Parser → TscnRenderer → Camera3D with helpers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { TscnRenderer } from '../../../core/TscnRenderer';
import { TscnParser } from '../../../parser/TscnParser';

// Mock WebGLRenderer to avoid needing real WebGL context in tests
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof THREE>();

  class MockWebGLRenderer {
    domElement: HTMLCanvasElement;
    render = vi.fn();
    setSize = vi.fn();
    dispose = vi.fn();
    shadowMap = { enabled: false };

    constructor(options?: { canvas?: HTMLCanvasElement; antialias?: boolean }) {
      this.domElement = options?.canvas || document.createElement('canvas');
    }
  }

  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer
  };
});

describe('Camera3D Integration', () => {
  let canvas: HTMLCanvasElement;
  let renderer: TscnRenderer;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    renderer = new TscnRenderer(canvas);
  });

  describe('Camera3D Rendering', () => {
    it('should parse and render a perspective camera', async () => {
      const tscnContent = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="MainCamera" type="Camera3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 10)
fov = 60.0
near = 0.1
far = 100.0
`;

      const parser = new TscnParser();
      const scene = parser.parse(tscnContent);

      await renderer.render(scene);

      // Verify camera was created
      const cameras = renderer.getSceneCameras();
      expect(cameras.length).toBe(1);
      expect(cameras[0]?.name).toBe('MainCamera');
    });

    it('should render orthographic camera', async () => {
      const tscnContent = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="OrthoCamera" type="Camera3D" parent="."]
projection = 1
size = 5.0
near = 0.1
far = 100.0
`;

      const parser = new TscnParser();
      const scene = parser.parse(tscnContent);

      await renderer.render(scene);

      // Verify camera was created
      const cameras = renderer.getSceneCameras();
      expect(cameras.length).toBe(1);

      // Verify it's an orthographic camera
      const camera = cameras[0]?.object;
      expect(camera).toBeDefined();
      expect(camera).toBeInstanceOf(THREE.OrthographicCamera);
      expect(camera.userData.nodeType).toBe('Camera3D');
    });

    it('should create camera helpers for visualization', async () => {
      const tscnContent = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Camera" type="Camera3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 5, 5)
`;

      const parser = new TscnParser();
      const scene = parser.parse(tscnContent);

      await renderer.render(scene);

      // Find the camera helper in the scene
      const threeScene = renderer.getSceneForTesting();
      const helpers = findCameraHelpersInScene(threeScene);

      expect(helpers.length).toBeGreaterThan(0);
      expect(helpers[0]).toBeInstanceOf(THREE.CameraHelper);
    });
  });

  describe('Multi-Camera Scenes', () => {
    it('should render multiple cameras in one scene', async () => {
      const tscnContent = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="MainCamera" type="Camera3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 5)
fov = 75.0

[node name="TopCamera" type="Camera3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 0, 1, 0, -1, 0, 0, 10, 0)
fov = 60.0

[node name="SideCamera" type="Camera3D" parent="."]
transform = Transform3D(0, 0, 1, 0, 1, 0, -1, 0, 0, 5, 2, 0)
fov = 70.0
`;

      const parser = new TscnParser();
      const scene = parser.parse(tscnContent);

      await renderer.render(scene);

      // Verify all cameras were created
      const cameras = renderer.getSceneCameras();
      expect(cameras.length).toBe(3);
      expect(cameras.map(c => c.name)).toContain('MainCamera');
      expect(cameras.map(c => c.name)).toContain('TopCamera');
      expect(cameras.map(c => c.name)).toContain('SideCamera');
    });

    it('should switch between cameras', async () => {
      const tscnContent = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Camera1" type="Camera3D" parent="."]
fov = 60.0

[node name="Camera2" type="Camera3D" parent="."]
fov = 90.0
`;

      const parser = new TscnParser();
      const scene = parser.parse(tscnContent);

      await renderer.render(scene);

      const cameras = renderer.getSceneCameras();
      expect(cameras.length).toBe(2);

      // Switch to first camera
      const success = renderer.switchToCamera('Root/Camera1');
      expect(success).toBe(true);
    });

    it('should return to free view from camera', async () => {
      const tscnContent = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Camera" type="Camera3D" parent="."]
fov = 60.0
`;

      const parser = new TscnParser();
      const scene = parser.parse(tscnContent);

      await renderer.render(scene);

      // Switch to camera
      renderer.switchToCamera('Root/Camera');

      // Return to free view
      renderer.returnToFreeView();

      // Should not throw and cameras should still exist
      const cameras = renderer.getSceneCameras();
      expect(cameras.length).toBe(1);
    });
  });

  describe('Camera with Complex Scene', () => {
    it('should render camera alongside meshes and lights', async () => {
      const tscnContent = `[gd_scene load_steps=3 format=3]

[sub_resource type="BoxMesh" id="BoxMesh_1"]

[node name="Root" type="Node3D"]

[node name="Box" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_1")

[node name="Camera" type="Camera3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 5, 5)

[node name="Light" type="DirectionalLight3D" parent="."]
`;

      const parser = new TscnParser();
      const scene = parser.parse(tscnContent);

      await renderer.render(scene);

      // Verify all node types coexist
      const threeScene = renderer.getSceneForTesting();
      const meshes = findMeshesInScene(threeScene);
      const lights = findLightsInScene(threeScene);
      const cameras = renderer.getSceneCameras();

      expect(meshes.length).toBe(1);
      expect(lights.length).toBeGreaterThan(0);
      expect(cameras.length).toBe(1);
    });
  });

  describe('Camera Helper Positioning (edge-photo-wall.tscn)', () => {
    it('should position camera helper at same world position as camera with identity transform', async () => {
      // Test FrameIdentity: parent at (0,2,0) with identity rotation, camera at local (0,0,0.5)
      const tscnContent = `[gd_scene load_steps=1 format=3]

[node name="PhotoWall" type="Node3D"]

[node name="FrameIdentity" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0)

[node name="Camera3D" type="Camera3D" parent="FrameIdentity"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0.5)
`;

      const parser = new TscnParser();
      const scene = parser.parse(tscnContent);
      await renderer.render(scene);

      const threeScene = renderer.getSceneForTesting();
      const helpers = findCameraHelpersInScene(threeScene);
      expect(helpers.length).toBe(1);

      const helper = helpers[0]!;

      // Get the camera from helper.camera property (CameraHelper has a reference to its camera)
      const camera = helper.camera as THREE.Camera;
      expect(camera).toBeDefined();
      expect(camera.userData.nodeType).toBe('Camera3D');

      // Helper and camera should be at same world position
      const helperWorldPos = new THREE.Vector3();
      const cameraWorldPos = new THREE.Vector3();
      helper.getWorldPosition(helperWorldPos);
      camera.getWorldPosition(cameraWorldPos);

      // These should match - helper should visualize camera at camera's actual position
      expect(helperWorldPos.x).toBeCloseTo(cameraWorldPos.x, 2);
      expect(helperWorldPos.y).toBeCloseTo(cameraWorldPos.y, 2);
      expect(helperWorldPos.z).toBeCloseTo(cameraWorldPos.z, 2);
    });

    it('should position camera helper correctly with 90° Y-rotation parent', async () => {
      // Test Frame90Y: parent at (3,2,0) with 90° Y-rotation, camera at local (0,0,0.5)
      const tscnContent = `[gd_scene load_steps=1 format=3]

[node name="PhotoWall" type="Node3D"]

[node name="Frame90Y" type="Node3D" parent="."]
transform = Transform3D(0, 0, -1, 0, 1, 0, 1, 0, 0, 3, 2, 0)

[node name="Camera3D" type="Camera3D" parent="Frame90Y"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0.5)
`;

      const parser = new TscnParser();
      const scene = parser.parse(tscnContent);
      await renderer.render(scene);

      const threeScene = renderer.getSceneForTesting();
      const helpers = findCameraHelpersInScene(threeScene);
      expect(helpers.length).toBe(1);

      const helper = helpers[0]!;
      const camera = helper.camera as THREE.Camera;

      // Helper and camera should be at same world position
      const helperWorldPos = new THREE.Vector3();
      const cameraWorldPos = new THREE.Vector3();
      helper.getWorldPosition(helperWorldPos);
      camera.getWorldPosition(cameraWorldPos);

      expect(helperWorldPos.x).toBeCloseTo(cameraWorldPos.x, 2);
      expect(helperWorldPos.y).toBeCloseTo(cameraWorldPos.y, 2);
      expect(helperWorldPos.z).toBeCloseTo(cameraWorldPos.z, 2);
    });

    it('should position camera helper correctly with 180° Y-rotation parent', async () => {
      // Test Frame180Y: parent at (6,2,0) with 180° Y-rotation, camera at local (0,0,0.5)
      const tscnContent = `[gd_scene load_steps=1 format=3]

[node name="PhotoWall" type="Node3D"]

[node name="Frame180Y" type="Node3D" parent="."]
transform = Transform3D(-1, 0, 0, 0, 1, 0, 0, 0, -1, 6, 2, 0)

[node name="Camera3D" type="Camera3D" parent="Frame180Y"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0.5)
`;

      const parser = new TscnParser();
      const scene = parser.parse(tscnContent);
      await renderer.render(scene);

      const threeScene = renderer.getSceneForTesting();
      const helpers = findCameraHelpersInScene(threeScene);
      expect(helpers.length).toBe(1);

      const helper = helpers[0]!;
      const camera = helper.camera as THREE.Camera;

      // Helper and camera should be at same world position
      const helperWorldPos = new THREE.Vector3();
      const cameraWorldPos = new THREE.Vector3();
      helper.getWorldPosition(helperWorldPos);
      camera.getWorldPosition(cameraWorldPos);

      expect(helperWorldPos.x).toBeCloseTo(cameraWorldPos.x, 2);
      expect(helperWorldPos.y).toBeCloseTo(cameraWorldPos.y, 2);
      expect(helperWorldPos.z).toBeCloseTo(cameraWorldPos.z, 2);
    });

    it('should load full edge-photo-wall.tscn with all three cameras', async () => {
      // Load the complete edge-photo-wall fixture with all 3 photo frames
      const fs = await import('fs/promises');
      const path = await import('path');
      // From packages/textscene-core/src/nodes/3d/camera3d/ go up to root, then to scenes/fixtures/
      const fixturePathRaw = path.join(__dirname, '../../../../../../scenes/fixtures/edge-photo-wall.tscn');
      const fixturePath = fixturePathRaw.replace(/\\/g, '/');

      const tscnContent = await fs.readFile(fixturePath, 'utf-8');

      const parser = new TscnParser();
      const scene = parser.parse(tscnContent);
      await renderer.render(scene);

      // Verify all 3 cameras were created
      const cameras = renderer.getSceneCameras();
      expect(cameras.length).toBe(3);

      // Verify all 3 helpers exist
      const threeScene = renderer.getSceneForTesting();
      const helpers = findCameraHelpersInScene(threeScene);
      expect(helpers.length).toBe(3);

      // Verify each helper matches its camera's world position
      for (const helper of helpers) {
        const camera = helper.camera as THREE.Camera;

        const helperWorldPos = new THREE.Vector3();
        const cameraWorldPos = new THREE.Vector3();
        helper.getWorldPosition(helperWorldPos);
        camera.getWorldPosition(cameraWorldPos);

        expect(helperWorldPos.x).toBeCloseTo(cameraWorldPos.x, 2);
        expect(helperWorldPos.y).toBeCloseTo(cameraWorldPos.y, 2);
        expect(helperWorldPos.z).toBeCloseTo(cameraWorldPos.z, 2);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid camera path in switchToCamera', async () => {
      const tscnContent = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

      const parser = new TscnParser();
      const scene = parser.parse(tscnContent);

      await renderer.render(scene);

      // Try to switch to non-existent camera
      const success = renderer.switchToCamera('Root/NonExistentCamera');
      expect(success).toBe(false);
    });

    it('should handle camera with invalid FOV gracefully', async () => {
      const tscnContent = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Camera" type="Camera3D" parent="."]
fov = 200.0
near = -1.0
far = 0.5
`;

      const parser = new TscnParser();
      const scene = parser.parse(tscnContent);

      // Should not throw - renderer should clamp values
      await expect(renderer.render(scene)).resolves.not.toThrow();

      const cameras = renderer.getSceneCameras();
      expect(cameras.length).toBe(1);
    });
  });
});

// Helper functions
function findMeshesInScene(scene: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      meshes.push(obj);
    }
  });
  return meshes;
}

function findLightsInScene(scene: THREE.Object3D): THREE.Light[] {
  const lights: THREE.Light[] = [];
  scene.traverse((obj) => {
    if (obj instanceof THREE.Light) {
      lights.push(obj);
    }
  });
  return lights;
}

function findCameraHelpersInScene(scene: THREE.Object3D): THREE.CameraHelper[] {
  const helpers: THREE.CameraHelper[] = [];
  scene.traverse((obj) => {
    if (obj instanceof THREE.CameraHelper) {
      helpers.push(obj);
    }
  });
  return helpers;
}
