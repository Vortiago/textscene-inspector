/**
 * Tests for TscnParserCore callback pattern
 */

import { describe, it, expect, vi } from 'vitest';
import { TscnParserCore } from './TscnParserCore.js';
import type { NodeCreator } from './TscnParserCore.js';

describe('TscnParserCore', () => {
  const parser = new TscnParserCore();

  describe('callback pattern', () => {
    it('should call node creator for each node heading', () => {
      const content = `
[node name="Root" type="Node3D"]

[node name="Child" type="MeshInstance3D" parent="Root"]
mesh = SubResource("mesh_1")
`;

      const mockCreator = vi.fn<NodeCreator>((heading, properties) => ({
        name: heading.attributes.name || '',
        type: heading.attributes.type || '',
        parent: heading.attributes.parent,
        properties,
        children: [],
      }));

      parser.parse(content, mockCreator);

      expect(mockCreator).toHaveBeenCalledTimes(2);

      // First call: Root node
      expect(mockCreator).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          type: 'node',
          attributes: expect.objectContaining({
            name: 'Root',
            type: 'Node3D',
          }),
        }),
        {}
      );

      // Second call: Child node
      expect(mockCreator).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          type: 'node',
          attributes: expect.objectContaining({
            name: 'Child',
            type: 'MeshInstance3D',
            parent: 'Root',
          }),
        }),
        { mesh: 'SubResource("mesh_1")' }
      );
    });

    it('should handle null return from node creator', () => {
      const content = `[node name="Root" type="Node3D"]`;

      const mockCreator = vi.fn<NodeCreator>(() => null);

      const scene = parser.parse(content, mockCreator);

      expect(mockCreator).toHaveBeenCalledTimes(1);
      expect(scene.nodes).toEqual([]);
    });

    it('should pass accumulated properties to node creator', () => {
      const content = `
[node name="Mesh" type="MeshInstance3D"]
mesh = SubResource("mesh_1")
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
cast_shadow = 1
`;

      const mockCreator = vi.fn<NodeCreator>((heading, properties) => ({
        name: heading.attributes.name || '',
        type: heading.attributes.type || '',
        properties,
        children: [],
      }));

      parser.parse(content, mockCreator);

      expect(mockCreator).toHaveBeenCalledWith(
        expect.any(Object),
        {
          mesh: 'SubResource("mesh_1")',
          transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)',
          cast_shadow: '1',
        }
      );
    });
  });

  describe('resource parsing', () => {
    it('should parse external resources without calling node creator', () => {
      const content = `
[ext_resource type="Texture2D" path="res://icon.png" id="texture_1"]

[node name="Root" type="Node3D"]
`;

      const mockCreator = vi.fn<NodeCreator>((heading, properties) => ({
        name: heading.attributes.name || '',
        type: heading.attributes.type || '',
        properties,
        children: [],
      }));

      const scene = parser.parse(content, mockCreator);

      // Node creator should only be called for nodes, not resources
      expect(mockCreator).toHaveBeenCalledTimes(1);
      expect(scene.externalResources).toHaveLength(1);
      expect(scene.externalResources[0]).toMatchObject({
        type: 'Texture2D',
        path: 'res://icon.png',
      });
    });

    it('should parse internal resources without calling node creator', () => {
      const content = `
[sub_resource type="ArrayMesh" id="mesh_1"]

[node name="Root" type="Node3D"]
`;

      const mockCreator = vi.fn<NodeCreator>((heading, properties) => ({
        name: heading.attributes.name || '',
        type: heading.attributes.type || '',
        properties,
        children: [],
      }));

      const scene = parser.parse(content, mockCreator);

      expect(mockCreator).toHaveBeenCalledTimes(1);
      expect(scene.internalResources).toHaveLength(1);
      expect(scene.internalResources[0]).toMatchObject({
        type: 'ArrayMesh',
        data: { id: 'mesh_1' },
      });
    });
  });

  describe('scene tree building', () => {
    it('should build scene tree from flat node list', () => {
      const content = `
[node name="Root" type="Node3D"]

[node name="Child1" type="Node3D" parent="."]

[node name="Child2" type="Node3D" parent="."]

[node name="GrandChild" type="Node3D" parent="Child1"]
`;

      const mockCreator: NodeCreator = (heading, properties) => ({
        name: heading.attributes.name || '',
        type: heading.attributes.type || '',
        parent: heading.attributes.parent,
        properties,
        children: [],
      });

      const scene = parser.parse(content, mockCreator);

      expect(scene.nodes).toHaveLength(1); // Only root node
      expect(scene.nodes[0]?.name).toBe('Root');
      expect(scene.nodes[0]?.children).toHaveLength(2);

      // Find Child1 and Child2 (order may vary)
      const childNames = scene.nodes[0]?.children.map(c => c.name);
      expect(childNames).toContain('Child1');
      expect(childNames).toContain('Child2');

      // Find Child1 and verify it has GrandChild
      const child1 = scene.nodes[0]?.children.find(c => c.name === 'Child1');
      expect(child1).toBeDefined();
      expect(child1?.children).toHaveLength(1);
      expect(child1?.children[0]?.name).toBe('GrandChild');
    });
  });

  describe('edge cases', () => {
    it('should handle empty content', () => {
      const mockCreator = vi.fn<NodeCreator>();
      const scene = parser.parse('', mockCreator);

      expect(mockCreator).not.toHaveBeenCalled();
      expect(scene.nodes).toEqual([]);
      expect(scene.externalResources).toEqual([]);
      expect(scene.internalResources).toEqual([]);
    });

    it('should handle comments and empty lines', () => {
      const content = `
; This is a comment

[node name="Root" type="Node3D"]

; Another comment
`;

      const mockCreator = vi.fn<NodeCreator>((heading, properties) => ({
        name: heading.attributes.name || '',
        type: heading.attributes.type || '',
        properties,
        children: [],
      }));

      const scene = parser.parse(content, mockCreator);

      expect(mockCreator).toHaveBeenCalledTimes(1);
      expect(scene.nodes).toHaveLength(1);
    });

    it('should handle malformed headings gracefully', () => {
      const content = `
[invalid heading without attributes]
[node name="Valid" type="Node3D"]
`;

      const mockCreator = vi.fn<NodeCreator>((heading, properties) => ({
        name: heading.attributes.name || '',
        type: heading.attributes.type || '',
        properties,
        children: [],
      }));

      // Should not throw, just skip invalid headings
      const scene = parser.parse(content, mockCreator);

      expect(mockCreator).toHaveBeenCalledTimes(1);
      expect(scene.nodes).toHaveLength(1);
    });
  });
});
