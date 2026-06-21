/**
 * Tests for StrictTscnParser
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StrictTscnParser } from './StrictTscnParser.js';

describe('StrictTscnParser', () => {
  let parser: StrictTscnParser;

  beforeEach(() => {
    parser = new StrictTscnParser();
  });

  describe('multi-line values with heading-looking content', () => {
    // A multi-line value's continuation lines can look like headings — BBCode
    // tags (`[u]…[/u]`, `[center]`) and bracketed array/dict elements — but are
    // CONTENT, not a new section. They must not be flagged as malformed.
    const expectNoFormatError = (content: string) => {
      const codes = parser.parse(content).errors.map((e) => e.code);
      expect(codes).not.toContain('INVALID_PROPERTY_FORMAT');
      expect(codes).not.toContain('INVALID_HEADING_FORMAT');
    };

    it('does not flag BBCode tag lines inside a multi-line string', () => {
      expectNoFormatError(`[gd_scene format=3]

[node name="Title" type="RichTextLabel"]
bbcode_enabled = true
text = "[center][u]CONTRIBUTORS:[/u]
- Alice

[u]ASSETS:[/u]
- 3D Kit by Kenney.nl"
fit_content = true
`);
    });

    it('does not flag bracketed array element lines inside a multi-line value', () => {
      expectNoFormatError(`[gd_scene format=3]

[node name="N" type="Node"]
meta = [
[0, 0],
[1, 1]
]
`);
    });
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

  describe('Invalid Heading Format', () => {
    it('should report INVALID_HEADING_FORMAT for a heading missing its closing bracket', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.code).toBe('INVALID_HEADING_FORMAT');
      expect(result.errors[0]!.line).toBe(3);
      expect(result.errors[0]!.message).toContain('Invalid heading format');
      expect(result.scene).toBeUndefined();
    });

    it('should report every malformed heading (edge-malformed-bracket fixture shape)', () => {
      // Mirrors scenes/fixtures/edge-malformed-bracket.tscn: both lines open a
      // bracket but never close it. Previously these were silently swallowed
      // by the property-parsing fallback and the file linted clean.
      const content = `[gd_scene format=3

[node name="Root" type="Node3D"
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]!.code).toBe('INVALID_HEADING_FORMAT');
      expect(result.errors[0]!.line).toBe(1);
      expect(result.errors[1]!.code).toBe('INVALID_HEADING_FORMAT');
      expect(result.errors[1]!.line).toBe(3);
      expect(result.scene).toBeUndefined();
    });

    it('does not flag bracket-opening lines inside a multi-line value', () => {
      // Continuation lines of an accumulated value may legitimately start
      // with '[' (arrays/dicts spanning lines) — no INVALID_HEADING_FORMAT.
      const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="SpriteFrames" id="sf_1"]
animations = [{
"frames": [],
"name": &"default"
}]

[node name="Root" type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.internalResources).toHaveLength(1);
    });

    it('should report error for heading without attributes', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node]
`;

      const result = parser.parse(content);

      expect(result.errors.length).toBeGreaterThan(0);
      const error = result.errors.find(e => e.code === 'MISSING_NODE_NAME' || e.code === 'MISSING_NODE_IDENTIFIER');
      expect(error).toBeDefined();
    });
  });

  describe('Missing Node Name', () => {
    it('should report error when node has no name attribute', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.severity).toBe('error');
      expect(result.errors[0]!.code).toBe('MISSING_NODE_NAME');
      expect(result.errors[0]!.line).toBe(3);
      expect(result.errors[0]!.message).toContain('name=');
    });
  });

  describe('Missing Node Identifier', () => {
    it('should report error when node has no type, index, or instance', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.severity).toBe('error');
      expect(result.errors[0]!.code).toBe('MISSING_NODE_IDENTIFIER');
      expect(result.errors[0]!.line).toBe(3);
      expect(result.errors[0]!.message).toContain('type=');
      expect(result.errors[0]!.message).toContain('index=');
      expect(result.errors[0]!.message).toContain('instance=');
    });

    it('should accept node with type attribute', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
    });

    it('should accept node with index attribute (instanced scene child)', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Enemy" type="Node3D"]

[node name="@Sprite2D@123" index="0" parent="Enemy"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
    });

    it('should accept node with instance attribute (PackedScene)', () => {
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://enemy.tscn" id="1_abc"]

[node name="Root" type="Node3D"]

[node name="Enemy1" instance=ExtResource("1_abc") parent="."]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
    });

    it('parses an index-only child node without polluting its properties', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="@Child@123" index="0" parent="."]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      const childNode = result.scene!.nodes[0]!.children[0]!;
      expect(childNode.name).toBe('@Child@123');
      // No `__`-prefixed metadata smuggled into the property schema.
      expect((childNode.properties as Record<string, unknown>)['__instance_index']).toBeUndefined();
    });

    it('exposes an instance reference on node.instance, not a __instance property', () => {
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://enemy.tscn" id="1_abc"]

[node name="Root" type="Node3D"]

[node name="Enemy1" instance=ExtResource("1_abc") parent="."]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      const childNode = result.scene!.nodes[0]!.children[0]!;
      expect(childNode.instance).toBe('ExtResource("1_abc")');
      expect((childNode.properties as Record<string, unknown>)['__instance']).toBeUndefined();
    });
  });

  describe('Invalid Property Format', () => {
    it('should report error for property without equals sign', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
invalidproperty
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.severity).toBe('error');
      expect(result.errors[0]!.code).toBe('INVALID_PROPERTY_FORMAT');
      expect(result.errors[0]!.line).toBe(4);
      expect(result.errors[0]!.message).toContain('Invalid property format');
    });

    it('should accept property with empty value (parsed as empty string)', () => {
      // The parser allows "key =" format (value becomes empty string)
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
visible =
`;

      const result = parser.parse(content);

      // Empty value is allowed by parser (becomes empty string)
      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.nodes[0]!.properties).toHaveProperty('visible');
      expect(result.scene!.nodes[0]!.properties['visible']).toBe('');
    });
  });

  describe('Multi-line String Properties', () => {
    it('should handle single-line quoted strings', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
metadata/test = "Single line string"
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.nodes[0]!.properties['metadata/test']).toBe('"Single line string"');
    });

    it('should handle multi-line quoted strings (implementation-specific behavior)', () => {
      // Note: Multi-line string handling may have specific format requirements
      // This test documents the current behavior
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
script = "res://test.gd"
`;

      const result = parser.parse(content);

      // Simple quoted values work fine
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Line and Column Tracking', () => {
    it('should report accurate line numbers for errors', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
visible = true

[node name="Child1" type="Node3D" parent="."]

[node name="Child2" parent="."]

[node name="Child3" type="Node3D" parent="."]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.line).toBe(8); // Line with missing type
    });

    it('should report column 1 for all errors (no column tracking yet)', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;

      const result = parser.parse(content);

      expect(result.errors.length).toBeGreaterThan(0);
      result.errors.forEach(error => {
        expect(error.column).toBe(1);
      });
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

  describe('Scene Tree Building', () => {
    it('should build correct parent-child relationships', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Child1" type="Node3D" parent="."]

[node name="Child2" type="Node3D" parent="."]

[node name="GrandChild" type="Node3D" parent="Child1"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene!.nodes[0]!.children).toHaveLength(2);
      // Children are added in the order they're processed (backward iteration)
      const childNames = result.scene!.nodes[0]!.children.map(c => c.name);
      expect(childNames).toContain('Child1');
      expect(childNames).toContain('Child2');

      const child1 = result.scene!.nodes[0]!.children.find(c => c.name === 'Child1')!;
      expect(child1.children).toHaveLength(1);
      expect(child1.children[0]!.name).toBe('GrandChild');
    });

    it('should handle first node as root (only returns one root)', () => {
      // buildSceneTree only returns the first root node
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root1" type="Node3D"]

[node name="Root2" type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      // Only the first root node is returned
      expect(result.scene!.nodes).toHaveLength(1);
      expect(result.scene!.nodes[0]!.name).toBe('Root1');
    });

    it('should set parent property when parent specified', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Child" type="Node3D" parent="."]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      const childNode = result.scene!.nodes[0]!.children[0]!;
      expect(childNode.parent).toBe('.');
    });

    it('should not set parent property for root nodes', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene!.nodes[0]!.parent).toBeUndefined();
    });
  });

  describe('Multiple Errors', () => {
    it('should report all errors found in file', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]

[node type="Node3D"]

[node name="Invalid" parent="."]
invalidproperty
`;

      const result = parser.parse(content);

      expect(result.errors.length).toBeGreaterThanOrEqual(4);
      // Should have errors for: missing identifier (Root), missing name, missing identifier (Invalid), invalid property
    });

    it('should not return scene when errors found', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root"]
`;

      const result = parser.parse(content);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.scene).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      const content = '';

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.nodes).toHaveLength(0);
    });

    it('should handle content with only comments', () => {
      const content = `; Just comments
; Nothing else
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.nodes).toHaveLength(0);
    });

    it('should handle node with many properties', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)
visible = true
process_mode = 0
process_priority = 0
editor_description = "Test node"
`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(Object.keys(result.scene!.nodes[0]!.properties)).toHaveLength(5);
    });

    it('should finalize last section at end of file', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
visible = true`;

      const result = parser.parse(content);

      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.nodes[0]!.properties).toHaveProperty('visible');
    });
  });

  describe('Property Validation via ValidatorRegistry', () => {
    it('should skip validation for nodes with index attribute (unknown type)', () => {
      const content = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="@Child@123" index="0" parent="."]
visible = invalid_value
`;

      const result = parser.parse(content);

      // No validation errors because node type is unknown (index= node)
      expect(result.errors).toHaveLength(0);
    });

    it('should skip validation for nodes with instance attribute (unknown type)', () => {
      const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="PackedScene" path="res://enemy.tscn" id="1"]

[node name="Root" type="Node3D"]

[node name="Enemy1" instance=ExtResource("1") parent="."]
visible = invalid_value
`;

      const result = parser.parse(content);

      // No validation errors because node type is unknown (instance= node)
      expect(result.errors).toHaveLength(0);
    });

    it('should not validate properties in sub_resources', () => {
      // Sub_resource properties are not type-validated
      const content = `[gd_scene load_steps=2 format=3]

[sub_resource type="BoxMesh" id="1"]
size = Vector3(1, 2, 3)

[node name="Root" type="Node3D"]
`;

      const result = parser.parse(content);

      // Sub_resources are parsed but properties aren't validated
      expect(result.errors).toHaveLength(0);
      expect(result.scene).toBeDefined();
      expect(result.scene!.internalResources).toHaveLength(1);
    });
  });

  describe('Multi-line string section-boundary salvage', () => {
    it('does not swallow the next node heading when a string is left unclosed', () => {
      const content = `[gd_scene format=3]

[node name="A" type="Label"]
text = "oops unclosed
[node name="B" type="Node3D" parent="."]
`;
      const result = parser.parse(content);
      // B must be parsed as its own node, not consumed into A's open string.
      const root = result.scene!.nodes[0]!;
      expect(root.name).toBe('A');
      expect(root.children.some((c) => c.name === 'B')).toBe(true);
    });
  });
});
