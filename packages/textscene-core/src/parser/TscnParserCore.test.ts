/**
 * Tests for TscnParserCore callback pattern
 */

import { describe, it, expect, vi } from 'vitest';
import { TscnParserCore } from './TscnParserCore.js';
import type { NodeCreator, ParseObserver } from './TscnParserCore.js';

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

  describe('observer seam', () => {
    const simpleCreator: NodeCreator = (heading, properties) => ({
      name: heading.attributes.name || '',
      type: heading.attributes.type || '',
      parent: heading.attributes.parent,
      properties,
      children: [],
    });

    it('produces identical output with and without an observer', () => {
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://icon.png" id="1"]

[sub_resource type="BoxMesh" id="BoxMesh_1"]
size = Vector3(1, 2, 3)

[node name="Root" type="Node3D"]
visible = true

[node name="Label" type="Label" parent="."]
text = "multi
line"
garbage-line-without-equals
[node name="Broken" type="Node3D"
`;

      const bare = parser.parse(content, simpleCreator);
      const observed = parser.parse(content, simpleCreator, {
        onError: () => {},
        onSectionStart: () => {},
        onProperty: () => {},
      });

      expect(observed).toEqual(bare);
    });

    it('fires onError with INVALID_HEADING_FORMAT and line number for a malformed heading', () => {
      const content = `[gd_scene format=3]

[node name="Root" type="Node3D"
`;
      const onError = vi.fn<NonNullable<ParseObserver['onError']>>();

      parser.parse(content, simpleCreator, { onError });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith({
        message: 'Invalid heading format: "[node name="Root" type="Node3D""',
        line: 3,
        column: 1,
        code: 'INVALID_HEADING_FORMAT',
      });
    });

    it('fires onError with INVALID_PROPERTY_FORMAT and line number for a malformed property', () => {
      const content = `[gd_scene format=3]

[node name="Root" type="Node3D"]
notaproperty
`;
      const onError = vi.fn<NonNullable<ParseObserver['onError']>>();

      parser.parse(content, simpleCreator, { onError });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith({
        message: 'Invalid property format: "notaproperty"',
        line: 4,
        column: 1,
        code: 'INVALID_PROPERTY_FORMAT',
      });
    });

    it('does not fire onError for bracket lines inside a multi-line accumulation', () => {
      const content = `[gd_scene format=3]

[sub_resource type="SpriteFrames" id="sf"]
animations = [{
"frames": [],
}]

[node name="Root" type="Node3D"]
`;
      const onError = vi.fn<NonNullable<ParseObserver['onError']>>();

      parser.parse(content, simpleCreator, { onError });

      expect(onError).not.toHaveBeenCalled();
    });

    it('fires onProperty with starting line, ownerType, and isMultiline per section', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="bm"]
size = Vector3(1, 2, 3)

[node name="Title" type="Label"]
text = "first
second"
visible = true
`;
      const onProperty = vi.fn<NonNullable<ParseObserver['onProperty']>>();

      parser.parse(content, simpleCreator, { onProperty });

      expect(onProperty).toHaveBeenCalledTimes(3);
      // sub_resource property: ownerType from the heading's type attribute
      expect(onProperty).toHaveBeenNthCalledWith(
        1,
        'sub_resource',
        'BoxMesh',
        'size',
        'Vector3(1, 2, 3)',
        4,
        false
      );
      // accumulated multi-line value: STARTING line, isMultiline=true
      expect(onProperty).toHaveBeenNthCalledWith(
        2,
        'node',
        'Label',
        'text',
        '"first\nsecond"',
        7,
        true
      );
      // single-line property after the multi-line one: its own line number
      expect(onProperty).toHaveBeenNthCalledWith(3, 'node', 'Label', 'visible', 'true', 9, false);
    });

    it('passes ownerType=undefined outside node/sub_resource sections', () => {
      const content = `[gd_scene format=3]
config = 1

[node name="Root" index="0"]
visible = true
`;
      const onProperty = vi.fn<NonNullable<ParseObserver['onProperty']>>();

      parser.parse(content, simpleCreator, { onProperty });

      expect(onProperty).toHaveBeenCalledTimes(2);
      // gd_scene body property: section 'none', no owner type
      expect(onProperty).toHaveBeenNthCalledWith(1, 'none', undefined, 'config', '1', 2, false);
      // index= node has no type attribute: ownerType undefined
      expect(onProperty).toHaveBeenNthCalledWith(2, 'node', undefined, 'visible', 'true', 5, false);
    });

    it('fires onSectionStart for each section with its kind and line', () => {
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://icon.png" id="1"]

[sub_resource type="BoxMesh" id="bm"]

[node name="Root" type="Node3D"]
`;
      const onSectionStart = vi.fn<NonNullable<ParseObserver['onSectionStart']>>();

      parser.parse(content, simpleCreator, { onSectionStart });

      expect(onSectionStart).toHaveBeenCalledTimes(4);
      expect(onSectionStart).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ type: 'gd_scene' }),
        'none',
        1
      );
      expect(onSectionStart).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ type: 'ext_resource' }),
        'ext_resource',
        3
      );
      expect(onSectionStart).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ type: 'sub_resource' }),
        'sub_resource',
        5
      );
      expect(onSectionStart).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({ type: 'node' }),
        'node',
        7
      );
    });
  });
});
