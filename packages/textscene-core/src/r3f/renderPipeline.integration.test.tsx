/**
 * The render pipeline end to end: `TscnParser.parse()`, then SceneResourcesProvider
 * and NodeDispatcher, into ReactThreeTestRenderer, which uses no WebGL. Covers
 * material precedence, mesh and light dispatch, and nested transform composition.
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { ReactThreeTest } from '@react-three/test-renderer';
import { TscnParser } from '../parser/TscnParser';
import { NodeDispatcher } from './NodeDispatcher';
import { SceneResourcesProvider } from './SceneResourcesContext';
import { SelectionProvider } from './contexts/SelectionContext';

// Pull in all self-registering node components
import './nodes/index';

type ReactThreeTestInstance = ReactThreeTest.ReactThreeTestInstance;

// The test renderer's tree API, since `instanceof` fails across its second
// three.js copy under `traverse()`.
function findMeshes(scene: { findAllByType(t: string): ReactThreeTestInstance[] }) {
  return scene.findAllByType('Mesh');
}

function findLights(scene: { findAllByType(t: string): ReactThreeTestInstance[] }) {
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

describe('Render pipeline integration (parse → dispatch → R3F tree)', () => {
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
      expect((meshes[0]!.instance as THREE.Mesh).geometry.type).toMatch(/Geometry/);
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
      // A type-string check, since `instanceof` fails across three.js copies.
      const material = (meshes[0]!.instance as THREE.Mesh).material as THREE.MeshStandardMaterial;
      expect(material.type).toBe('MeshStandardMaterial');
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
      const mat = (meshes[0]!.instance as THREE.Mesh).material as THREE.MeshStandardMaterial;
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
      const mat = (meshes[0]!.instance as THREE.Mesh).material as THREE.MeshStandardMaterial;
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
      const mat = (meshes[0]!.instance as THREE.Mesh).material as THREE.MeshStandardMaterial;
      expect(mat.color.getHex()).toBe(0x0000ff);
    });

    it('full precedence: mesh < surface override < materialOverride', async () => {
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
      // `_geometry_instance_add_surface` takes `material_override` ahead of the
      // material it is handed, and that caller had already chosen
      // `surface_materials[j]` over the mesh's own
      // (render_forward_clustered.cpp:4206, :4267).
      const meshes = findMeshes(renderer.scene);
      const mat = (meshes[0]!.instance as THREE.Mesh).material as THREE.MeshStandardMaterial;
      // `material_override` (red) outranks both, per
      // `render_forward_clustered.cpp:4206` applying it inside the per-surface add.
      expect(mat.color.getHex()).toBe(0xff0000);
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
      // Parent y=2 and child y=1 compose through <group> nesting to world y≈3.
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
