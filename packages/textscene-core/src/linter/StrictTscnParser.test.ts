/**
 * Tests for StrictTscnParser: what a well-formed file yields — the sections,
 * their types, and the properties read off each one.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StrictTscnParser } from './StrictTscnParser.js';

describe('StrictTscnParser', () => {
  let parser: StrictTscnParser;

  beforeEach(() => {
    parser = new StrictTscnParser();
  });

  describe('Valid TSCN Parsing', () => {
    it('should parse a minimal valid TSCN file', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.nodes).toHaveLength(1);
      expect(result.scene!.nodes[0]!.name).toBe('Root');
      expect(result.scene!.nodes[0]!.type).toBe('Node3D');
    });

    it('should parse TSCN with multiple nodes', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Child" type="MeshInstance3D" parent="."]

[node name="GrandChild" type="Camera3D" parent="Child"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.nodes).toHaveLength(1);
      expect(result.scene!.nodes[0]!.children).toHaveLength(1);
      expect(result.scene!.nodes[0]!.children[0]!.children).toHaveLength(1);
    });

    it('should parse TSCN with external resources', () => {
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://enemy.tscn" id="1_abc"]

[node name="Root" type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.externalResources).toHaveLength(1);
      expect(result.scene!.externalResources[0]!.path).toBe('res://enemy.tscn');
      expect(result.scene!.externalResources[0]!.type).toBe('PackedScene');
    });

    it('should parse TSCN with internal resources', () => {
      const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="BoxMesh" id="BoxMesh_1"]

[node name="Root" type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.internalResources).toHaveLength(1);
      expect(result.scene!.internalResources[0]!.type).toBe('BoxMesh');
      expect(result.scene!.internalResources[0]!.id).toBe('BoxMesh_1');
    });

    it('should parse node with properties', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
visible = true
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.nodes[0]!.properties).toHaveProperty('transform');
      expect(result.scene!.nodes[0]!.properties).toHaveProperty('visible');
    });

    it('should skip empty lines and comments', () => {
      const content = `[gd_scene load_steps=1 format=3]

; This is a comment

[node name="Root" type="Node3D"]

; Another comment
visible = true
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
    });
  });

  describe('Section Type Identification', () => {
    it('should identify gd_scene heading', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
    });

    it('should identify node sections', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
[node name="Child" type="Node3D" parent="."]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene!.nodes[0]!.children).toHaveLength(1);
    });

    it('should identify ext_resource sections', () => {
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://icon.png" id="1"]

[node name="Root" type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene!.externalResources).toHaveLength(1);
    });

    it('should identify sub_resource sections', () => {
      const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="BoxMesh" id="1"]

[node name="Root" type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene!.internalResources).toHaveLength(1);
    });
  });
});
