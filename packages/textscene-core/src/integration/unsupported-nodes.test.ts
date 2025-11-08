/**
 * Integration tests for unsupported node type handling
 */

import { describe, it, expect } from 'vitest';
import { TscnParser } from '../parser/TscnParser';
import { renderNodeWithRegistry } from '../core/NodeRegistry';
import * as THREE from 'three';

describe('Unsupported Node Types Integration', () => {
  const parser = new TscnParser();

  it('should parse scene with unsupported nodes and preserve types', () => {
    const content = `
[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="CollisionArea" type="Area3D" parent="."]
monitorable = false

[node name="AnimPlayer" type="AnimationPlayer" parent="."]
autoplay = "idle"
    `;

    const scene = parser.parse(content);

    expect(scene.nodes).toHaveLength(1);
    expect(scene.nodes[0].type).toBe('Node3D');
    expect(scene.nodes[0].children).toHaveLength(2);

    const childTypes = scene.nodes[0].children.map(c => c.type).sort();
    expect(childTypes).toEqual(['AnimationPlayer', 'Area3D']);
  });

  it('should render unsupported nodes with fallback and flag', async () => {
    const content = `
[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Timer" type="Timer" parent="."]
wait_time = 2.0
    `;

    const scene = parser.parse(content);
    const timerNode = scene.nodes[0].children[0];

    const object = await renderNodeWithRegistry(timerNode, scene);

    expect(object).not.toBeNull();
    expect(object).toBeInstanceOf(THREE.Object3D);
    expect(object!.userData.isUnsupportedType).toBe(true);
  });

  it('should preserve hierarchy with unsupported nodes', async () => {
    const content = `
[gd_scene format=3]

[sub_resource type="BoxMesh" id="mesh_1"]

[node name="Root" type="Node3D"]

[node name="PhysicsArea" type="Area3D" parent="."]

[node name="VisibleMesh" type="MeshInstance3D" parent="PhysicsArea"]
mesh = SubResource("mesh_1")
    `;

    const scene = parser.parse(content);

    // Verify structure preserved
    expect(scene.nodes[0].type).toBe('Node3D');
    expect(scene.nodes[0].children).toHaveLength(1);
    expect(scene.nodes[0].children[0].type).toBe('Area3D');
    expect(scene.nodes[0].children[0].children).toHaveLength(1);
    expect(scene.nodes[0].children[0].children[0].type).toBe('MeshInstance3D');
  });

  it('should render complete hierarchy including unsupported nodes', async () => {
    const content = `
[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Timer" type="Timer" parent="."]
wait_time = 2.0

[node name="AnimPlayer" type="AnimationPlayer" parent="."]
    `;

    const scene = parser.parse(content);

    // Render all nodes
    const rootObj = await renderNodeWithRegistry(scene.nodes[0], scene);
    const timerNode = scene.nodes[0].children.find(n => n.name === 'Timer');
    const timerObj = await renderNodeWithRegistry(timerNode!, scene);
    const animNode = scene.nodes[0].children.find(n => n.name === 'AnimPlayer');
    const animObj = await renderNodeWithRegistry(animNode!, scene);

    expect(rootObj).not.toBeNull();
    expect(timerObj).not.toBeNull();
    expect(timerObj!.userData.isUnsupportedType).toBe(true);
    expect(animObj).not.toBeNull();
    expect(animObj!.userData.isUnsupportedType).toBe(true);
  });

  it('should handle mixed supported and unsupported types', () => {
    const content = `
[gd_scene format=3]

[sub_resource type="BoxMesh" id="mesh_1"]

[node name="Root" type="Node3D"]

[node name="SupportedMesh" type="MeshInstance3D" parent="."]
mesh = SubResource("mesh_1")

[node name="UnsupportedArea" type="Area3D" parent="."]

[node name="SupportedNode" type="Node3D" parent="."]

[node name="UnsupportedTimer" type="Timer" parent="."]
    `;

    const scene = parser.parse(content);

    expect(scene.nodes[0].children).toHaveLength(4);

    const childTypes = scene.nodes[0].children.map(c => c.type).sort();
    expect(childTypes).toEqual(['Area3D', 'MeshInstance3D', 'Node3D', 'Timer']);
  });
});
