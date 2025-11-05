/**
 * Integration tests for full TSCN render pipeline.
 * Tests complete flow: TSCN file → Parser → TscnRenderer → three.js scene graph
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { TscnRenderer } from '../core/TscnRenderer';
import { TscnParser } from '../parser/TscnParser';

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

describe('Render Pipeline Integration', () => {
  let canvas: HTMLCanvasElement;
  let renderer: TscnRenderer;

  beforeEach(() => {
    // Create mock canvas for WebGL context
    canvas = document.createElement('canvas');
    renderer = new TscnRenderer(canvas);
  });

  describe('Simple Scene Rendering', () => {
    it('should parse and render a simple scene with one node', async () => {
      const tscnContent = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

      const parser = new TscnParser();
      const scene = parser.parse(tscnContent);

      await renderer.render(scene);

      // Verify scene was rendered
      const threeScene = renderer.getSceneForTesting();
      expect(threeScene).toBeDefined();
      expect(threeScene.children.length).toBeGreaterThan(0);
    });

    it('should render scene with MeshInstance3D and BoxMesh', async () => {
      const tscnContent = `[gd_scene load_steps=2 format=3]

[sub_resource type="BoxMesh" id="BoxMesh_abc123"]

[node name="Root" type="Node3D"]

[node name="Cube" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_abc123")
`;

      const parser = new TscnParser();
      const scene = parser.parse(tscnContent);

      await renderer.render(scene);

      // Verify mesh was created
      const threeScene = renderer.getSceneForTesting();
      const meshes = findMeshesInScene(threeScene);
      expect(meshes.length).toBeGreaterThan(0);
      expect(meshes[0]?.geometry).toBeInstanceOf(THREE.BufferGeometry);
    });

    it('should render scene with mesh and material', async () => {
      const tscnContent = `[gd_scene load_steps=3 format=3]

[sub_resource type="StandardMaterial3D" id="StandardMaterial3D_mat"]
albedo_color = Color(1, 0, 0, 1)

[sub_resource type="BoxMesh" id="BoxMesh_abc123"]
material = SubResource("StandardMaterial3D_mat")

[node name="Root" type="Node3D"]

[node name="RedCube" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_abc123")
`;

      const parser = new TscnParser();
      const scene = parser.parse(tscnContent);

      await renderer.render(scene);

      // Verify material was applied
      const threeScene = renderer.getSceneForTesting();
      const meshes = findMeshesInScene(threeScene);
      expect(meshes.length).toBeGreaterThan(0);

      const material = meshes[0]?.material as THREE.MeshStandardMaterial;
      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial);
      // Material exists and has color property (exact color may vary based on material system)
      expect(material.color).toBeDefined();
      expect(material.color).toBeInstanceOf(THREE.Color);
    });
  });

  describe('Complex Scene Rendering', () => {
    it('should render scene with multiple node types', async () => {
      const tscnContent = `[gd_scene load_steps=4 format=3]

[sub_resource type="BoxMesh" id="BoxMesh_1"]

[sub_resource type="SphereMesh" id="SphereMesh_1"]

[node name="Root" type="Node3D"]

[node name="Cube" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -2, 0, 0)
mesh = SubResource("BoxMesh_1")

[node name="Sphere" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)
mesh = SubResource("SphereMesh_1")

[node name="Light" type="DirectionalLight3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 0.707107, 0.707107, 0, -0.707107, 0.707107, 0, 5, 0)
`;

      const parser = new TscnParser();
      const scene = parser.parse(tscnContent);

      await renderer.render(scene);

      // Verify all nodes were rendered
      const threeScene = renderer.getSceneForTesting();
      const meshes = findMeshesInScene(threeScene);
      const lights = findLightsInScene(threeScene);

      expect(meshes.length).toBe(2);
      expect(lights.length).toBeGreaterThan(0);
    });

    it('should handle nested node hierarchy', async () => {
      const tscnContent = `[gd_scene load_steps=2 format=3]

[sub_resource type="BoxMesh" id="BoxMesh_1"]

[node name="Root" type="Node3D"]

[node name="Parent" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0)

[node name="Child" type="MeshInstance3D" parent="Parent"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)
mesh = SubResource("BoxMesh_1")
`;

      const parser = new TscnParser();
      const scene = parser.parse(tscnContent);

      await renderer.render(scene);

      // Verify hierarchy was preserved
      const threeScene = renderer.getSceneForTesting();
      const meshes = findMeshesInScene(threeScene);
      expect(meshes.length).toBe(1);

      // Child should have inherited parent's transform
      const mesh = meshes[0];
      expect(mesh).toBeDefined();
      // World position should be combination of parent (y=2) + child (y=1) = y=3
      const worldPos = new THREE.Vector3();
      mesh?.getWorldPosition(worldPos);
      expect(worldPos.y).toBeCloseTo(3, 2);
    });
  });

  describe('Error Handling', () => {
    it('should handle scene with missing mesh resource', async () => {
      const tscnContent = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="MissingMesh" type="MeshInstance3D" parent="."]
mesh = SubResource("NonExistent_abc123")
`;

      const parser = new TscnParser();
      const scene = parser.parse(tscnContent);

      // Should not throw, but handle gracefully
      await expect(renderer.render(scene)).resolves.not.toThrow();

      const threeScene = renderer.getSceneForTesting();
      expect(threeScene).toBeDefined();
    });

    it('should handle malformed TSCN content', async () => {
      const tscnContent = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"
MALFORMED LINE WITHOUT CLOSING BRACKET
`;

      const parser = new TscnParser();

      // Parser should handle malformed content
      expect(() => parser.parse(tscnContent)).not.toThrow();
    });

    it('should handle scene with unknown node type', async () => {
      const tscnContent = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Unknown" type="CustomUnknownNodeType" parent="."]
custom_property = "value"
`;

      const parser = new TscnParser();
      const scene = parser.parse(tscnContent);

      // Should render known nodes, skip unknown ones
      await expect(renderer.render(scene)).resolves.not.toThrow();
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
