/**
 * Tests for TscnParser
 */

import { describe, it, expect } from 'vitest';
import { TscnParser } from './TscnParser';
import { transformOf } from './testing/parserKit';

describe('TscnParser', () => {
  it('should create a parser instance', () => {
    const parser = new TscnParser();
    expect(parser).toBeInstanceOf(TscnParser);
  });

  describe('parse basic TSCN', () => {
    it('should parse empty scene', () => {
      const parser = new TscnParser();
      const content = '[gd_scene format=3]';

      const result = parser.parse(content);

      expect(result).toBeDefined();
      expect(result.nodes).toEqual([]);
      expect(result.externalResources).toEqual([]);
      expect(result.internalResources).toEqual([]);
    });

    it('should parse single root Node3D', () => {
      const parser = new TscnParser();
      const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]`;

      const result = parser.parse(content);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]!.name).toBe('Root');
      expect(result.nodes[0]!.type).toBe('Node3D');
      expect(result.nodes[0]!.children).toEqual([]);
    });

    it('should parse Node3D with transform', () => {
      const parser = new TscnParser();
      const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)`;

      const result = parser.parse(content);

      expect(result.nodes).toHaveLength(1);
      const node = result.nodes[0]!;
      expect(node.properties).toHaveProperty('transform');

      const transform = transformOf(node.properties);
      if (transform) {
        expect(transform.origin.x).toBe(2);
      }
    });

    it('should skip comments', () => {
      const parser = new TscnParser();
      const content = `[gd_scene format=3]

; This is a comment
[node name="Root" type="Node3D"]
; Another comment`;

      const result = parser.parse(content);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]!.name).toBe('Root');
    });

    it('should skip empty lines', () => {
      const parser = new TscnParser();
      const content = `[gd_scene format=3]


[node name="Root" type="Node3D"]

`;

      const result = parser.parse(content);

      expect(result.nodes).toHaveLength(1);
    });
  });

  describe('parse scene tree', () => {
    it('should build parent-child relationships', () => {
      const parser = new TscnParser();
      const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Child" type="Node3D" parent="."]`;

      const result = parser.parse(content);

      expect(result.nodes).toHaveLength(1);
      const root = result.nodes[0]!;
      expect(root.name).toBe('Root');
      expect(root.children).toHaveLength(1);
      expect(root.children[0]!.name).toBe('Child');
    });

    it('should build multi-level hierarchy', () => {
      const parser = new TscnParser();
      const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Child1" type="Node3D" parent="."]

[node name="GrandChild" type="Node3D" parent="Child1"]

[node name="Child2" type="Node3D" parent="."]`;

      const result = parser.parse(content);

      expect(result.nodes).toHaveLength(1);
      const root = result.nodes[0]!;

      // Root should have 2 children
      expect(root.children).toHaveLength(2);

      // First child should have 1 grandchild
      const child1 = root.children.find(c => c.name === 'Child1');
      expect(child1).toBeDefined();
      expect(child1!.children).toHaveLength(1);
      expect(child1!.children[0]!.name).toBe('GrandChild');

      // Second child should have no children
      const child2 = root.children.find(c => c.name === 'Child2');
      expect(child2).toBeDefined();
      expect(child2!.children).toHaveLength(0);
    });

    // Every node type's parser reads the heading itself, so "is this node
    // attached to its parent" is a per-type property rather than a shared one.
    // CanvasLayer's read no hierarchy attributes at all, which detached the
    // layer AND everything under it — the shape every Godot HUD is written in.
    it('keeps a subtree hanging off a non-Control layer node', () => {
      const parser = new TscnParser();
      const content = `[gd_scene format=3]

[node name="Root" type="Control"]

[node name="HUD" type="CanvasLayer" parent="."]

[node name="Score" type="Label" parent="HUD"]
text = "Score: 0"`;

      const result = parser.parse(content);

      expect(result.nodes).toHaveLength(1);
      const layer = result.nodes[0]!.children[0];
      expect(layer?.type).toBe('CanvasLayer');
      expect(layer?.children.map((c) => c.name)).toEqual(['Score']);
    });

    it('should handle single root with child', () => {
      const parser = new TscnParser();
      const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Child" parent="." type="Node3D"]`;

      const result = parser.parse(content);

      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0]!.name).toBe('Root');
      expect(result.nodes[0]!.children).toHaveLength(1);
      expect(result.nodes[0]!.children[0]!.name).toBe('Child');
    });
  });

  describe('parse complete fixture file', () => {
    it('should parse simple_node3d.tscn fixture', () => {
      const parser = new TscnParser();
      const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Child1" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 0, 0)

[node name="Child2" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -2, 1, 0)

[node name="GrandChild" type="Node3D" parent="Child1"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0)`;

      const result = parser.parse(content);

      // Should have 1 root node
      expect(result.nodes).toHaveLength(1);
      const root = result.nodes[0]!;
      expect(root.name).toBe('Root');

      // Root should have 2 children
      expect(root.children).toHaveLength(2);

      // Check Child1
      const child1 = root.children.find(c => c.name === 'Child1');
      expect(child1).toBeDefined();
      const child1Transform = transformOf(child1!.properties);
      if (child1Transform) {
        expect(child1Transform.origin.x).toBe(2);
      }

      // Child1 should have GrandChild
      expect(child1!.children).toHaveLength(1);
      expect(child1!.children[0]!.name).toBe('GrandChild');

      // Check Child2
      const child2 = root.children.find(c => c.name === 'Child2');
      expect(child2).toBeDefined();
      const child2Transform = transformOf(child2!.properties);
      if (child2Transform) {
        expect(child2Transform.origin.x).toBe(-2);
        expect(child2Transform.origin.y).toBe(1);
      }
    });
  });

  describe('parse external and internal resources', () => {
    it('should parse external resources', () => {
      const parser = new TscnParser();
      const content = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://scene.tscn" id="1_abc"]

[node name="Root" type="Node3D"]`;

      const result = parser.parse(content);

      expect(result.externalResources).toHaveLength(1);
      expect(result.externalResources[0]!.type).toBe('PackedScene');
      expect(result.externalResources[0]!.path).toBe('res://scene.tscn');
    });

    it('should parse internal resources', () => {
      const parser = new TscnParser();
      const content = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="BoxMesh_1"]
size = Vector3(1, 1, 1)

[node name="Root" type="Node3D"]`;

      const result = parser.parse(content);

      expect(result.internalResources).toHaveLength(1);
      expect(result.internalResources[0]!.type).toBe('BoxMesh');
      expect(result.internalResources[0]!.data).toHaveProperty('size');
    });
  });
});
