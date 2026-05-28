/**
 * Archaeology: ported from main:packages/textscene-core/src/integration/renderPipeline.integration.test.ts
 *
 * Original tested `TscnRenderer` class (deleted). The R3F equivalent pipeline is:
 *   TscnParser.parse() → SceneResourcesProvider + NodeDispatcher → ReactThreeTestRenderer
 *
 * Key adapter decisions:
 * - `TscnRenderer` → `<SceneResourcesProvider> + <NodeDispatcher>` from TscnCanvas internals
 * - `renderer.getSceneForTesting()` → `r3fRenderer.scene` (the root THREE.Scene)
 * - `renderer.render(scene)` → `ReactThreeTestRenderer.create(...)` synchronously mounts
 * - WebGLRenderer mock not needed (ReactThreeTestRenderer uses no WebGL)
 *
 * The nested hierarchy test (parent y=2, child y=1, worldPos.y≈3) is the most important:
 * it validates that parent transforms compose correctly through <group> nesting.
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { ReactTestInstance } from '@react-three/test-renderer';
import { TscnParser } from '../../parser/TscnParser';
import { NodeDispatcher } from '../../r3f/NodeDispatcher';
import { SceneResourcesProvider } from '../../r3f/SceneResourcesContext';
import { SelectionProvider } from '../../r3f/contexts/SelectionContext';

// Pull in all self-registering node components
import '../../r3f/nodes/index';

// Use the test renderer tree API to find meshes/lights — avoids the dual-THREE
// instanceof problem that occurs when traverse() is called on scene.instance.
function findMeshes(scene: { findAllByType(t: string): ReactTestInstance[] }) {
  return scene.findAllByType('Mesh');
}

function findLights(scene: { findAllByType(t: string): ReactTestInstance[] }) {
  return [
    ...scene.findAllByType('DirectionalLight'),
    ...scene.findAllByType('AmbientLight'),
    ...scene.findAllByType('PointLight'),
    ...scene.findAllByType('SpotLight'),
  ];
}

async function renderScene(content: string) {
  const parser = new TscnParser();
  const scene = parser.parse(content);
  const renderer = await ReactThreeTestRenderer.create(
    <SelectionProvider>
      <SceneResourcesProvider
        internalResources={scene.internalResources}
        externalResources={scene.externalResources}
      >
        <NodeDispatcher nodes={scene.nodes} />
      </SceneResourcesProvider>
    </SelectionProvider>
  );
  return renderer;
}

describe('Render Pipeline Integration (ported from renderPipeline.integration.test.ts)', () => {
  describe('Simple Scene Rendering', () => {
    it('parses and renders a simple scene with one node', async () => {
      const renderer = await renderScene(`[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`);
      const groups = renderer.scene.findAllByType('Group');
      expect(groups.length).toBeGreaterThan(0);
    });

    it('renders scene with MeshInstance3D and BoxMesh', async () => {
      const renderer = await renderScene(`[gd_scene load_steps=2 format=3]

[sub_resource type="BoxMesh" id="BoxMesh_abc123"]

[node name="Root" type="Node3D"]

[node name="Cube" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_abc123")
`);
      const meshes = findMeshes(renderer.scene);
      expect(meshes.length).toBeGreaterThan(0);
      // Geometry type should be BufferGeometry (BoxGeometry extends it)
      expect(meshes[0]!.instance.geometry.type).toMatch(/Geometry/);
    });

    it('renders scene with mesh and material', async () => {
      const renderer = await renderScene(`[gd_scene load_steps=3 format=3]

[sub_resource type="StandardMaterial3D" id="StandardMaterial3D_mat"]
albedo_color = Color(1, 0, 0, 1)

[sub_resource type="BoxMesh" id="BoxMesh_abc123"]
material = SubResource("StandardMaterial3D_mat")

[node name="Root" type="Node3D"]

[node name="RedCube" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_abc123")
`);
      const meshes = findMeshes(renderer.scene);
      expect(meshes.length).toBeGreaterThan(0);
      // Material type string check avoids dual-THREE instanceof issue
      expect(meshes[0]!.instance.material.type).toBe('MeshStandardMaterial');
    });
  });

  describe('Material Precedence', () => {
    it('uses mesh material when no overrides specified', async () => {
      const renderer = await renderScene(`[gd_scene load_steps=3 format=3]

[sub_resource type="StandardMaterial3D" id="mat_yellow"]
albedo_color = Color(1, 1, 0, 1)

[sub_resource type="BoxMesh" id="BoxMesh_1"]
material = SubResource("mat_yellow")

[node name="Root" type="Node3D"]

[node name="Cube" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_1")
`);
      const meshes = findMeshes(renderer.scene);
      expect(meshes.length).toBe(1);
      const mat = meshes[0]!.instance.material as { type: string; color: THREE.Color };
      expect(mat.type).toBe('MeshStandardMaterial');
      expect(mat.color.getHex()).toBe(0xffff00);
    });

    it('prioritizes materialOverride over mesh material', async () => {
      const renderer = await renderScene(`[gd_scene load_steps=4 format=3]

[sub_resource type="StandardMaterial3D" id="mat_yellow"]
albedo_color = Color(1, 1, 0, 1)

[sub_resource type="StandardMaterial3D" id="mat_red"]
albedo_color = Color(1, 0, 0, 1)

[sub_resource type="BoxMesh" id="BoxMesh_1"]
material = SubResource("mat_yellow")

[node name="Root" type="Node3D"]

[node name="Cube" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_1")
material_override = SubResource("mat_red")
`);
      const meshes = findMeshes(renderer.scene);
      const mat = meshes[0]!.instance.material as { color: THREE.Color };
      expect(mat.color.getHex()).toBe(0xff0000);
    });

    it('prioritizes surface_material_override over mesh material', async () => {
      const renderer = await renderScene(`[gd_scene load_steps=4 format=3]

[sub_resource type="StandardMaterial3D" id="mat_yellow"]
albedo_color = Color(1, 1, 0, 1)

[sub_resource type="StandardMaterial3D" id="mat_blue"]
albedo_color = Color(0, 0, 1, 1)

[sub_resource type="BoxMesh" id="BoxMesh_1"]
material = SubResource("mat_yellow")

[node name="Root" type="Node3D"]

[node name="Cube" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_1")
surface_material_override/0 = SubResource("mat_blue")
`);
      const meshes = findMeshes(renderer.scene);
      const mat = meshes[0]!.instance.material as { color: THREE.Color };
      expect(mat.color.getHex()).toBe(0x0000ff);
    });

    it('full precedence: mesh < materialOverride < surface override', async () => {
      const renderer = await renderScene(`[gd_scene load_steps=5 format=3]

[sub_resource type="StandardMaterial3D" id="mat_yellow"]
albedo_color = Color(1, 1, 0, 1)

[sub_resource type="StandardMaterial3D" id="mat_red"]
albedo_color = Color(1, 0, 0, 1)

[sub_resource type="StandardMaterial3D" id="mat_blue"]
albedo_color = Color(0, 0, 1, 1)

[sub_resource type="BoxMesh" id="BoxMesh_1"]
material = SubResource("mat_yellow")

[node name="Root" type="Node3D"]

[node name="Cube" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_1")
material_override = SubResource("mat_red")
surface_material_override/0 = SubResource("mat_blue")
`);
      const meshes = findMeshes(renderer.scene);
      const mat = meshes[0]!.instance.material as { color: THREE.Color };
      expect(mat.color.getHex()).toBe(0x0000ff);
    });
  });

  describe('Complex Scene Rendering', () => {
    it('renders scene with multiple node types', async () => {
      const renderer = await renderScene(`[gd_scene load_steps=4 format=3]

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
`);
      const meshes = findMeshes(renderer.scene);
      const lights = findLights(renderer.scene);
      expect(meshes.length).toBe(2);
      expect(lights.length).toBeGreaterThan(0);
    });

    it('handles nested node hierarchy — child world pos = parent(y=2) + child(y=1) = y≈3', async () => {
      // This is the KEY test from the original. Validates that parent Group transforms
      // compose correctly in the R3F hierarchy. A failure here means transform nesting is broken.
      const renderer = await renderScene(`[gd_scene load_steps=2 format=3]

[sub_resource type="BoxMesh" id="BoxMesh_1"]

[node name="Root" type="Node3D"]

[node name="Parent" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0)

[node name="Child" type="MeshInstance3D" parent="Parent"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)
mesh = SubResource("BoxMesh_1")
`);
      const meshes = findMeshes(renderer.scene);
      expect(meshes.length).toBe(1);

      const mesh = meshes[0]!.instance as THREE.Mesh;
      const worldPos = new THREE.Vector3();
      mesh.getWorldPosition(worldPos);
      expect(worldPos.y).toBeCloseTo(3, 2);
    });
  });

  describe('Error Handling', () => {
    it('handles scene with missing mesh resource (renders placeholder)', async () => {
      const renderer = await renderScene(`[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="MissingMesh" type="MeshInstance3D" parent="."]
mesh = SubResource("NonExistent_abc123")
`);
      // Should not throw. A placeholder mesh is rendered.
      const groups = renderer.scene.findAllByType('Group');
      expect(groups.length).toBeGreaterThan(0);
    });

    it('handles scene with unknown node type (renders placeholder group)', async () => {
      const renderer = await renderScene(`[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Unknown" type="CustomUnknownNodeType" parent="."]
custom_property = "value"
`);
      // Should not throw. GenericNodeFallback placeholder rendered.
      const groups = renderer.scene.findAllByType('Group');
      expect(groups.length).toBeGreaterThan(0);
    });
  });
});
